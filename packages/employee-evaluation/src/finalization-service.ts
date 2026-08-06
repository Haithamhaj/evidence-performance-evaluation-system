import { databaseAuditWriter } from "@evaluation/audit";
import {
  AppError,
  AssessmentEntrySchema,
  CloseEmployeeEvaluationCycleInputSchema,
  EvaluationAcknowledgmentInputSchema,
  FinalEvaluationSnapshotSchema,
  FinalizeEmployeeEvaluationInputSchema,
} from "@evaluation/contracts";
import { z } from "zod";

type Database = import("@evaluation/database").DatabaseClient;
type Transaction = import("./ports.js").EvaluationTransaction;
type Audit = import("@evaluation/contracts").AuditWriter<Transaction>;

export type EvaluationAcknowledgmentReceipt = Readonly<{
  schemaVersion: 1;
  id: string;
  assignmentId: string;
  finalSnapshotId: string;
  kind: import("@evaluation/contracts").AcknowledgmentKind;
  reservation: string | null;
  recordedAt: string;
}>;

export type ClosedEmployeeEvaluationCycleReceipt = Readonly<{
  schemaVersion: 1;
  cycleId: string;
  state: "CLOSED";
  version: number;
  closedAt: string;
}>;

export class FinalizationService {
  readonly #database: Database;
  readonly #audit: Audit;
  readonly #clock: () => Date;

  constructor(
    database: Database,
    audit: Audit = databaseAuditWriter as Audit,
    clock: () => Date = () => new Date(),
  ) {
    this.#database = database;
    this.#audit = audit;
    this.#clock = clock;
  }

