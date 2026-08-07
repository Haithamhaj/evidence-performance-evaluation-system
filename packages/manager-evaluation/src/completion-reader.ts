import { databaseAuditWriter } from "@evaluation/audit";
import { AppError, ManagerEvaluationCompletionProjectionSchema } from "@evaluation/contracts";

type Database = import("@evaluation/database").DatabaseClient;
type Transaction = import("./ports.js").ManagerEvaluationTransaction;
type Audit = import("@evaluation/contracts").AuditWriter<Transaction>;

export class IdentifiedCompletionReader {
  readonly #database: Database;
  readonly #clock: () => Date;
  readonly #audit: Audit;

  constructor(
    database: Database,
    clock: () => Date = () => new Date(),
    audit: Audit = databaseAuditWriter as Audit,
  ) {
    this.#database = database;
    this.#clock = clock;
    this.#audit = audit;
  }

  async read(input: Readonly<{ cycleId: string; managerId: string }>) {
    return this.#database.$transaction(
      async (transaction) => {
        const projection = await this.readSnapshot(transaction, input, this.#clock());
        await this.#audit.append(transaction, {
          eventType: "manager_evaluation.completion.read",
          actor: { kind: "human", id: input.managerId },
          effectiveSubjectId: input.managerId,
          scopeType: "cycle",
          scopeId: input.cycleId,
          targetType: "manager_evaluation_cycle",
          targetId: input.cycleId,
          safeDiff: {
            visibilityMode: "IDENTIFIED",
            eligible: projection.eligible,
            submitted: projection.submitted,
            pending: projection.pending,
            approvedLeave: projection.approvedLeave,
            postponed: projection.postponed,
            excluded: projection.excluded,
          },
          correlationId: crypto.randomUUID(),
          source: "api",
        });
        return projection;
      },
      { isolationLevel: "RepeatableRead" },
    );
  }

  async readSnapshot(
    transaction: Transaction,
    input: Readonly<{ cycleId: string; managerId: string }>,
    generatedAt: Date,
  ) {
    const cycle = await transaction.managerEvaluationCycle.findUnique({
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
      generatedAt: generatedAt.toISOString(),
    });
  }
}

function failure(code: string, status = 400): AppError {
  return new AppError(code, "errors.managerEvaluation.unavailable", status);
}
