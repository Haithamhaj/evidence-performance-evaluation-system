import { databaseAuditWriter } from "@evaluation/audit";
import {
  AppError,
  OpenEmployeeEvaluationCycleInputSchema,
  RecordEvaluationEligibilityDecisionInputSchema,
  TransitionEmployeeEvaluationCycleInputSchema,
} from "@evaluation/contracts";

type Database = import("@evaluation/database").DatabaseClient;
type Transaction = import("./ports.js").EvaluationTransaction;
type Audit = import("@evaluation/contracts").AuditWriter<Transaction>;
type CycleState = import("@evaluation/contracts").EvaluationCycleState;
type EligibilityState = "ELIGIBLE" | "EXCLUDED" | "APPROVED_LEAVE" | "PENDING_REVIEW";

const NEXT_STATE: Readonly<Partial<Record<CycleState, CycleState>>> = {
  DRAFT: "OPEN_PREPARATION",
  OPEN_PREPARATION: "SELF_ASSESSMENT",
  SELF_ASSESSMENT: "MANAGER_ASSESSMENT",
  MANAGER_ASSESSMENT: "COMPARISON",
  COMPARISON: "FINALIZATION",
  FINALIZATION: "ACKNOWLEDGMENT",
  ACKNOWLEDGMENT: "CLOSED",
};

export class EmployeeEvaluationCycleService {
  readonly #database: Database;
  readonly #eligibilityReader: import("./ports.js").EligibilitySnapshotReader;
  readonly #audit: Audit;
  readonly #clock: () => Date;

  constructor(
    database: Database,
    eligibilityReader: import("./ports.js").EligibilitySnapshotReader,
    audit: Audit = databaseAuditWriter as Audit,
    clock: () => Date = () => new Date(),
  ) {
    this.#database = database;
    this.#eligibilityReader = eligibilityReader;
    this.#audit = audit;
    this.#clock = clock;
  }