  async finalize(input: unknown): Promise<import("@evaluation/contracts").FinalEvaluationSnapshot> {
    const parsed = FinalizeEmployeeEvaluationInputSchema.parse(input);
    const finalizedAt = validDate(this.#clock());
    return serializable(this.#database, async (transaction) => {
      const duplicate = await readFinalByIdempotencyKey(transaction, parsed.idempotencyKey);
      if (duplicate !== null) {
        assertSameFinalization(duplicate, parsed);
        return serializeFinalSnapshot(duplicate);
      }
      const existing = await readFinalByAssignment(transaction, parsed.assignmentId);
      if (existing !== null) {
        assertSameFinalization(existing, parsed);
        return serializeFinalSnapshot(existing);
      }

      const assignment = await readAssignment(transaction, parsed.assignmentId);
      if (assignment.managerId !== parsed.managerId) throw finalizationError("AUTHZ_SCOPE", 403);
      if (assignment.eligibilityState !== "ELIGIBLE") {
        throw finalizationError("EVALUATION_ASSIGNMENT_NOT_ELIGIBLE", 409);
      }
      if (assignment.cycle.state !== "FINALIZATION") {
        throw finalizationError("EVALUATION_FINALIZATION_STAGE_INVALID", 409);
      }
      if (assignment.version !== parsed.expectedVersion) {
        throw finalizationError("VERSION_CONFLICT", 409);
      }
      if (assignment.cycle.snapshot === null) {
        throw finalizationError("EVALUATION_CYCLE_SNAPSHOT_REQUIRED", 409);
      }

      const [selfSubmission, managerSubmission, templateItems, discussionEntries] =
        await Promise.all([
          transaction.assessmentSubmission.findUnique({
            where: {
              assignmentId_kind: { assignmentId: assignment.id, kind: "SELF" },
            },
            include: { revision: true },
          }),
          transaction.assessmentSubmission.findUnique({
            where: {
              assignmentId_kind: { assignmentId: assignment.id, kind: "MANAGER_INITIAL" },
            },
            include: { revision: true },
          }),
          transaction.evaluationTemplateItem.findMany({
            where: { versionId: assignment.cycle.templateVersionId },
            orderBy: { displayOrder: "asc" },
          }),
          transaction.evaluationDiscussionEntry.findMany({
            where: { assignmentId: assignment.id },
            orderBy: [{ resultingVersion: "asc" }, { id: "asc" }],
          }),
        ]);
      if (selfSubmission === null || managerSubmission === null) {
        throw finalizationError("EVALUATION_SUBMISSIONS_REQUIRED", 409);
      }
      if (
        selfSubmission.cycleSnapshotId !== assignment.cycle.snapshot.id ||
        managerSubmission.cycleSnapshotId !== assignment.cycle.snapshot.id
      ) {
        throw finalizationError("EVALUATION_SUBMISSION_SNAPSHOT_INVALID", 409);
      }
      assertFrozenTemplate(templateItems);
      assertCompleteFinalEntries(parsed.entries, templateItems);

      const selfEntries = z.array(AssessmentEntrySchema).parse(selfSubmission.revision.entries);
      const managerEntries = z
        .array(AssessmentEntrySchema)
        .parse(managerSubmission.revision.entries);
      assertCompleteSubmittedEntries(selfEntries, templateItems);
      assertCompleteSubmittedEntries(managerEntries, templateItems);
      const managerByCriterion = new Map(managerEntries.map((entry) => [entry.criterionId, entry]));
      const authorizedSources = new Set([
        ...selfEntries.flatMap(({ sourceReferences }) => sourceReferences),
        ...managerEntries.flatMap(({ sourceReferences }) => sourceReferences),
        ...discussionEntries.flatMap(({ sourceReferences }) =>
          z.array(z.string().uuid()).parse(sourceReferences),
        ),
      ]);
      let changedDecisionCount = 0;
      for (const entry of parsed.entries) {
        const initial = managerByCriterion.get(entry.criterionId)!;
        const changed = initial.rating !== entry.rating;
        if (changed && entry.managerInitialChangeReason === null) {
          throw finalizationError("EVALUATION_FINAL_CHANGE_REASON_REQUIRED");
        }
        if (!changed && entry.managerInitialChangeReason !== null) {
          throw finalizationError("EVALUATION_FINAL_CHANGE_REASON_NOT_APPLICABLE");
        }
        if (entry.sourceReferences.some((sourceId) => !authorizedSources.has(sourceId))) {
          throw finalizationError("EVALUATION_FINAL_SOURCE_NOT_AUTHORIZED", 403);
        }
        if (changed) changedDecisionCount += 1;
      }

      const itemById = new Map(templateItems.map((item) => [item.id, item]));
      const snapshot = await transaction.finalEvaluationSnapshot.create({
        data: {
          idempotencyKey: parsed.idempotencyKey,
          assignmentId: assignment.id,
          cycleId: assignment.cycleId,
          employeeId: assignment.employeeId,
          managerId: parsed.managerId,
          templateVersionId: assignment.cycle.templateVersionId,
          cycleType: assignment.cycle.cycleType,
          finalComment: parsed.finalComment,
          finalizedAt,
          decisions: {
            create: parsed.entries.map((entry, position) => {
              const item = itemById.get(entry.criterionId)!;
              return {
                assignmentId: assignment.id,
                templateItemId: item.id,
                stableCriterionId: item.stableCriterionId,
                rating: entry.rating,
                justification: entry.justification,
                sourceReferences: entry.sourceReferences,
                managerInitialChangeReason: entry.managerInitialChangeReason,
                managerId: parsed.managerId,
                position,
              };
            }),
          },
        },
        include: {
          decisions: { orderBy: { position: "asc" } },
          cycle: { select: { closedAt: true } },
        },
      });
      const advanced = await transaction.evaluationAssignment.updateMany({
        where: { id: assignment.id, version: parsed.expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (advanced.count !== 1) throw finalizationError("VERSION_CONFLICT", 409);
      await this.#audit.append(transaction, {
        eventType: "evaluation.finalized",
        actor: { kind: "human", id: parsed.managerId },
        effectiveSubjectId: assignment.employeeId,
        scopeType: "cycle",
        scopeId: assignment.cycleId,
        targetType: "final_evaluation_snapshot",
        targetId: snapshot.id,
        safeDiff: {
          humanFinalDecision: true,
          criterionCount: parsed.entries.length,
          projectContributionDecisionCount: templateItems.filter(
            ({ kind }) => kind === "PROJECT_CONTRIBUTION",
          ).length,
          changedDecisionCount,
          selectedSourceCount: new Set(
            parsed.entries.flatMap(({ sourceReferences }) => sourceReferences),
          ).size,
        },
        correlationId: parsed.idempotencyKey,
        source: "api",
      });
      return serializeFinalSnapshot(snapshot);
    });
  }

  async acknowledge(input: unknown): Promise<EvaluationAcknowledgmentReceipt> {
    const parsed = EvaluationAcknowledgmentInputSchema.parse(input);
    const recordedAt = validDate(this.#clock());
    return serializable(this.#database, async (transaction) => {
      const byKey = await transaction.evaluationAcknowledgment.findUnique({
        where: { idempotencyKey: parsed.idempotencyKey },
      });
      if (byKey !== null) {
        assertSameAcknowledgment(byKey, parsed);
        return serializeAcknowledgment(byKey);
      }
      const existing = await transaction.evaluationAcknowledgment.findUnique({
        where: { assignmentId: parsed.assignmentId },
      });
      if (existing !== null) {
        assertSameAcknowledgment(existing, parsed);
        return serializeAcknowledgment(existing);
      }

      const assignment = await readAssignment(transaction, parsed.assignmentId);
      const authorized =
        parsed.kind === "NO_RESPONSE"
          ? parsed.actorId === assignment.managerId
          : parsed.actorId === assignment.employeeId;
      if (!authorized) throw finalizationError("AUTHZ_SCOPE", 403);
      if (assignment.cycle.state !== "ACKNOWLEDGMENT") {
        throw finalizationError("EVALUATION_ACKNOWLEDGMENT_STAGE_INVALID", 409);
      }
      if (assignment.version !== parsed.expectedVersion) {
        throw finalizationError("VERSION_CONFLICT", 409);
      }
      const snapshot = await transaction.finalEvaluationSnapshot.findUnique({
        where: { assignmentId: assignment.id },
      });
      if (snapshot === null) throw finalizationError("EVALUATION_FINAL_SNAPSHOT_REQUIRED", 409);

      const acknowledgment = await transaction.evaluationAcknowledgment.create({
        data: {
          idempotencyKey: parsed.idempotencyKey,
          assignmentId: assignment.id,
          finalSnapshotId: snapshot.id,
          actorId: parsed.actorId,
          kind: parsed.kind,
          reservation: parsed.reservation ?? null,
          recordedAt,
        },
      });
      const advanced = await transaction.evaluationAssignment.updateMany({
        where: { id: assignment.id, version: parsed.expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (advanced.count !== 1) throw finalizationError("VERSION_CONFLICT", 409);
      await this.#audit.append(transaction, {
        eventType: "evaluation.acknowledgment.recorded",
        actor: { kind: "human", id: parsed.actorId },
        effectiveSubjectId: assignment.employeeId,
        scopeType: "cycle",
        scopeId: assignment.cycleId,
        targetType: "evaluation_acknowledgment",
        targetId: acknowledgment.id,
        safeDiff: {
          kind: acknowledgment.kind,
          reservationPreserved: acknowledgment.reservation !== null,
          finalJudgmentUnchanged: true,
        },
        correlationId: parsed.idempotencyKey,
        source: "api",
      });
      return serializeAcknowledgment(acknowledgment);
    });
  }

  async close(input: unknown): Promise<ClosedEmployeeEvaluationCycleReceipt> {
    const parsed = CloseEmployeeEvaluationCycleInputSchema.parse(input);
    const closedAt = validDate(this.#clock());
    return serializable(this.#database, async (transaction) => {
      const duplicate = await transaction.employeeEvaluationCycleTransition.findUnique({
        where: { idempotencyKey: parsed.idempotencyKey },
        include: { cycle: true },
      });
      if (duplicate !== null) {
        if (
          duplicate.cycleId !== parsed.cycleId ||
          duplicate.actorId !== parsed.actorId ||
          duplicate.fromState !== "ACKNOWLEDGMENT" ||
          duplicate.toState !== "CLOSED" ||
          duplicate.reason !== parsed.reason ||
          duplicate.resultingVersion !== parsed.expectedVersion + 1
        ) {
          throw finalizationError("IDEMPOTENCY_KEY_REUSED", 409);
        }
        return serializeClosedCycle(duplicate.cycle);
      }

      const cycle = await transaction.employeeEvaluationCycle.findUnique({
        where: { id: parsed.cycleId },
        include: { assignments: { include: { finalSnapshot: true } } },
      });
      if (cycle === null) throw finalizationError("EVALUATION_CYCLE_NOT_FOUND", 404);
      if (cycle.state !== "ACKNOWLEDGMENT") {
        throw finalizationError("EVALUATION_CLOSURE_STAGE_INVALID", 409);
      }
      if (cycle.version !== parsed.expectedVersion)
        throw finalizationError("VERSION_CONFLICT", 409);
      const eligible = cycle.assignments.filter(
        ({ eligibilityState }) => eligibilityState === "ELIGIBLE",
      );
      if (cycle.createdById !== parsed.actorId) {
        throw finalizationError("AUTHZ_SCOPE", 403);
      }
      if (eligible.some(({ finalSnapshot }) => finalSnapshot === null)) {
        throw finalizationError("EVALUATION_FINALIZATION_INCOMPLETE", 409);
      }

      await transaction.employeeEvaluationCycleTransition.create({
        data: {
          idempotencyKey: parsed.idempotencyKey,
          cycleId: cycle.id,
          fromState: "ACKNOWLEDGMENT",
          toState: "CLOSED",
          reason: parsed.reason,
          actorId: parsed.actorId,
          resultingVersion: parsed.expectedVersion + 1,
          effectiveAt: closedAt,
        },
      });
      const advanced = await transaction.employeeEvaluationCycle.updateMany({
        where: { id: cycle.id, version: parsed.expectedVersion, state: "ACKNOWLEDGMENT" },
        data: { state: "CLOSED", version: { increment: 1 }, closedAt },
      });
      if (advanced.count !== 1) throw finalizationError("VERSION_CONFLICT", 409);
      await this.#audit.append(transaction, {
        eventType: "evaluation.cycle.closed",
        actor: { kind: "human", id: parsed.actorId },
        effectiveSubjectId: parsed.actorId,
        scopeType: "cycle",
        scopeId: cycle.id,
        targetType: "employee_evaluation_cycle",
        targetId: cycle.id,
        safeDiff: {
          fromState: "ACKNOWLEDGMENT",
          toState: "CLOSED",
          finalizedAssignmentCount: eligible.length,
          acknowledgmentRequiredForClosure: false,
        },
        correlationId: parsed.idempotencyKey,
        source: "api",
      });
      return {
        schemaVersion: 1,
        cycleId: cycle.id,
        state: "CLOSED",
        version: parsed.expectedVersion + 1,
        closedAt: closedAt.toISOString(),
      };
    });
  }
}

