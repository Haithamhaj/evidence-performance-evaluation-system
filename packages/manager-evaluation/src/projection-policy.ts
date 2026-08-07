import { databaseAuditWriter } from "@evaluation/audit";
import {
  AppError,
  IdentifiedManagerEvaluationReportProjectionSchema,
  IdentifiedManagerResponseSchema,
  createPilotManagerEvaluationProjectionPolicy,
} from "@evaluation/contracts";

import { IdentifiedCompletionReader } from "./completion-reader.js";

type Database = import("@evaluation/database").DatabaseClient;
type Transaction = import("./ports.js").ManagerEvaluationTransaction;
type Audit = import("@evaluation/contracts").AuditWriter<Transaction>;

export function createProjectionPolicy(
  mode: import("@evaluation/contracts").ManagerEvaluationVisibility,
  policyVersion = 1,
) {
  return createPilotManagerEvaluationProjectionPolicy(mode, policyVersion);
}

export class IdentifiedProjectionPolicy {
  readonly #database: Database;
  readonly #completion: IdentifiedCompletionReader;
  readonly #audit: Audit;
  readonly #clock: () => Date;

  constructor(
    database: Database,
    audit: Audit = databaseAuditWriter as Audit,
    clock: () => Date = () => new Date(),
  ) {
    this.#database = database;
    this.#completion = new IdentifiedCompletionReader(database, clock, audit);
    this.#audit = audit;
    this.#clock = clock;
  }

  async readResponse(input: Readonly<{ responseId: string; managerId: string; reason: string }>) {
    return this.#database.$transaction(async (transaction) => {
      const response = await transaction.managerEvaluationResponse.findUnique({
        where: { id: input.responseId },
        include: {
          evaluator: { select: { displayName: true } },
          criterionResponses: { orderBy: { position: "asc" } },
        },
      });
      if (
        response === null ||
        response.managerId !== input.managerId ||
        response.visibilityMode !== "IDENTIFIED"
      ) {
        throw failure("AUTHZ_SCOPE", 403);
      }
      await this.#audit.append(transaction, {
        eventType: "manager_evaluation.response.read",
        actor: { kind: "human", id: input.managerId },
        effectiveSubjectId: response.evaluatorId,
        scopeType: "cycle",
        scopeId: response.cycleId,
        targetType: "manager_evaluation_response",
        targetId: response.id,
        reason: input.reason,
        safeDiff: { visibilityMode: "IDENTIFIED", identifiedOriginal: true },
        correlationId: crypto.randomUUID(),
        source: "api",
      });
      return serializeResponse(response);
    });
  }

  async readManagerCycle(input: Readonly<{ cycleId: string; managerId: string; reason: string }>) {
    return this.#database.$transaction(
      async (transaction) => {
        const generatedAt = this.#clock();
        const completion = await this.#completion.readSnapshot(transaction, input, generatedAt);
        const cycle = await transaction.managerEvaluationCycle.findUnique({
          where: { id: input.cycleId },
          include: {
            responses: {
              include: {
                evaluator: { select: { displayName: true } },
                criterionResponses: { orderBy: { position: "asc" } },
              },
              orderBy: { submittedAt: "asc" },
            },
            summaryRevisions: { orderBy: { revision: "desc" }, take: 1 },
          },
        });
        if (
          cycle === null ||
          cycle.managerId !== input.managerId ||
          cycle.visibilityMode !== "IDENTIFIED"
        ) {
          throw failure("AUTHZ_SCOPE", 403);
        }
        await this.#audit.append(transaction, {
          eventType: "manager_evaluation.cycle.read",
          actor: { kind: "human", id: input.managerId },
          effectiveSubjectId: input.managerId,
          scopeType: "cycle",
          scopeId: cycle.id,
          targetType: "manager_evaluation_cycle",
          targetId: cycle.id,
          reason: input.reason,
          safeDiff: { identifiedOriginalCount: cycle.responses.length },
          correlationId: crypto.randomUUID(),
          source: "api",
        });
        return IdentifiedManagerEvaluationReportProjectionSchema.parse({
          schemaVersion: 1,
          cycleId: cycle.id,
          managerId: cycle.managerId,
          visibilityMode: "IDENTIFIED",
          period: { startsAt: cycle.startsAt.toISOString(), endsAt: cycle.endsAt.toISOString() },
          completion,
          responses: cycle.responses.map(serializeResponse),
          summaryRevision: cycle.summaryRevisions[0]
            ? {
                schemaVersion: "manager-evaluation-summary.v1",
                id: cycle.summaryRevisions[0].id,
                cycleId: cycle.id,
                revision: cycle.summaryRevisions[0].revision,
                visibilityMode: "IDENTIFIED",
                period: {
                  startsAt: cycle.summaryRevisions[0].periodStartsAt.toISOString(),
                  endsAt: cycle.summaryRevisions[0].periodEndsAt.toISOString(),
                },
                sourceResponseIds: await sourceIds(transaction, cycle.summaryRevisions[0].id),
                distributions: cycle.summaryRevisions[0].distributions,
                themes: cycle.summaryRevisions[0].themes,
                limitations: cycle.summaryRevisions[0].limitations,
                promptVersion: cycle.summaryRevisions[0].promptVersion,
                outputSchemaVersion: cycle.summaryRevisions[0].outputSchemaVersion,
                aiRunId: cycle.summaryRevisions[0].aiRunId,
                createdAt: cycle.summaryRevisions[0].createdAt.toISOString(),
              }
            : null,
          generatedAt: generatedAt.toISOString(),
        });
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
}

function serializeResponse(response: any) {
  return IdentifiedManagerResponseSchema.parse({
    schemaVersion: 1,
    responseId: response.id,
    cycleId: response.cycleId,
    managerId: response.managerId,
    submitterId: response.evaluatorId,
    submitterDisplayName: response.evaluator.displayName,
    visibilityMode: "IDENTIFIED",
    state: "SUBMITTED",
    responses: response.criterionResponses.map((entry: any) => ({
      criterionId: entry.criterionId,
      rating: entry.rating,
      comment: entry.comment,
    })),
    submittedAt: response.submittedAt.toISOString(),
  });
}

async function sourceIds(transaction: Transaction, summaryRevisionId: string): Promise<string[]> {
  return (
    await transaction.managerEvaluationSummarySource.findMany({
      where: { summaryRevisionId },
      orderBy: { position: "asc" },
      select: { responseId: true },
    })
  ).map(({ responseId }) => responseId);
}

function failure(code: string, status = 400): AppError {
  return new AppError(code, "errors.managerEvaluation.forbidden", status);
}
