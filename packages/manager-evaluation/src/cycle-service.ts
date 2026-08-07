import { databaseAuditWriter } from "@evaluation/audit";
import {
  AppError,
  OpenManagerEvaluationCycleInputSchema,
  RecordManagerEvaluationEligibilityDecisionInputSchema,
} from "@evaluation/contracts";

type Database = import("@evaluation/database").DatabaseClient;
type Transaction = import("./ports.js").ManagerEvaluationTransaction;
type Audit = import("@evaluation/contracts").AuditWriter<Transaction>;

export class ManagerEvaluationCycleService {
  readonly #database: Database;
  readonly #boundary: import("./ports.js").FrozenEmployeeEvaluationBoundaryReader;
  readonly #audit: Audit;
  readonly #clock: () => Date;

  constructor(
    database: Database,
    boundary: import("./ports.js").FrozenEmployeeEvaluationBoundaryReader,
    audit: Audit = databaseAuditWriter as Audit,
    clock: () => Date = () => new Date(),
  ) {
    this.#database = database;
    this.#boundary = boundary;
    this.#audit = audit;
    this.#clock = clock;
  }

  async open(input: unknown): Promise<OpenedManagerEvaluationCycle> {
    const parsed = OpenManagerEvaluationCycleInputSchema.parse(input);
    const openedAt = validDate(this.#clock());
    return serializable(this.#database, async (transaction) => {
      const duplicate = await transaction.managerEvaluationCycle.findUnique({
        where: { idempotencyKey: parsed.idempotencyKey },
        include: cycleInclude,
      });
      if (duplicate !== null) {
        if (
          duplicate.employeeEvaluationCycleId !== parsed.employeeEvaluationCycleId ||
          duplicate.managerId !== parsed.managerId
        ) {
          throw failure("IDEMPOTENCY_KEY_REUSED", 409);
        }
        return serializeCycle(duplicate);
      }
      if (parsed.expectedVersion !== 1) throw failure("VERSION_CONFLICT", 409);
      const boundary = await this.#boundary.read(transaction, parsed.employeeEvaluationCycleId);
      if (
        boundary === null ||
        boundary.cycleId !== parsed.employeeEvaluationCycleId ||
        boundary.departmentId !== parsed.departmentId ||
        boundary.managerId !== parsed.managerId ||
        boundary.rubricVersionId !== parsed.rubricVersionId ||
        boundary.startsAt !== parsed.startsAt ||
        boundary.endsAt !== parsed.endsAt
      ) {
        throw failure("MANAGER_EVALUATION_BOUNDARY_MISMATCH", 409);
      }
      if (boundary.entries.some((entry) => entry.employeeId === parsed.managerId)) {
        throw failure("MANAGER_EVALUATION_MANAGER_INELIGIBLE", 409);
      }
      const template = await transaction.managerEvaluationTemplateVersion.findFirst({
        where: {
          rubricVersionId: parsed.rubricVersionId,
          status: "ACTIVE",
          template: { departmentId: parsed.departmentId },
        },
        include: {
          template: true,
          criteria: { orderBy: { displayOrder: "asc" } },
        },
        orderBy: { versionNumber: "desc" },
      });
      if (template === null || template.criteria.length !== 5) {
        throw failure("MANAGER_EVALUATION_TEMPLATE_REQUIRED", 409);
      }
      const policy = await transaction.managerEvaluationVisibilityPolicy.findUnique({
        where: {
          organizationId_mode_version: {
            organizationId: template.template.organizationId,
            mode: "IDENTIFIED",
            version: parsed.visibilityPolicyVersion,
          },
        },
      });
      if (
        policy === null ||
        !policy.enabled ||
        !policy.managerCanReadIdentity ||
        !policy.managerCanReadOriginals ||
        !policy.immediateVisibility
      ) {
        throw failure("MANAGER_EVALUATION_VISIBILITY_DISABLED", 403);
      }
      const criteriaSnapshot = template.criteria.map((criterion) => ({
        criterionId: criterion.id,
        stableCriterionId: criterion.stableCriterionId,
        commentRequired: criterion.commentRequired || template.commentRequired,
        anchorSnapshot: criterion.anchorSnapshot,
      }));
      const cycle = await transaction.managerEvaluationCycle.create({
        data: {
          idempotencyKey: parsed.idempotencyKey,
          employeeEvaluationCycleId: parsed.employeeEvaluationCycleId,
          departmentId: parsed.departmentId,
          managerId: parsed.managerId,
          templateVersionId: template.id,
          visibilityMode: "IDENTIFIED",
          state: "OPEN",
          startsAt: new Date(parsed.startsAt),
          endsAt: new Date(parsed.endsAt),
          version: 1,
          createdById: parsed.actorId,
          openedAt,
          snapshot: {
            create: {
              departmentId: parsed.departmentId,
              managerId: parsed.managerId,
              templateVersionId: template.id,
              rubricVersionId: parsed.rubricVersionId,
              visibilityPolicyId: policy.id,
              visibilityMode: "IDENTIFIED",
              visibilityPolicyEnabled: true,
              startsAt: new Date(parsed.startsAt),
              endsAt: new Date(parsed.endsAt),
              ratingScale: template.ratingScale as never,
              criteriaSnapshot: criteriaSnapshot as never,
              eligibilityRuleSnapshot: {
                source: "employee-evaluation-cycle-snapshot",
                employeeEvaluationCycleId: parsed.employeeEvaluationCycleId,
              },
              localeAvailability: template.localeAvailability as never,
            },
          },
          eligibilities: {
            create: boundary.entries.map((entry) => ({
              evaluatorId: entry.employeeId,
              state: mapState(entry.state),
              reason: entry.reason,
              relationshipSnapshot: {
                managerId: parsed.managerId,
                departmentId: parsed.departmentId,
                evaluatorDisplayName: entry.employeeDisplayName,
              },
              leaveSnapshot: { employeeEvaluationState: entry.state },
              effectiveAt: new Date(entry.effectiveAt),
            })),
          },
        },
        include: cycleInclude,
      });
      await this.#audit.append(transaction, {
        eventType: "manager_evaluation.cycle.opened",
        actor: { kind: "human", id: parsed.actorId },
        effectiveSubjectId: parsed.managerId,
        scopeType: "cycle",
        scopeId: cycle.id,
        targetType: "manager_evaluation_cycle",
        targetId: cycle.id,
        reason: parsed.reason,
        safeDiff: {
          visibilityMode: "IDENTIFIED",
          evaluatorCount: boundary.entries.length,
          rubricVersionId: parsed.rubricVersionId,
        },
        correlationId: parsed.idempotencyKey,
        source: "api",
      });
      return serializeCycle(cycle);
    });
  }

  async recordEligibilityDecision(input: unknown): Promise<ManagerEvaluatorEligibilityResult> {
    const parsed = RecordManagerEvaluationEligibilityDecisionInputSchema.parse(input);
    return serializable(this.#database, async (transaction) => {
      const duplicate = await transaction.managerEvaluatorEligibilityDecision.findUnique({
        where: { idempotencyKey: parsed.idempotencyKey },
        include: { eligibility: true },
      });
      if (duplicate !== null) {
        if (
          duplicate.eligibility.cycleId !== parsed.cycleId ||
          duplicate.eligibility.evaluatorId !== parsed.evaluatorId ||
          duplicate.toState !== parsed.state
        ) {
          throw failure("IDEMPOTENCY_KEY_REUSED", 409);
        }
        return serializeEligibility(duplicate.eligibility);
      }
      const eligibility = await transaction.managerEvaluatorEligibility.findUnique({
        where: {
          cycleId_evaluatorId: { cycleId: parsed.cycleId, evaluatorId: parsed.evaluatorId },
        },
        include: { cycle: true },
      });
      if (eligibility === null) throw failure("MANAGER_EVALUATION_ELIGIBILITY_NOT_FOUND", 404);
      if (eligibility.cycle.state !== "OPEN")
        throw failure("MANAGER_EVALUATION_CYCLE_IMMUTABLE", 409);
      if (
        parsed.actorId !== eligibility.cycle.managerId &&
        parsed.actorId !== eligibility.cycle.createdById
      ) {
        throw failure("AUTHZ_SCOPE", 403);
      }
      if (eligibility.version !== parsed.expectedVersion) throw failure("VERSION_CONFLICT", 409);
      if (eligibility.state !== "ELIGIBLE_PENDING") {
        throw failure("MANAGER_EVALUATION_ELIGIBILITY_TRANSITION_INVALID", 409);
      }
      const advanced = await transaction.managerEvaluatorEligibility.updateMany({
        where: { id: eligibility.id, version: parsed.expectedVersion, state: "ELIGIBLE_PENDING" },
        data: {
          state: parsed.state,
          reason: parsed.reason,
          effectiveAt: new Date(parsed.effectiveAt),
          version: { increment: 1 },
        },
      });
      if (advanced.count !== 1) throw failure("VERSION_CONFLICT", 409);
      await transaction.managerEvaluatorEligibilityDecision.create({
        data: {
          idempotencyKey: parsed.idempotencyKey,
          eligibilityId: eligibility.id,
          fromState: eligibility.state,
          toState: parsed.state,
          reason: parsed.reason,
          effectiveAt: new Date(parsed.effectiveAt),
          actorId: parsed.actorId,
          resultingVersion: parsed.expectedVersion + 1,
        },
      });
      await this.#audit.append(transaction, {
        eventType: "manager_evaluation.eligibility.decided",
        actor: { kind: "human", id: parsed.actorId },
        effectiveSubjectId: parsed.evaluatorId,
        scopeType: "cycle",
        scopeId: parsed.cycleId,
        targetType: "manager_evaluator_eligibility",
        targetId: eligibility.id,
        reason: parsed.reason,
        safeDiff: { from: eligibility.state, to: parsed.state },
        correlationId: parsed.idempotencyKey,
        source: "api",
      });
      return serializeEligibility(
        await transaction.managerEvaluatorEligibility.findUniqueOrThrow({
          where: { id: eligibility.id },
        }),
      );
    });
  }
}