  async openCycle(input: unknown): Promise<OpenedEmployeeEvaluationCycle> {
    const parsed = OpenEmployeeEvaluationCycleInputSchema.parse(input);
    const openedAt = validDate(this.#clock());
    if (!isQuarter(parsed.startsAt, parsed.endsAt)) {
      throw cycleError("EVALUATION_CYCLE_CADENCE_INVALID");
    }
    return serializable(this.#database, async (transaction) => {
      const duplicate = await transaction.employeeEvaluationCycle.findUnique({
        where: { idempotencyKey: parsed.idempotencyKey },
        include: cycleInclude,
      });
      if (duplicate !== null) {
        assertSameOpenCommand(duplicate, parsed);
        return serializeCycle(duplicate);
      }
      if (parsed.expectedVersion !== 1) throw cycleError("VERSION_CONFLICT", 409);

      const latest = await transaction.employeeEvaluationCycle.findFirst({
        where: { departmentId: parsed.departmentId },
        orderBy: { sequence: "desc" },
        select: { sequence: true },
      });
      const sequence = (latest?.sequence ?? 0) + 1;
      if (sequence === 1 && parsed.cycleType !== "CALIBRATION_NON_BASELINE") {
        throw cycleError("EVALUATION_CYCLE_ONE_TYPE_INVALID");
      }

      const template = await transaction.evaluationTemplateVersion.findUnique({
        where: { id: parsed.templateVersionId },
        include: {
          template: true,
          items: { include: { locales: true }, orderBy: { displayOrder: "asc" } },
        },
      });
      if (
        template === null ||
        template.status !== "ACTIVE" ||
        template.template.organizationId !== parsed.organizationId ||
        (template.template.scope === "DEPARTMENT" &&
          template.template.departmentId !== parsed.departmentId)
      ) {
        throw cycleError("EVALUATION_TEMPLATE_ACTIVE_VERSION_REQUIRED", 409);
      }
      const templatePolicy = jsonObject(template.evaluationPolicy);
      if (
        templatePolicy.cadence !== "QUARTERLY" ||
        templatePolicy.cycleOneType !== "CALIBRATION_NON_BASELINE"
      ) {
        throw cycleError("EVALUATION_TEMPLATE_POLICY_INVALID", 409);
      }

      const eligibility = await this.#eligibilityReader.readCycleEligibility(
        {
          organizationId: parsed.organizationId,
          departmentId: parsed.departmentId,
          actorId: parsed.actorId,
          startsAt: parsed.startsAt,
          endsAt: parsed.endsAt,
          reason: parsed.reason,
        },
        transaction,
      );
      assertEligibility(eligibility, parsed.startsAt, parsed.endsAt);

      const cycle = await transaction.employeeEvaluationCycle.create({
        data: {
          idempotencyKey: parsed.idempotencyKey,
          departmentId: parsed.departmentId,
          templateVersionId: template.id,
          sequence,
          cycleType: parsed.cycleType,
          state: "OPEN_PREPARATION",
          visibilityMode: eligibility.visibilityMode,
          startsAt: new Date(parsed.startsAt),
          endsAt: new Date(parsed.endsAt),
          version: 1,
          createdById: parsed.actorId,
          openedAt,
          snapshot: {
            create: {
              templateVersionId: template.id,
              rubricVersionId: template.rubricVersionId,
              eligibilitySnapshotId: eligibility.id,
              cycleType: parsed.cycleType,
              visibilityMode: eligibility.visibilityMode,
              startsAt: new Date(parsed.startsAt),
              endsAt: new Date(parsed.endsAt),
              ratingScale: template.ratingScale as never,
              templateSnapshot: snapshotTemplate(template) as never,
              localeAvailability: template.localeAvailability as never,
              configurationVersions: {
                templateVersion: template.version,
                templateVersionNumber: template.versionNumber,
                rubricVersionId: template.rubricVersionId,
                eligibilitySnapshotVersion: eligibility.version,
              },
            },
          },
          assignments: {
            create: eligibility.entries.map((entry) => ({
              employeeId: entry.employeeId,
              managerId: eligibility.managerId,
              eligibilityState: mapEligibility(entry.state),
              eligibilityReason: entry.sourceReason,
              eligibilityEffectiveAt: new Date(entry.effectiveFrom),
            })),
          },
        },
        include: cycleInclude,
      });
      await this.#audit.append(transaction, {
        eventType: "evaluation.cycle.opened",
        actor: { kind: "human", id: parsed.actorId },
        effectiveSubjectId: parsed.actorId,
        scopeType: "cycle",
        scopeId: cycle.id,
        targetType: "employee_evaluation_cycle",
        targetId: cycle.id,
        reason: parsed.reason,
        safeDiff: {
          sequence,
          cycleType: parsed.cycleType,
          state: cycle.state,
          templateVersionId: template.id,
          eligibilitySnapshotId: eligibility.id,
          visibilityMode: eligibility.visibilityMode,
        },
        correlationId: parsed.idempotencyKey,
        source: "api",
      });
      return serializeCycle(cycle as unknown as IncludedCycle);
    });
  }

  async transitionCycle(input: unknown): Promise<OpenedEmployeeEvaluationCycle> {
    const parsed = TransitionEmployeeEvaluationCycleInputSchema.parse(input);
    const effectiveAt = validDate(this.#clock());
    return serializable(this.#database, async (transaction) => {
      const duplicate = await transaction.employeeEvaluationCycleTransition.findUnique({
        where: { idempotencyKey: parsed.idempotencyKey },
        include: { cycle: { include: cycleInclude } },
      });
      if (duplicate !== null) {
        if (
          duplicate.cycleId !== parsed.cycleId ||
          duplicate.fromState !== parsed.fromState ||
          duplicate.toState !== parsed.toState ||
          duplicate.resultingVersion !== parsed.expectedVersion + 1
        ) {
          throw cycleError("IDEMPOTENCY_KEY_REUSED", 409);
        }
        return serializeCycle(duplicate.cycle);
      }
      const cycle = await transaction.employeeEvaluationCycle.findUnique({
        where: { id: parsed.cycleId },
      });
      if (cycle === null) throw cycleError("EVALUATION_CYCLE_NOT_FOUND", 404);
      if (cycle.version !== parsed.expectedVersion || cycle.state !== parsed.fromState) {
        throw cycleError("VERSION_CONFLICT", 409);
      }
      const allowed =
        parsed.toState === "CANCELLED"
          ? cycle.state !== "CLOSED"
          : NEXT_STATE[cycle.state] === parsed.toState;
      if (!allowed) throw cycleError("EVALUATION_CYCLE_TRANSITION_INVALID", 409);
      const advanced = await transaction.employeeEvaluationCycle.updateMany({
        where: { id: cycle.id, state: parsed.fromState, version: parsed.expectedVersion },
        data: {
          state: parsed.toState,
          version: { increment: 1 },
          ...(parsed.toState === "CLOSED" ? { closedAt: effectiveAt } : {}),
          ...(parsed.toState === "CANCELLED" ? { cancelledAt: effectiveAt } : {}),
        },
      });
      if (advanced.count !== 1) throw cycleError("VERSION_CONFLICT", 409);
      await transaction.employeeEvaluationCycleTransition.create({
        data: {
          idempotencyKey: parsed.idempotencyKey,
          cycleId: cycle.id,
          fromState: parsed.fromState,
          toState: parsed.toState,
          reason: parsed.reason,
          actorId: parsed.actorId,
          resultingVersion: parsed.expectedVersion + 1,
          effectiveAt,
        },
      });
      await this.#audit.append(transaction, {
        eventType: "evaluation.cycle.transitioned",
        actor: { kind: "human", id: parsed.actorId },
        effectiveSubjectId: parsed.actorId,
        scopeType: "cycle",
        scopeId: cycle.id,
        targetType: "employee_evaluation_cycle",
        targetId: cycle.id,
        reason: parsed.reason,
        safeDiff: {
          previous: { state: parsed.fromState, version: parsed.expectedVersion },
          next: { state: parsed.toState, version: parsed.expectedVersion + 1 },
        },
        correlationId: parsed.idempotencyKey,
        source: "api",
      });
      const updated = await transaction.employeeEvaluationCycle.findUniqueOrThrow({
        where: { id: cycle.id },
        include: cycleInclude,
      });
      return serializeCycle(updated);
    });
  }

  async recordEligibilityDecision(input: unknown): Promise<EvaluationAssignmentResult> {
    const parsed = RecordEvaluationEligibilityDecisionInputSchema.parse(input);
    return serializable(this.#database, async (transaction) => {
      const duplicate = await transaction.evaluationEligibilityDecision.findUnique({
        where: { idempotencyKey: parsed.idempotencyKey },
        include: { assignment: true },
      });
      if (duplicate !== null) {
        if (
          duplicate.assignmentId !== parsed.assignmentId ||
          duplicate.toState !== parsed.state ||
          duplicate.resultingVersion !== parsed.expectedVersion + 1 ||
          duplicate.assignment.employeeId !== parsed.employeeId
        ) {
          throw cycleError("IDEMPOTENCY_KEY_REUSED", 409);
        }
        return serializeAssignment(duplicate.assignment);
      }
      const assignment = await transaction.evaluationAssignment.findUnique({
        where: { id: parsed.assignmentId },
        include: { cycle: true },
      });
      if (assignment === null || assignment.employeeId !== parsed.employeeId) {
        throw cycleError("EVALUATION_ASSIGNMENT_NOT_FOUND", 404);
      }
      if (assignment.version !== parsed.expectedVersion) throw cycleError("VERSION_CONFLICT", 409);
      if (["CLOSED", "CANCELLED"].includes(assignment.cycle.state)) {
        throw cycleError("EVALUATION_CYCLE_IMMUTABLE", 409);
      }
      const effectiveAt = new Date(parsed.effectiveAt);
      if (
        effectiveAt < assignment.cycle.startsAt ||
        effectiveAt >= assignment.cycle.endsAt ||
        !isEligibilityTransitionAllowed(assignment.eligibilityState, parsed.state)
      ) {
        throw cycleError("EVALUATION_ELIGIBILITY_TRANSITION_INVALID", 409);
      }
      const advanced = await transaction.evaluationAssignment.updateMany({
        where: { id: assignment.id, version: parsed.expectedVersion },
        data: {
          eligibilityState: parsed.state,
          eligibilityReason: parsed.reason,
          eligibilityEffectiveAt: effectiveAt,
          version: { increment: 1 },
        },
      });
      if (advanced.count !== 1) throw cycleError("VERSION_CONFLICT", 409);
      await transaction.evaluationEligibilityDecision.create({
        data: {
          idempotencyKey: parsed.idempotencyKey,
          assignmentId: assignment.id,
          fromState: assignment.eligibilityState,
          toState: parsed.state,
          effectiveAt,
          reason: parsed.reason,
          actorId: parsed.actorId,
          resultingVersion: parsed.expectedVersion + 1,
        },
      });
      await this.#audit.append(transaction, {
        eventType: "evaluation.eligibility.decided",
        actor: { kind: "human", id: parsed.actorId },
        effectiveSubjectId: parsed.employeeId,
        scopeType: "cycle",
        scopeId: assignment.cycleId,
        targetType: "evaluation_assignment",
        targetId: assignment.id,
        reason: parsed.reason,
        safeDiff: {
          previous: { state: assignment.eligibilityState, version: assignment.version },
          next: { state: parsed.state, version: assignment.version + 1 },
          effectiveAt: parsed.effectiveAt,
        },
        correlationId: parsed.idempotencyKey,
        source: "api",
      });
      const updated = await transaction.evaluationAssignment.findUniqueOrThrow({
        where: { id: assignment.id },
      });
      return serializeAssignment(updated);
    });
  }
}

