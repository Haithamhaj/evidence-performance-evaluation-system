import {
  AppError,
  ManagerEvaluationCompletionProjectionSchema,
} from "@evaluation/contracts";

type Database = import("@evaluation/database").DatabaseClient;

export class IdentifiedCompletionReader {
  readonly #database: Database;
  readonly #clock: () => Date;

  constructor(database: Database, clock: () => Date = () => new Date()) {
    this.#database = database;
    this.#clock = clock;
  }

  async read(input: Readonly<{ cycleId: string; managerId: string }>) {
    const cycle = await this.#database.managerEvaluationCycle.findUnique({
      where: { id: input.cycleId },
      include: {
        eligibilities: {
          include: {
            evaluator: { select: { displayName: true } },
            response: { select: { id: true, submittedAt: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (cycle === null) throw failure("MANAGER_EVALUATION_CYCLE_NOT_FOUND", 404);
    if (cycle.managerId !== input.managerId || cycle.visibilityMode !== "IDENTIFIED") {
      throw failure("AUTHZ_SCOPE", 403);
    }
    const entries = cycle.eligibilities.map((entry) => ({
      evaluatorId: entry.evaluatorId,
      evaluatorDisplayName: entry.evaluator.displayName,
      state: entry.state,
      responseId: entry.response?.id ?? null,
      submittedAt: entry.response?.submittedAt.toISOString() ?? null,
    }));
    return ManagerEvaluationCompletionProjectionSchema.parse({
      schemaVersion: 1,
      cycleId: cycle.id,
      managerId: cycle.managerId,
      visibilityMode: "IDENTIFIED",
      eligible: entries.length,
      submitted: entries.filter(({ state }) => state === "SUBMITTED").length,
      pending: entries.filter(({ state }) => state === "ELIGIBLE_PENDING").length,
      approvedLeave: entries.filter(({ state }) => state === "APPROVED_LEAVE").length,
      postponed: entries.filter(({ state }) => state === "POSTPONED").length,
      excluded: entries.filter(({ state }) => state === "EXCLUDED_BY_AUTHORIZED_MANAGER").length,
      entries,
      generatedAt: this.#clock().toISOString(),
    });
  }
}

function failure(code: string, status = 400): AppError {
  return new AppError(code, "errors.managerEvaluation.unavailable", status);
}
