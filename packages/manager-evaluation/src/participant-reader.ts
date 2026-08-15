import { AppError, ManagerEvaluationParticipantJourneySchema } from "@evaluation/contracts";

type Database = import("@evaluation/database").DatabaseClient;

export class ManagerEvaluationParticipantReader {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async read(input: { cycleId: string; evaluatorId: string }) {
    const eligibility = await this.#database.managerEvaluatorEligibility.findUnique({
      where: {
        cycleId_evaluatorId: { cycleId: input.cycleId, evaluatorId: input.evaluatorId },
      },
      include: {
        evaluator: { select: { active: true, displayName: true } },
        cycle: {
          include: {
            manager: { select: { id: true, displayName: true } },
            snapshot: true,
          },
        },
        response: { include: { criterionResponses: { orderBy: { position: "asc" } } } },
      },
    });
    if (eligibility === null) throw failure("MANAGER_EVALUATION_ELIGIBILITY_NOT_FOUND", 404);
    if (!eligibility.evaluator.active) throw failure("AUTH_INACTIVE_USER", 403);
    if (eligibility.cycle.visibilityMode !== "IDENTIFIED" || eligibility.cycle.snapshot === null) {
      throw failure("MANAGER_EVALUATION_VISIBILITY_DISABLED", 403);
    }

    const snapshot = snapshotCriteria(eligibility.cycle.snapshot.criteriaSnapshot);
    const response = eligibility.response;
    return ManagerEvaluationParticipantJourneySchema.parse({
      schemaVersion: 1,
      cycle: {
        id: eligibility.cycle.id,
        state: eligibility.cycle.state,
        visibilityMode: "IDENTIFIED",
        startsAt: eligibility.cycle.startsAt.toISOString(),
        endsAt: eligibility.cycle.endsAt.toISOString(),
      },
      manager: eligibility.cycle.manager,
      eligibility: {
        id: eligibility.id,
        state: eligibility.state,
        version: eligibility.version,
      },
      criteria: snapshot,
      submittedResponse:
        response === null
          ? null
          : {
              schemaVersion: 1,
              responseId: response.id,
              cycleId: response.cycleId,
              managerId: response.managerId,
              submitterId: response.evaluatorId,
              submitterDisplayName: eligibility.evaluator.displayName,
              visibilityMode: "IDENTIFIED",
              state: "SUBMITTED",
              responses: response.criterionResponses.map((entry) => ({
                criterionId: entry.criterionId,
                rating: entry.rating,
                comment: entry.comment,
              })),
              submittedAt: response.submittedAt.toISOString(),
            },
    });
  }
}

function snapshotCriteria(value: unknown) {
  if (!Array.isArray(value) || value.length !== 5) {
    throw failure("MANAGER_EVALUATION_SNAPSHOT_INVALID", 500);
  }
  return value.map((entry) => {
    if (entry === null || typeof entry !== "object") {
      throw failure("MANAGER_EVALUATION_SNAPSHOT_INVALID", 500);
    }
    const item = entry as Record<string, unknown>;
    return {
      criterionId: item.criterionId,
      stableCriterionId: item.stableCriterionId,
      commentRequired: item.commentRequired,
      anchors: Array.isArray(item.anchorSnapshot)
        ? item.anchorSnapshot.map((anchor) => {
            if (anchor === null || typeof anchor !== "object") {
              throw failure("MANAGER_EVALUATION_SNAPSHOT_INVALID", 500);
            }
            const value = anchor as Record<string, unknown>;
            return { rating: value.rating, text: value.text };
          })
        : item.anchorSnapshot,
    };
  });
}

function failure(code: string, status: number) {
  return new AppError(code, "errors.managerEvaluation.unavailable", status);
}
