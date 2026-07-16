import { databaseAuditWriter } from "@evaluation/audit";
import {
  AppError,
  EligibilitySnapshotSchema,
  ExcludeEligibilityInputSchema,
  OpenCycleInputSchema,
} from "@evaluation/contracts";
import { decide } from "@evaluation/permissions";

type DatabaseClient = ReturnType<typeof import("@evaluation/database").createDatabaseClient>;
type Transaction = Parameters<Parameters<DatabaseClient["$transaction"]>[0]>[0];
type AuditWriter = import("@evaluation/contracts").AuditWriter<Transaction>;

type Principal = Readonly<{
  subjectId: string;
  active: boolean;
  roles: ReadonlyArray<{
    role: import("@evaluation/permissions").Role;
    scopeType: import("@evaluation/permissions").ScopeType;
    scopeId: string;
  }>;
  departmentScopeId: string;
}>;

export class EligibilityService {
  private readonly client: DatabaseClient;
  private readonly auditWriter: AuditWriter;

  constructor(client: DatabaseClient, auditWriter: AuditWriter) {
    this.client = client;
    this.auditWriter = auditWriter;
  }

  async openCycle(input: unknown): Promise<import("@evaluation/contracts").EligibilitySnapshot> {
    const parsed = OpenCycleInputSchema.parse(input);
    return serializable(this.client, async (transaction) => {
      await authorizeDepartmentManager(
        transaction,
        parsed.actorId,
        parsed.departmentId,
        parsed.managerId,
      );
      await requireEligibleEmployees(
        transaction,
        parsed.departmentId,
        parsed.eligibleEmployees.map(({ employeeId }) => employeeId),
      );

      const cycle = await transaction.evaluationCycle.create({
        data: {
          departmentId: parsed.departmentId,
          managerId: parsed.managerId,
          version: parsed.version,
          visibilityMode: parsed.visibilityMode,
          sourceReason: parsed.sourceReason,
          effectiveFrom: new Date(parsed.effectiveFrom),
          effectiveTo: new Date(parsed.effectiveTo),
        },
      });
      const snapshot = await transaction.eligibilitySnapshot.create({
        data: {
          cycleId: cycle.id,
          version: parsed.version,
          visibilityMode: parsed.visibilityMode,
          sourceReason: parsed.sourceReason,
          effectiveFrom: new Date(parsed.effectiveFrom),
          effectiveTo: new Date(parsed.effectiveTo),
        },
      });
      await transaction.eligibilityEntry.createMany({
        data: parsed.eligibleEmployees.map((candidate, position) => ({
          cycleId: cycle.id,
          snapshotId: snapshot.id,
          employeeId: candidate.employeeId,
          position,
          state: candidate.state,
          sourceReason: candidate.sourceReason,
          effectiveFrom: new Date(candidate.effectiveFrom),
          effectiveTo: new Date(candidate.effectiveTo),
        })),
      });
      const openedCycle = await transaction.evaluationCycle.update({
        where: { id: cycle.id },
        data: { openedAt: new Date() },
      });
      const entries = await transaction.eligibilityEntry.findMany({
        where: { snapshotId: snapshot.id },
        orderBy: { position: "asc" },
      });
      return serializeSnapshot(openedCycle, snapshot, entries);
    });
  }

  async excludeEligibility(
    input: unknown,
  ): Promise<import("@evaluation/contracts").CompletionStatus> {
    const parsed = ExcludeEligibilityInputSchema.parse(input);
    return serializable(this.client, async (transaction) => {
      const cycle = await transaction.evaluationCycle.findUnique({
        where: { id: parsed.cycleId },
      });
      if (cycle === null) throw resourceError("EVALUATION_CYCLE_NOT_FOUND");
      await authorizeDepartmentManager(
        transaction,
        parsed.actorId,
        cycle.departmentId,
        cycle.managerId,
      );
      if (cycle.openedAt === null || cycle.closedAt !== null) {
        throw resourceError("EVALUATION_CYCLE_CLOSED");
      }

      const entry = await transaction.eligibilityEntry.findUnique({
        where: {
          cycleId_employeeId: {
            cycleId: parsed.cycleId,
            employeeId: parsed.employeeId,
          },
        },
      });
      if (entry === null) throw resourceError("ELIGIBILITY_ENTRY_NOT_FOUND");
      if (!["pending", "approved_leave"].includes(entry.state) || entry.submittedAt !== null) {
        throw new AppError(
          "ELIGIBILITY_TRANSITION_INVALID",
          "errors.evaluation.eligibilityTransitionInvalid",
          409,
        );
      }

      const effectiveAt = new Date(parsed.effectiveAt);
      if (!isWithinFrozenPeriod(effectiveAt, cycle, entry, true)) {
        throw new AppError(
          "ELIGIBILITY_EFFECTIVE_AT_OUT_OF_RANGE",
          "errors.evaluation.eligibilityEffectiveAtOutOfRange",
          400,
        );
      }

      const updated = await transaction.eligibilityEntry.update({
        where: { id: entry.id },
        data: {
          version: { increment: 1 },
          state: "excluded",
          sourceReason: parsed.reason,
          effectiveFrom: effectiveAt,
        },
      });
      await this.auditWriter.append(transaction, {
        eventType: "evaluation.eligibility.excluded",
        actor: { kind: "human", id: parsed.actorId },
        effectiveSubjectId: parsed.employeeId,
        scopeType: "cycle",
        scopeId: cycle.id,
        targetType: "evaluation_eligibility_entry",
        targetId: entry.id,
        reason: parsed.reason,
        safeDiff: {
          employeeId: parsed.employeeId,
          effectiveAt: parsed.effectiveAt,
          previous: { state: entry.state, version: entry.version },
          next: { state: updated.state, version: updated.version },
        },
        correlationId: parsed.correlationId,
        source: "api",
      });
      return serializeCompletion(updated);
    });
  }