const cycleInclude = {
  snapshot: true,
  assignments: { orderBy: { createdAt: "asc" as const } },
} as const;

type IncludedCycle = Awaited<
  ReturnType<Database["employeeEvaluationCycle"]["findUniqueOrThrow"]>
> & {
  snapshot: {
    id: string;
    cycleType: "CALIBRATION_NON_BASELINE" | "STANDARD";
    visibilityMode: "identified" | "manager_blinded" | "anonymous_aggregated";
    ratingScale: unknown;
    templateSnapshot: unknown;
    localeAvailability: unknown;
    configurationVersions: unknown;
  } | null;
  assignments: ReadonlyArray<{
    id: string;
    employeeId: string;
    managerId: string;
    eligibilityState: EligibilityState;
    eligibilityReason: string;
    eligibilityEffectiveAt: Date;
    version: number;
  }>;
};

export type EvaluationAssignmentResult = Readonly<{
  id: string;
  employeeId: string;
  managerId: string;
  eligibilityState: EligibilityState;
  eligibilityReason: string;
  eligibilityEffectiveAt: string;
  version: number;
}>;

export type OpenedEmployeeEvaluationCycle = Readonly<{
  id: string;
  departmentId: string;
  templateVersionId: string;
  sequence: number;
  cycleType: "CALIBRATION_NON_BASELINE" | "STANDARD";
  state: CycleState;
  startsAt: string;
  endsAt: string;
  version: number;
  snapshot: Readonly<{
    id: string;
    cycleType: "CALIBRATION_NON_BASELINE" | "STANDARD";
    visibilityMode: "identified" | "manager_blinded" | "anonymous_aggregated";
    ratingScale: unknown;
    templateSnapshot: unknown;
    localeAvailability: unknown;
    configurationVersions: unknown;
  }>;
  assignments: ReadonlyArray<EvaluationAssignmentResult>;
}>;