const assignmentInclude = {
  cycle: { include: { snapshot: true } },
} as const;

async function readAssignment(transaction: Transaction, assignmentId: string) {
  const assignment = await transaction.evaluationAssignment.findUnique({
    where: { id: assignmentId },
    include: assignmentInclude,
  });
  if (assignment === null) throw finalizationError("EVALUATION_ASSIGNMENT_NOT_FOUND", 404);
  return assignment;
}

const finalInclude = {
  decisions: { orderBy: { position: "asc" as const } },
  cycle: { select: { closedAt: true } },
} as const;

async function readFinalByIdempotencyKey(transaction: Transaction, idempotencyKey: string) {
  return transaction.finalEvaluationSnapshot.findUnique({
    where: { idempotencyKey },
    include: finalInclude,
  });
}

async function readFinalByAssignment(transaction: Transaction, assignmentId: string) {
  return transaction.finalEvaluationSnapshot.findUnique({
    where: { assignmentId },
    include: finalInclude,
  });
}

function assertFrozenTemplate(
  items: ReadonlyArray<{ kind: "FIXED_CRITERION" | "PROJECT_CONTRIBUTION"; mandatory: boolean }>,
): void {
  if (
    items.length !== 13 ||
    items.filter(({ kind }) => kind === "FIXED_CRITERION").length !== 12 ||
    items.filter(({ kind }) => kind === "PROJECT_CONTRIBUTION").length !== 1 ||
    items.some(({ mandatory }) => !mandatory)
  ) {
    throw finalizationError("EVALUATION_TEMPLATE_SNAPSHOT_INVALID", 409);
  }
}