  async recordSubmissionMarker(
    cycleId: string,
    employeeId: string,
    submittedAt: Date,
  ): Promise<import("@evaluation/contracts").CompletionStatus> {
    if (!isUuid(cycleId) || !isUuid(employeeId) || !Number.isFinite(submittedAt.getTime())) {
      throw new AppError(
        "SUBMISSION_MARKER_INVALID",
        "errors.evaluation.submissionMarkerInvalid",
        400,
      );
    }
    return serializable(this.client, async (transaction) => {
      const cycle = await transaction.evaluationCycle.findUnique({ where: { id: cycleId } });
      if (cycle === null) throw resourceError("EVALUATION_CYCLE_NOT_FOUND");
      if (cycle.openedAt === null || cycle.closedAt !== null) {
        throw resourceError("EVALUATION_CYCLE_CLOSED");
      }
      const entry = await transaction.eligibilityEntry.findUnique({
        where: { cycleId_employeeId: { cycleId, employeeId } },
      });
      if (entry === null) throw resourceError("ELIGIBILITY_ENTRY_NOT_FOUND");
      if (entry.state !== "active") {
        throw new AppError(
          "SUBMISSION_MARKER_STATE_INVALID",
          "errors.evaluation.submissionMarkerStateInvalid",
          409,
        );
      }
      if (!isWithinFrozenPeriod(submittedAt, cycle, entry, false)) {
        throw new AppError(
          "SUBMISSION_MARKER_OUT_OF_RANGE",
          "errors.evaluation.submissionMarkerOutOfRange",
          400,
        );
      }
      if (entry.submittedAt !== null) {
        if (entry.submittedAt.getTime() !== submittedAt.getTime()) {
          throw new AppError(
            "SUBMISSION_MARKER_IMMUTABLE",
            "errors.evaluation.submissionMarkerImmutable",
            409,
          );
        }
        return serializeCompletion(entry);
      }
      const updated = await transaction.eligibilityEntry.update({
        where: { id: entry.id },
        data: { submittedAt },
      });
      return serializeCompletion(updated);
    });
  }

  async getCompletionStatus(
    cycleId: string,
    managerId: string,
  ): Promise<import("@evaluation/contracts").CompletionStatus[]> {
    if (!isUuid(cycleId) || !isUuid(managerId)) {
      throw new AppError(
        "COMPLETION_QUERY_INVALID",
        "errors.evaluation.completionQueryInvalid",
        400,
      );
    }
    return this.client.$transaction(async (transaction) => {
      const cycle = await transaction.evaluationCycle.findUnique({
        where: { id: cycleId },
        include: { eligibilityEntries: { orderBy: { position: "asc" } } },
      });
      if (cycle === null) throw resourceError("EVALUATION_CYCLE_NOT_FOUND");
      const principal = await authorizeDepartmentManager(
        transaction,
        managerId,
        cycle.departmentId,
        cycle.managerId,
      );
      if (cycle.visibilityMode !== "identified") {
        throw new AppError("AUTHZ_RESOURCE_STATE", "errors.authorization.denied", 403);
      }

      for (const entry of cycle.eligibilityEntries) {
        if (entry.submittedAt === null) continue;
        const decision = decide(
          principal,
          "managerFeedback.response.read",
          {
            kind: "managerFeedback.response",
            responseId: entry.id,
            departmentId: principal.departmentScopeId,
            managerId: cycle.managerId,
            submitterId: entry.employeeId,
            status: "submitted",
            visibilityMode: cycle.visibilityMode,
          },
          { now: new Date().toISOString() },
        );
        if (!decision.allowed) throw authorizationError(decision.reasonCode);
      }
      return cycle.eligibilityEntries.map(serializeCompletion);
    });
  }
}

export function createEligibilityService(
  client: DatabaseClient,
  writer: AuditWriter = databaseAuditWriter as AuditWriter,
): EligibilityService {
  return new EligibilityService(client, writer);
}

