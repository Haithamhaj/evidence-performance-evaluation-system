import {
  AppError,
  DepartmentEvaluationReportProjectionSchema,
  EmployeeEvaluationReportProjectionSchema,
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
      schemaVersion: 1,
      assignmentId: assignment.id,
      employeeId: assignment.employeeId,
      cycleId: assignment.cycleId,
      cycleType: assignment.cycle.cycleType,
      state: assignment.cycle.state,
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
        cycleType: true,
        state: true,
        assignments: {
          select: {
            managerId: true,
            eligibilityState: true,
            submissions: { select: { kind: true } },
            finalSnapshot: { select: { id: true } },
            acknowledgment: { select: { id: true } },
          },
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
    const eligible = cycle.assignments.filter(
      ({ eligibilityState, managerId }) =>
        eligibilityState === "ELIGIBLE" && managerId === input.requester.actorId,
    );
    return DepartmentEvaluationReportProjectionSchema.parse({
      schemaVersion: 1,
      departmentId: cycle.departmentId,
      cycleId: cycle.id,
      cycleType: cycle.cycleType,
      state: cycle.state,
      eligibleCount: eligible.length,
      submittedSelfAssessmentCount: eligible.filter(({ submissions }) =>
        submissions.some(({ kind }) => kind === "SELF"),
      ).length,
      submittedManagerAssessmentCount: eligible.filter(({ submissions }) =>
        submissions.some(({ kind }) => kind === "MANAGER_INITIAL"),
      ).length,
      finalizedCount: eligible.filter(({ finalSnapshot }) => finalSnapshot !== null).length,
      acknowledgedCount: eligible.filter(({ acknowledgment }) => acknowledgment !== null).length,
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
    closedAt: closedAt?.toISOString() ?? null,
    version: snapshot.version,
  });
}

function reportError(code: string, status = 400): AppError {
  return new AppError(code, "errors.evaluation.reportUnavailable", status);
}