function serializeCycle(cycle: IncludedCycle): OpenedEmployeeEvaluationCycle {
  if (cycle.snapshot === null)
    throw new Error("Opened evaluation cycle is missing its frozen snapshot");
  return {
    id: cycle.id,
    departmentId: cycle.departmentId,
    templateVersionId: cycle.templateVersionId,
    sequence: cycle.sequence,
    cycleType: cycle.cycleType,
    state: cycle.state,
    startsAt: cycle.startsAt.toISOString(),
    endsAt: cycle.endsAt.toISOString(),
    version: cycle.version,
    snapshot: {
      id: cycle.snapshot.id,
      cycleType: cycle.snapshot.cycleType,
      visibilityMode: cycle.snapshot.visibilityMode,
      ratingScale: cycle.snapshot.ratingScale,
      templateSnapshot: cycle.snapshot.templateSnapshot,
      localeAvailability: cycle.snapshot.localeAvailability,
      configurationVersions: cycle.snapshot.configurationVersions,
    },
    assignments: cycle.assignments.map(serializeAssignment),
  };
}

function serializeAssignment(assignment: {
  id: string;
  employeeId: string;
  managerId: string;
  eligibilityState: EligibilityState;
  eligibilityReason: string;
  eligibilityEffectiveAt: Date;
  version: number;
}): EvaluationAssignmentResult {
  return {
    id: assignment.id,
    employeeId: assignment.employeeId,
    managerId: assignment.managerId,
    eligibilityState: assignment.eligibilityState,
    eligibilityReason: assignment.eligibilityReason,
    eligibilityEffectiveAt: assignment.eligibilityEffectiveAt.toISOString(),
    version: assignment.version,
  };
}

