import {
  AppError,
  DepartmentEvaluationReportProjectionSchema,
  EmployeeEvaluationReportProjectionSchema,
  FinalEvaluationReportContextSchema,
  FinalEvaluationSnapshotSchema,
} from "@evaluation/contracts";

type Database = import("@evaluation/database").DatabaseClient;

export class EvaluationReportReader {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async readEmployee(
    input: Readonly<{
      assignmentId: string;
      requester: Readonly<{ actorId: string; access: "self"; active: true }>;
    }>,
  ): Promise<import("@evaluation/contracts").EmployeeEvaluationReportProjection> {
    if (input.requester.access !== "self" || input.requester.active !== true) {
      throw reportError("AUTHZ_SCOPE", 403);
    }
    const assignment = await this.#database.evaluationAssignment.findUnique({
      where: { id: input.assignmentId },
      include: {
        cycle: true,
        finalSnapshot: {
          include: { decisions: { orderBy: { position: "asc" } } },
        },
        acknowledgment: true,
      },
    });
    if (assignment === null) throw reportError("EVALUATION_ASSIGNMENT_NOT_FOUND", 404);
    if (assignment.employeeId !== input.requester.actorId) {
      throw reportError("AUTHZ_SCOPE", 403);
    }
    return EmployeeEvaluationReportProjectionSchema.parse({
      schemaVersion: 2,
      assignmentId: assignment.id,
      employeeId: assignment.employeeId,
      cycleId: assignment.cycleId,
      cycleType: assignment.cycle.cycleType,
      state: assignment.cycle.state,
      period: {
        startsAt: assignment.cycle.startsAt.toISOString(),
        endsAt: assignment.cycle.endsAt.toISOString(),
      },
      finalSnapshot:
        assignment.finalSnapshot === null
          ? null
          : serializeSnapshot(assignment.finalSnapshot, assignment.cycle.closedAt),
      acknowledgment:
        assignment.acknowledgment === null
          ? null
          : {
              kind: assignment.acknowledgment.kind,
              reservation: assignment.acknowledgment.reservation,
              recordedAt: assignment.acknowledgment.recordedAt.toISOString(),
            },
    });
  }

  async readDepartment(
    input: Readonly<{
      cycleId: string;
      requester: Readonly<{
        actorId: string;
        departmentId: string;
        access: "assigned_manager";
        active: true;
      }>;
    }>,
  ): Promise<import("@evaluation/contracts").DepartmentEvaluationReportProjection> {
    if (input.requester.access !== "assigned_manager" || input.requester.active !== true) {
      throw reportError("AUTHZ_SCOPE", 403);
    }
    const cycle = await this.#database.employeeEvaluationCycle.findUnique({
      where: { id: input.cycleId },
      select: {
        id: true,
        departmentId: true,
        sequence: true,
        cycleType: true,
        state: true,
        startsAt: true,
        endsAt: true,
        assignments: {
          select: { managerId: true },
        },
      },
    });
    if (cycle === null) throw reportError("EVALUATION_CYCLE_NOT_FOUND", 404);
    if (
      cycle.departmentId !== input.requester.departmentId ||
      !cycle.assignments.some(({ managerId }) => managerId === input.requester.actorId)
    ) {
      throw reportError("AUTHZ_SCOPE", 403);
    }
    const trendCycles = await this.#database.employeeEvaluationCycle.findMany({
      where: { departmentId: cycle.departmentId, sequence: { lte: cycle.sequence } },
      select: {
        sequence: true,
        cycleType: true,
        startsAt: true,
        endsAt: true,
        assignments: {
          where: {
            managerId: input.requester.actorId,
            eligibilityState: "ELIGIBLE",
          },
          select: {
            finalSnapshot: {
              select: {
                decisions: { select: { stableCriterionId: true, rating: true } },
              },
            },
          },
        },
      },
      orderBy: { sequence: "asc" },
    });
    const trends = trendCycles
      .map((trendCycle) => ({
        sequence: trendCycle.sequence,
        cycleType: trendCycle.cycleType,
        period: {
          startsAt: trendCycle.startsAt.toISOString(),
          endsAt: trendCycle.endsAt.toISOString(),
        },
        ratingDistributions: ratingDistributions(trendCycle.assignments),
      }))
      .filter(({ ratingDistributions }) => ratingDistributions.length > 0);
    const currentTrend = trends.find(({ sequence }) => sequence === cycle.sequence);
    return DepartmentEvaluationReportProjectionSchema.parse({
      schemaVersion: 2,
      departmentId: cycle.departmentId,
      cycleId: cycle.id,
      cycleType: cycle.cycleType,
      state: cycle.state,
      period: {
        startsAt: cycle.startsAt.toISOString(),
        endsAt: cycle.endsAt.toISOString(),
      },
      ratingDistributions: currentTrend?.ratingDistributions ?? [],
      trends,
    });
  }
}

function serializeSnapshot(
  snapshot: Readonly<{
    id: string;
    assignmentId: string;
    cycleId: string;
    employeeId: string;
    managerId: string;
    templateVersionId: string;
    cycleType: "CALIBRATION_NON_BASELINE" | "STANDARD";
    finalComment: string | null;
    finalizedAt: Date;
    version: number;
    reportSnapshot: unknown;
    decisions: ReadonlyArray<
      Readonly<{
        templateItemId: string;
        rating: number;
        justification: string;
        sourceReferences: unknown;
        managerInitialChangeReason: string | null;
      }>
    >;
  }>,
  closedAt: Date | null,
): import("@evaluation/contracts").FinalEvaluationSnapshot {
  const reportSnapshot = FinalEvaluationReportContextSchema.parse(snapshot.reportSnapshot);
  return FinalEvaluationSnapshotSchema.parse({
    schemaVersion: 2,
    id: snapshot.id,
    assignmentId: snapshot.assignmentId,
    cycleId: snapshot.cycleId,
    employeeId: snapshot.employeeId,
    managerId: snapshot.managerId,
    templateVersionId: snapshot.templateVersionId,
    cycleType: snapshot.cycleType,
    ...reportSnapshot,
    entries: snapshot.decisions.map((decision) => ({
      criterionId: decision.templateItemId,
      rating: decision.rating,
      justification: decision.justification,
      sourceReferences: decision.sourceReferences,
      managerInitialChangeReason: decision.managerInitialChangeReason,
    })),
    finalComment: snapshot.finalComment,
    finalizedAt: snapshot.finalizedAt.toISOString(),
    closedAt: closedAt?.toISOString() ?? null,
    version: snapshot.version,
  });
}

function ratingDistributions(
  assignments: ReadonlyArray<
    Readonly<{
      finalSnapshot: Readonly<{
        decisions: ReadonlyArray<Readonly<{ stableCriterionId: string; rating: number }>>;
      }> | null;
    }>
  >,
) {
  const ratingsByCriterion = new Map<string, number[]>();
  for (const assignment of assignments) {
    for (const decision of assignment.finalSnapshot?.decisions ?? []) {
      const ratings = ratingsByCriterion.get(decision.stableCriterionId) ?? [];
      ratings.push(decision.rating);
      ratingsByCriterion.set(decision.stableCriterionId, ratings);
    }
  }
  return [...ratingsByCriterion.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([criterionStableId, ratings]) => ({
      criterionStableId,
      buckets: ([1, 2, 3, 4, 5] as const).map((rating) => ({
        rating,
        count: ratings.filter((value) => value === rating).length,
      })),
    }));
}

function reportError(code: string, status = 400): AppError {
  return new AppError(code, "errors.evaluation.reportUnavailable", status);
}
