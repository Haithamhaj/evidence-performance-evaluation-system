import { AppError, AssessmentDraftSchema } from "@evaluation/contracts";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

type Database = import("@evaluation/database").DatabaseClient;

export class EmployeeEvaluationQueryService {
  private readonly database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  async readAssignment(input: AuthorizedAssignmentRead): Promise<unknown> {
    const assignment = await this.database.evaluationAssignment.findUnique({
      where: { id: input.assignmentId },
      include: { cycle: { include: { snapshot: true } } },
    });
    if (assignment === null) throw notFound();
    reauthorize(assignment, input);
    return {
      schemaVersion: 1 as const,
      id: assignment.id,
      cycleId: assignment.cycleId,
      employeeId: assignment.employeeId,
      managerId: assignment.managerId,
      eligibilityState: assignment.eligibilityState,
      version: assignment.version,
      cycle: {
        type: assignment.cycle.cycleType,
        state: assignment.cycle.state,
        startsAt: assignment.cycle.startsAt.toISOString(),
        endsAt: assignment.cycle.endsAt.toISOString(),
        version: assignment.cycle.version,
        localeAvailability: assignment.cycle.snapshot?.localeAvailability ?? [],
        templateSnapshot: assignment.cycle.snapshot?.templateSnapshot ?? null,
      },
    };
  }

  async readDraft(
    input: AuthorizedAssignmentRead & { kind: "SELF" | "MANAGER_INITIAL" },
  ): Promise<unknown> {
    const assignment = await this.database.evaluationAssignment.findUnique({
      where: { id: input.assignmentId },
    });
    if (assignment === null) throw notFound();
    reauthorize(assignment, input);
    if (
      (input.kind === "SELF" && input.access !== "self") ||
      (input.kind === "MANAGER_INITIAL" && input.access !== "assigned_manager")
    ) {
      throw forbidden();
    }
    const assessment = await this.database.assessment.findUnique({
      where: { assignmentId_kind: { assignmentId: assignment.id, kind: input.kind } },
      include: {
        revisions: { orderBy: { revision: "desc" }, take: 1 },
        submissions: { orderBy: { confirmedAt: "desc" }, take: 1 },
      },
    });
    if (assessment === null || assessment.revisions[0] === undefined) return null;
    const revision = assessment.revisions[0];
    return AssessmentDraftSchema.parse({
      schemaVersion: 1,
      id: assessment.id,
      assignmentId: assignment.id,
      kind: assessment.kind,
      version: assessment.version,
      entries: z.array(z.unknown()).parse(revision.entries),
      updatedAt: revision.createdAt.toISOString(),
      submittedAt: assessment.submissions[0]?.confirmedAt.toISOString() ?? null,
    });
  }

  async readCycleJourney(input: Readonly<{ cycleId: string; actorId: string }>): Promise<unknown> {
    const assignment = await this.database.evaluationAssignment.findFirst({
      where: {
        cycleId: input.cycleId,
        OR: [{ employeeId: input.actorId }, { managerId: input.actorId }],
      },
      include: {
        cycle: { include: { snapshot: true } },
        submissions: { include: { revision: true }, orderBy: { confirmedAt: "asc" } },
        discussionEntries: { orderBy: [{ resultingVersion: "asc" }, { id: "asc" }] },
        finalSnapshot: { include: { decisions: { orderBy: { position: "asc" } } } },
        acknowledgment: true,
      },
    });
    if (assignment === null) throw forbidden();
    const access = assignment.employeeId === input.actorId ? "self" : "assigned_manager";
    const managerSubmission = assignment.submissions.find(({ kind }) => kind === "MANAGER_INITIAL");
    const managerIndependenceProven =
      managerSubmission !== undefined && !managerSubmission.selfProjectionAccessedBeforeSubmit;
    const submissions = assignment.submissions
      .filter(({ kind }) => kind !== "SELF" || access === "self" || managerIndependenceProven)
      .map((submission) => ({
        kind: submission.kind,
        submittedAt: submission.confirmedAt.toISOString(),
        entries: submission.revision.entries,
      }));
    const reportSnapshot = record(assignment.finalSnapshot?.reportSnapshot);
    return {
      schemaVersion: 1 as const,
      audience: access,
      cycle: {
        id: assignment.cycle.id,
        type: assignment.cycle.cycleType,
        state: assignment.cycle.state,
        startsAt: assignment.cycle.startsAt.toISOString(),
        endsAt: assignment.cycle.endsAt.toISOString(),
        version: assignment.cycle.version,
      },
      assignment: {
        id: assignment.id,
        employeeId: assignment.employeeId,
        managerId: assignment.managerId,
        version: assignment.version,
      },
      templateSnapshot: assignment.cycle.snapshot?.templateSnapshot ?? null,
      factViewFirst: {
        responsibilityWindows: reportSnapshot.responsibilityWindows ?? [],
        workFacts: reportSnapshot.workFacts ?? [],
        researchFacts: reportSnapshot.researchFacts ?? [],
        sourceCoverageNotes: reportSnapshot.sourceCoverageNotes ?? [],
      },
      submissions,
      comparison: reportSnapshot.comparison ?? null,
      discussion: assignment.discussionEntries.map((entry) => ({
        id: entry.id,
        body: entry.body,
        sourceReferences: entry.sourceReferences,
        createdAt: entry.createdAt.toISOString(),
      })),
      finalDecision:
        assignment.finalSnapshot === null
          ? null
          : {
              humanManagerDecision: true as const,
              entries: assignment.finalSnapshot.decisions.map((decision) => ({
                criterionId: decision.templateItemId,
                rating: decision.rating,
                justification: decision.justification,
              })),
              finalComment: assignment.finalSnapshot.finalComment,
              finalizedAt: assignment.finalSnapshot.finalizedAt.toISOString(),
            },
      acknowledgment:
        assignment.acknowledgment === null
          ? null
          : {
              kind: assignment.acknowledgment.kind,
              reservation: assignment.acknowledgment.reservation,
              recordedAt: assignment.acknowledgment.recordedAt.toISOString(),
            },
      immutableClosedSnapshot:
        assignment.cycle.state === "CLOSED" && assignment.finalSnapshot !== null
          ? {
              id: assignment.finalSnapshot.id,
              schemaVersion: assignment.finalSnapshot.schemaVersion,
              closedAt: assignment.cycle.closedAt?.toISOString() ?? null,
            }
          : null,
      independenceGate: { managerSubmittedBeforeSelfProjection: managerIndependenceProven },
    };
  }
}

export type AuthorizedAssignmentRead = Readonly<{
  assignmentId: string;
  actorId: string;
  access: "self" | "assigned_manager";
}>;

function reauthorize(
  assignment: Readonly<{ employeeId: string; managerId: string }>,
  input: AuthorizedAssignmentRead,
) {
  const valid =
    (input.access === "self" && assignment.employeeId === input.actorId) ||
    (input.access === "assigned_manager" && assignment.managerId === input.actorId);
  if (!valid) throw forbidden();
}

function forbidden() {
  return new AppError("EMPLOYEE_EVALUATION_FORBIDDEN", "errors.evaluation.forbidden", 403);
}

function notFound() {
  return new AppError("EVALUATION_ASSIGNMENT_NOT_FOUND", "errors.evaluation.notFound", 404);
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

Injectable()(EmployeeEvaluationQueryService);