function assertCompleteFinalEntries(
  entries: ReadonlyArray<{ criterionId: string }>,
  items: ReadonlyArray<{ id: string }>,
): void {
  if (
    !sameIds(
      entries.map(({ criterionId }) => criterionId),
      items.map(({ id }) => id),
    )
  ) {
    throw finalizationError("EVALUATION_FINAL_ENTRIES_INCOMPLETE");
  }
}

function assertCompleteSubmittedEntries(
  entries: ReadonlyArray<{ criterionId: string }>,
  items: ReadonlyArray<{ id: string }>,
): void {
  if (
    !sameIds(
      entries.map(({ criterionId }) => criterionId),
      items.map(({ id }) => id),
    )
  ) {
    throw finalizationError("EVALUATION_SUBMISSION_CRITERIA_INVALID", 409);
  }
}

function sameIds(left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean {
  return (
    new Set(left).size === left.length &&
    new Set(right).size === right.length &&
    [...left].sort().join("\0") === [...right].sort().join("\0")
  );
}

function assertSameFinalization(
  snapshot: Awaited<ReturnType<typeof readFinalByAssignment>> extends infer T
    ? NonNullable<T>
    : never,
  input: z.infer<typeof FinalizeEmployeeEvaluationInputSchema>,
): void {
  const entries = snapshot.decisions.map((decision) => ({
    criterionId: decision.templateItemId,
    rating: decision.rating,
    justification: decision.justification,
    sourceReferences: z.array(z.string().uuid()).parse(decision.sourceReferences),
    managerInitialChangeReason: decision.managerInitialChangeReason,
  }));
  if (
    snapshot.assignmentId !== input.assignmentId ||
    snapshot.managerId !== input.managerId ||
    snapshot.finalComment !== input.finalComment ||
    JSON.stringify(entries) !== JSON.stringify(input.entries)
  ) {
    throw finalizationError(
      snapshot.idempotencyKey === input.idempotencyKey
        ? "IDEMPOTENCY_KEY_REUSED"
        : "EVALUATION_FINAL_SNAPSHOT_IMMUTABLE",
      409,
    );
  }
}

function serializeFinalSnapshot(
  snapshot: Awaited<ReturnType<typeof readFinalByAssignment>> extends infer T
    ? NonNullable<T>
    : never,
): import("@evaluation/contracts").FinalEvaluationSnapshot {
  return FinalEvaluationSnapshotSchema.parse({
    schemaVersion: 1,
    id: snapshot.id,
    assignmentId: snapshot.assignmentId,
    cycleId: snapshot.cycleId,
    employeeId: snapshot.employeeId,
    managerId: snapshot.managerId,
    templateVersionId: snapshot.templateVersionId,
    cycleType: snapshot.cycleType,
    entries: snapshot.decisions.map((decision) => ({
      criterionId: decision.templateItemId,
      rating: decision.rating,
      justification: decision.justification,
      sourceReferences: decision.sourceReferences,
      managerInitialChangeReason: decision.managerInitialChangeReason,
    })),
    finalComment: snapshot.finalComment,
    finalizedAt: snapshot.finalizedAt.toISOString(),
    closedAt: snapshot.cycle.closedAt?.toISOString() ?? null,
    version: snapshot.version,
  });
}

function assertSameAcknowledgment(
  acknowledgment: {
    assignmentId: string;
    actorId: string;
    idempotencyKey: string;
    kind: import("@evaluation/contracts").AcknowledgmentKind;
    reservation: string | null;
  },
  input: z.infer<typeof EvaluationAcknowledgmentInputSchema>,
): void {
  if (
    acknowledgment.assignmentId !== input.assignmentId ||
    acknowledgment.actorId !== input.actorId ||
    acknowledgment.kind !== input.kind ||
    acknowledgment.reservation !== (input.reservation ?? null)
  ) {
    throw finalizationError(
      acknowledgment.idempotencyKey === input.idempotencyKey
        ? "IDEMPOTENCY_KEY_REUSED"
        : "EVALUATION_ACKNOWLEDGMENT_IMMUTABLE",
      409,
    );
  }
}

function serializeAcknowledgment(acknowledgment: {
  id: string;
  assignmentId: string;
  finalSnapshotId: string;
  kind: import("@evaluation/contracts").AcknowledgmentKind;
  reservation: string | null;
  recordedAt: Date;
}): EvaluationAcknowledgmentReceipt {
  return {
    schemaVersion: 1,
    id: acknowledgment.id,
    assignmentId: acknowledgment.assignmentId,
    finalSnapshotId: acknowledgment.finalSnapshotId,
    kind: acknowledgment.kind,
    reservation: acknowledgment.reservation,
    recordedAt: acknowledgment.recordedAt.toISOString(),
  };
}

function serializeClosedCycle(cycle: {
  id: string;
  state: string;
  version: number;
  closedAt: Date | null;
}): ClosedEmployeeEvaluationCycleReceipt {
  if (cycle.state !== "CLOSED" || cycle.closedAt === null) {
    throw finalizationError("EVALUATION_CLOSURE_RECEIPT_INVALID", 500);
  }
  return {
    schemaVersion: 1,
    cycleId: cycle.id,
    state: "CLOSED",
    version: cycle.version,
    closedAt: cycle.closedAt.toISOString(),
  };
}

function validDate(value: Date): Date {
  if (!Number.isFinite(value.getTime())) throw finalizationError("EVALUATION_TIME_INVALID");
  return value;
}

function finalizationError(code: string, status = 400): AppError {
  return new AppError(code, "errors.evaluation.finalizationInvalid", status);
}

async function serializable<T>(
  database: Database,
  operation: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await database.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      if (attempt < 4 && isRetryable(error)) continue;
      throw error;
    }
  }
  throw new Error("Unreachable employee finalization retry state");
}

function isRetryable(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    ["P2034", "P2002"].includes(String((error as { code?: unknown }).code))
  );
}
