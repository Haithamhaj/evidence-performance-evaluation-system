import { databaseAuditWriter } from "@evaluation/audit";
import {
  AppError,
  SubmitManagerEvaluationInputSchema,
  SubmitManagerEvaluationReceiptSchema,
} from "@evaluation/contracts";

type Database = import("@evaluation/database").DatabaseClient;
type Transaction = import("./ports.js").ManagerEvaluationTransaction;
type Audit = import("@evaluation/contracts").AuditWriter<Transaction>;

export class ManagerEvaluationSubmissionService {
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

  async submit(
    input: unknown,
  ): Promise<import("@evaluation/contracts").SubmitManagerEvaluationReceipt> {
    if (
      input !== null &&
      typeof input === "object" &&
      "identifiedNoticeConfirmed" in input &&
      input.identifiedNoticeConfirmed !== true
    ) {
      throw failure("IDENTIFIED_NOTICE_REQUIRED", 409);
    }
    const parsed = SubmitManagerEvaluationInputSchema.parse(input);
    const confirmedAt = new Date(parsed.confirmedAt);
    return this.#database.$transaction(
      async (transaction) => {
        const byKey = await transaction.managerEvaluationResponse.findUnique({
          where: { idempotencyKey: parsed.idempotencyKey },
        });
        if (byKey !== null) {
          assertSame(byKey, parsed);
          return receipt(byKey);
        }
        const original = await transaction.managerEvaluationResponse.findUnique({
          where: {
            cycleId_evaluatorId: { cycleId: parsed.cycleId, evaluatorId: parsed.evaluatorId },
          },
        });
        if (original !== null) return receipt(original);

        const serverNow = validDate(this.#clock());
        if (!Number.isFinite(confirmedAt.getTime()) || confirmedAt > serverNow) {
          throw failure("MANAGER_EVALUATION_CONFIRMATION_TIME_INVALID", 409);
        }

        const eligibility = await transaction.managerEvaluatorEligibility.findUnique({
          where: {
            cycleId_evaluatorId: { cycleId: parsed.cycleId, evaluatorId: parsed.evaluatorId },
          },
          include: {
            evaluator: { select: { active: true } },
            cycle: { include: { snapshot: true } },
          },
        });
        if (eligibility === null) throw failure("MANAGER_EVALUATION_ELIGIBILITY_NOT_FOUND", 404);
        if (!eligibility.evaluator.active) throw failure("AUTH_INACTIVE_USER", 403);
        if (eligibility.state !== "ELIGIBLE_PENDING") {
          throw failure("MANAGER_EVALUATION_EVALUATOR_NOT_ELIGIBLE", 409);
        }
        if (eligibility.version !== parsed.expectedVersion) throw failure("VERSION_CONFLICT", 409);
        const cycle = eligibility.cycle;
        if (
          cycle.state !== "OPEN" ||
          cycle.visibilityMode !== "IDENTIFIED" ||
          cycle.snapshot === null
        ) {
          throw failure("MANAGER_EVALUATION_CYCLE_NOT_OPEN", 409);
        }
        if (serverNow < cycle.startsAt || serverNow >= cycle.endsAt) {
          throw failure("MANAGER_EVALUATION_CONFIRMATION_TIME_INVALID", 409);
        }
        const frozen = criteria(cycle.snapshot.criteriaSnapshot);
        assertResponses(parsed.responses, frozen);

        const response = await transaction.managerEvaluationResponse.create({
          data: {
            idempotencyKey: parsed.idempotencyKey,
            cycleId: cycle.id,
            cycleSnapshotId: cycle.snapshot.id,
            eligibilityId: eligibility.id,
            evaluatorId: parsed.evaluatorId,
            managerId: cycle.managerId,
            visibilityMode: "IDENTIFIED",
            identifiedNoticeConfirmed: true,
            submittedAt: serverNow,
            visibleToManagerAt: serverNow,
            criterionResponses: {
              create: parsed.responses.map((entry, position) => ({
                criterionId: entry.criterionId,
                rating: entry.rating,
                comment: entry.comment,
                position,
              })),
            },
          },
        });
        const advanced = await transaction.managerEvaluatorEligibility.updateMany({
          where: { id: eligibility.id, version: parsed.expectedVersion, state: "ELIGIBLE_PENDING" },
          data: { state: "SUBMITTED", version: { increment: 1 }, effectiveAt: serverNow },
        });
        if (advanced.count !== 1) throw failure("VERSION_CONFLICT", 409);
        await transaction.managerEvaluatorEligibilityDecision.create({
          data: {
            idempotencyKey: parsed.idempotencyKey,
            eligibilityId: eligibility.id,
            fromState: "ELIGIBLE_PENDING",
            toState: "SUBMITTED",
            reason: "Employee confirmed the identified manager evaluation submission.",
            effectiveAt: serverNow,
            actorId: parsed.evaluatorId,
            resultingVersion: parsed.expectedVersion + 1,
          },
        });
        await this.#audit.append(transaction, {
          eventType: "manager_evaluation.response.submitted",
          actor: { kind: "human", id: parsed.evaluatorId },
          effectiveSubjectId: cycle.managerId,
          scopeType: "cycle",
          scopeId: cycle.id,
          targetType: "manager_evaluation_response",
          targetId: response.id,
          safeDiff: { criterionCount: 5, visibilityMode: "IDENTIFIED", immediatelyVisible: true },
          correlationId: parsed.idempotencyKey,
          source: "api",
        });
        return receipt(response);
      },
      { isolationLevel: "Serializable" },
    );
  }
}