function snapshotTemplate(template: {
  id: string;
  versionNumber: number;
  schemaVersion: number;
  weightPolicy: unknown;
  evaluationPolicy: unknown;
  items: ReadonlyArray<{
    id: string;
    stableCriterionId: string;
    kind: "FIXED_CRITERION" | "PROJECT_CONTRIBUTION";
    sectionStableId: string;
    sectionWeight: number;
    criterionWeight: number | null;
    displayOrder: number;
    protectedGlobal: boolean;
    mandatory: boolean;
    locales: ReadonlyArray<{
      locale: string;
      title: string;
      definition: string;
      anchors: unknown;
      examples: unknown;
      evidenceGuidance: unknown;
    }>;
  }>;
}): Record<string, unknown> {
  return {
    id: template.id,
    versionNumber: template.versionNumber,
    schemaVersion: template.schemaVersion,
    weightPolicy: template.weightPolicy,
    evaluationPolicy: template.evaluationPolicy,
    items: template.items.map((item) => ({
      id: item.id,
      stableCriterionId: item.stableCriterionId,
      kind: item.kind,
      sectionStableId: item.sectionStableId,
      sectionWeight: item.sectionWeight,
      criterionWeight: item.criterionWeight,
      displayOrder: item.displayOrder,
      protectedGlobal: item.protectedGlobal,
      mandatory: item.mandatory,
      locales: item.locales.map((locale) => ({
        locale: locale.locale,
        title: locale.title,
        definition: locale.definition,
        anchors: locale.anchors,
        examples: locale.examples,
        evidenceGuidance: locale.evidenceGuidance,
      })),
    })),
  };
}