async function authorizeDepartmentManager(
  transaction: Transaction,
  actorId: string,
  departmentId: string,
  expectedManagerId: string,
): Promise<Principal> {
  const [user, departmentScope, roles] = await Promise.all([
    transaction.user.findUnique({ where: { id: actorId }, select: { active: true } }),
    transaction.authorizationScope.findFirst({
      where: { scopeType: "department", departmentId },
      select: { id: true },
    }),
    transaction.roleAssignment.findMany({
      where: { userId: actorId },
      select: { role: true, scopeType: true, scopeId: true },
    }),
  ]);
  if (user === null || !user.active) throw authorizationError("INACTIVE");
  if (departmentScope === null) throw authorizationError("RESOURCE_STATE");
  const principal = {
    subjectId: actorId,
    active: user.active,
    roles,
    departmentScopeId: departmentScope.id,
  } satisfies Principal;
  const decision = decide(
    principal,
    "department.manage",
    { kind: "department", departmentId: departmentScope.id },
    { now: new Date().toISOString() },
  );
  if (!decision.allowed) throw authorizationError(decision.reasonCode);
  if (actorId !== expectedManagerId) throw authorizationError("SCOPE_MISMATCH");
  return principal;
}

async function requireEligibleEmployees(
  transaction: Transaction,
  departmentId: string,
  employeeIds: readonly string[],
): Promise<void> {
  const scope = await transaction.authorizationScope.findFirstOrThrow({
    where: { scopeType: "department", departmentId },
    select: { id: true },
  });
  const eligible = await transaction.user.findMany({
    where: {
      id: { in: [...employeeIds] },
      active: true,
      roleAssignments: {
        some: { role: "employee", scopeType: "department", scopeId: scope.id },
      },
    },
    select: { id: true },
  });
  if (eligible.length !== employeeIds.length) {
    throw new AppError(
      "ELIGIBILITY_CANDIDATE_INVALID",
      "errors.evaluation.eligibilityCandidateInvalid",
      400,
    );
  }
}

function serializeSnapshot(
  cycle: {
    id: string;
    openedAt: Date | null;
  },
  snapshot: {
    id: string;
    version: number;
    visibilityMode: "identified" | "manager_blinded" | "anonymous_aggregated";
    sourceReason: string;
    effectiveFrom: Date;
    effectiveTo: Date;
  },
  entries: ReadonlyArray<{
    id: string;
    employeeId: string;
    state: "active" | "excluded" | "approved_leave" | "pending";
    sourceReason: string;
    effectiveFrom: Date;
    effectiveTo: Date;
    submittedAt: Date | null;
  }>,
): import("@evaluation/contracts").EligibilitySnapshot {
  if (cycle.openedAt === null) throw new Error("Evaluation cycle snapshot is not open");
  return EligibilitySnapshotSchema.parse({
    id: snapshot.id,
    cycleId: cycle.id,
    version: snapshot.version,
    visibilityMode: snapshot.visibilityMode,
    sourceReason: snapshot.sourceReason,
    effectiveFrom: snapshot.effectiveFrom.toISOString(),
    effectiveTo: snapshot.effectiveTo.toISOString(),
    openedAt: cycle.openedAt.toISOString(),
    entries: entries.map((entry) => ({
      id: entry.id,
      employeeId: entry.employeeId,
      state: entry.state,
      sourceReason: entry.sourceReason,
      effectiveFrom: entry.effectiveFrom.toISOString(),
      effectiveTo: entry.effectiveTo.toISOString(),
      submittedAt: entry.submittedAt?.toISOString() ?? null,
    })),
  });
}

function serializeCompletion(entry: {
  employeeId: string;
  state: "active" | "excluded" | "approved_leave" | "pending";
  submittedAt: Date | null;
}): import("@evaluation/contracts").CompletionStatus {
  return {
    employeeId: entry.employeeId,
    state: entry.state,
    submittedAt: entry.submittedAt?.toISOString() ?? null,
  };
}

function authorizationError(reasonCode: import("@evaluation/permissions").DenialReason): AppError {
  return new AppError(
    `AUTHZ_${reasonCode}`,
    "errors.authorization.denied",
    reasonCode === "UNAUTHENTICATED" ? 401 : 403,
  );
}

function resourceError(code: string): AppError {
  return new AppError(code, "errors.evaluation.resourceUnavailable", 409);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function isWithinFrozenPeriod(
  timestamp: Date,
  cycle: { effectiveFrom: Date; effectiveTo: Date },
  entry: { effectiveFrom: Date; effectiveTo: Date },
  endExclusive: boolean,
): boolean {
  const time = timestamp.getTime();
  const lowerBound = Math.max(cycle.effectiveFrom.getTime(), entry.effectiveFrom.getTime());
  const upperBound = Math.min(cycle.effectiveTo.getTime(), entry.effectiveTo.getTime());
  return time >= lowerBound && (endExclusive ? time < upperBound : time <= upperBound);
}

async function serializable<T>(
  client: DatabaseClient,
  operation: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await client.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      if (attempt < 4 && isConcurrencyConflict(error)) continue;
      throw error;
    }
  }
  throw new Error("Unreachable eligibility retry state");
}

function isConcurrencyConflict(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  return ["P2034", "P2002"].includes(String((error as { code?: unknown }).code));
}