function criteria(value: unknown): Array<{ criterionId: string; commentRequired: boolean }> {
  if (!Array.isArray(value) || value.length !== 5)
    throw failure("MANAGER_EVALUATION_SNAPSHOT_INVALID", 500);
  return value.map((entry) => {
    if (entry === null || typeof entry !== "object" || !("criterionId" in entry)) {
      throw failure("MANAGER_EVALUATION_SNAPSHOT_INVALID", 500);
    }
    return {
      criterionId: String(entry.criterionId),
      commentRequired: "commentRequired" in entry && entry.commentRequired === true,
    };
  });
}

function assertResponses(
  responses: readonly import("@evaluation/contracts").ManagerCriterionResponse[],
  frozen: readonly { criterionId: string; commentRequired: boolean }[],
) {
  const expected = new Map(frozen.map((criterion) => [criterion.criterionId, criterion]));
  if (responses.some((response) => !expected.has(response.criterionId))) {
    throw failure("MANAGER_EVALUATION_CRITERIA_MISMATCH", 409);
  }
  for (const response of responses) {
    if (
      expected.get(response.criterionId)?.commentRequired === true &&
      response.comment.length === 0
    ) {
      throw failure("MANAGER_EVALUATION_COMMENT_REQUIRED", 409);
    }
  }
}

function assertSame(
  value: { cycleId: string; evaluatorId: string },
  input: import("@evaluation/contracts").SubmitManagerEvaluationInput,
) {
  if (value.cycleId !== input.cycleId || value.evaluatorId !== input.evaluatorId) {
    throw failure("IDEMPOTENCY_KEY_REUSED", 409);
  }
}

function receipt(value: { id: string; cycleId: string; evaluatorId: string; submittedAt: Date }) {
  return SubmitManagerEvaluationReceiptSchema.parse({
    schemaVersion: 1,
    responseId: value.id,
    cycleId: value.cycleId,
    evaluatorId: value.evaluatorId,
    state: "SUBMITTED",
    submittedAt: value.submittedAt.toISOString(),
  });
}

function validDate(value: Date): Date {
  if (!Number.isFinite(value.getTime())) throw failure("MANAGER_EVALUATION_CLOCK_INVALID", 500);
  return value;
}

function failure(code: string, status = 400): AppError {
  return new AppError(code, "errors.managerEvaluation.invalid", status);
}