function assertEligibility(
  eligibility: import("./ports.js").CycleEligibilitySnapshot,
  startsAt: string,
  endsAt: string,
): void {
  const cycleStart = Date.parse(startsAt);
  const cycleEnd = Date.parse(endsAt);
  if (
    eligibility.visibilityMode !== "identified" ||
    Date.parse(eligibility.effectiveFrom) !== cycleStart ||
    Date.parse(eligibility.effectiveTo) !== cycleEnd ||
    !Number.isInteger(eligibility.version) ||
    eligibility.version < 1
  ) {
    throw cycleError("EVALUATION_ELIGIBILITY_SNAPSHOT_INVALID");
  }
  const employees = eligibility.entries.map(({ employeeId }) => employeeId);
  if (new Set(employees).size !== employees.length) {
    throw cycleError("EVALUATION_ELIGIBILITY_SNAPSHOT_INVALID");
  }
  for (const entry of eligibility.entries) {
    const entryStart = Date.parse(entry.effectiveFrom);
    const entryEnd = Date.parse(entry.effectiveTo);
    if (
      !Number.isFinite(entryStart) ||
      !Number.isFinite(entryEnd) ||
      entryStart < cycleStart ||
      entryEnd > cycleEnd ||
      entryStart >= entryEnd
    ) {
      throw cycleError("EVALUATION_ELIGIBILITY_SNAPSHOT_INVALID");
    }
  }
}

function assertSameOpenCommand(
  cycle: {
    departmentId: string;
    templateVersionId: string;
    cycleType: "CALIBRATION_NON_BASELINE" | "STANDARD";
    startsAt: Date;
    endsAt: Date;
    createdById: string;
  },
  input: {
    departmentId: string;
    templateVersionId: string;
    cycleType: "CALIBRATION_NON_BASELINE" | "STANDARD";
    startsAt: string;
    endsAt: string;
    actorId: string;
  },
): void {
  if (
    cycle.departmentId !== input.departmentId ||
    cycle.templateVersionId !== input.templateVersionId ||
    cycle.cycleType !== input.cycleType ||
    cycle.startsAt.getTime() !== new Date(input.startsAt).getTime() ||
    cycle.endsAt.getTime() !== new Date(input.endsAt).getTime() ||
    cycle.createdById !== input.actorId
  ) {
    throw cycleError("IDEMPOTENCY_KEY_REUSED", 409);
  }
}

function mapEligibility(
  state: import("./ports.js").CycleEligibilitySnapshot["entries"][number]["state"],
): EligibilityState {
  return {
    active: "ELIGIBLE",
    excluded: "EXCLUDED",
    approved_leave: "APPROVED_LEAVE",
    pending: "PENDING_REVIEW",
  }[state] as EligibilityState;
}

function isEligibilityTransitionAllowed(from: EligibilityState, to: EligibilityState): boolean {
  const allowed: Readonly<Record<EligibilityState, ReadonlyArray<EligibilityState>>> = {
    ELIGIBLE: ["APPROVED_LEAVE", "EXCLUDED", "PENDING_REVIEW"],
    PENDING_REVIEW: ["ELIGIBLE", "APPROVED_LEAVE", "EXCLUDED"],
    APPROVED_LEAVE: ["ELIGIBLE", "EXCLUDED"],
    EXCLUDED: [],
  };
  return allowed[from].includes(to);
}

function isQuarter(startsAt: string, endsAt: string): boolean {
  const start = new Date(startsAt);
  const expected = new Date(start);
  expected.setUTCMonth(expected.getUTCMonth() + 3);
  return expected.getTime() === new Date(endsAt).getTime();
}

function validDate(value: Date): Date {
  if (!Number.isFinite(value.getTime())) throw cycleError("EVALUATION_TIME_INVALID");
  return value;
}

function jsonObject(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {};
}

function cycleError(code: string, status = 400): AppError {
  return new AppError(code, "errors.evaluation.cycleInvalid", status);
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
  throw new Error("Unreachable employee evaluation cycle retry state");
}

function isRetryable(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    ["P2034", "P2002"].includes(String((error as { code?: unknown }).code))
  );
}