const cycleInclude = {
  snapshot: true,
  eligibilities: { orderBy: { createdAt: "asc" as const } },
} as const;

export type OpenedManagerEvaluationCycle = Readonly<{
  id: string;
  employeeEvaluationCycleId: string;
  departmentId: string;
  managerId: string;
  state: "DRAFT" | "OPEN" | "CLOSED" | "CANCELLED";
  visibilityMode: "IDENTIFIED";
  startsAt: string;
  endsAt: string;
  version: number;
  eligibilities: ReadonlyArray<ManagerEvaluatorEligibilityResult>;
}>;

export type ManagerEvaluatorEligibilityResult = Readonly<{
  id: string;
  evaluatorId: string;
  state:
    | "ELIGIBLE_PENDING"
    | "SUBMITTED"
    | "APPROVED_LEAVE"
    | "POSTPONED"
    | "EXCLUDED_BY_AUTHORIZED_MANAGER";
  version: number;
}>;

function serializeCycle(cycle: any): OpenedManagerEvaluationCycle {
  return {
    id: cycle.id,
    employeeEvaluationCycleId: cycle.employeeEvaluationCycleId,
    departmentId: cycle.departmentId,
    managerId: cycle.managerId,
    state: cycle.state,
    visibilityMode: "IDENTIFIED",
    startsAt: cycle.startsAt.toISOString(),
    endsAt: cycle.endsAt.toISOString(),
    version: cycle.version,
    eligibilities: cycle.eligibilities.map(serializeEligibility),
  };
}

function serializeEligibility(value: any): ManagerEvaluatorEligibilityResult {
  return {
    id: value.id,
    evaluatorId: value.evaluatorId,
    state: value.state,
    version: value.version,
  };
}

function mapState(
  state: import("./ports.js").FrozenEmployeeEvaluationBoundary["entries"][number]["state"],
): ManagerEvaluatorEligibilityResult["state"] {
  if (state === "ELIGIBLE") return "ELIGIBLE_PENDING";
  if (state === "APPROVED_LEAVE") return "APPROVED_LEAVE";
  if (state === "EXCLUDED") return "EXCLUDED_BY_AUTHORIZED_MANAGER";
  return "POSTPONED";
}

async function serializable<T>(
  database: Database,
  operation: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  return database.$transaction(operation, { isolationLevel: "Serializable" });
}

function validDate(value: Date): Date {
  if (!Number.isFinite(value.getTime())) throw failure("MANAGER_EVALUATION_CLOCK_INVALID", 500);
  return value;
}

function failure(code: string, status = 400): AppError {
  return new AppError(code, "errors.managerEvaluation.invalid", status);
}
