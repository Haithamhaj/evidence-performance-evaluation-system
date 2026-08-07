import { createHash } from "node:crypto";

import { databaseAuditWriter } from "@evaluation/audit";
import { AppError, ManagerEvaluationSummaryRevisionSchema } from "@evaluation/contracts";

import {
  MANAGER_EVALUATION_SUMMARY_ROUTE,
  MANAGER_EVALUATION_SUMMARY_TRUSTED_PROMPT,
  MANAGER_EVALUATION_SUMMARY_VERSION,
  ManagerEvaluationAiSummaryOutputSchema,
  assertManagerSummarySemantics,
  buildManagerEvaluationSummaryRequest,
} from "./prompts.js";

type Database = import("@evaluation/database").DatabaseClient;
type Transaction = import("./ports.js").ManagerEvaluationTransaction;
type Audit = import("@evaluation/contracts").AuditWriter<Transaction>;

export class ManagerEvaluationSummaryService {
  readonly #database: Database;
  readonly #router: import("./ports.js").ManagerSummaryRouter;
  readonly #systemId: string;
  readonly #timeoutMs: number;
  readonly #clock: () => Date;
  readonly #audit: Audit;

  constructor(
    dependencies: Readonly<{
      database: Database;
      router: import("./ports.js").ManagerSummaryRouter;
      systemId: string;
      timeoutMs: number;
      clock?: () => Date;
      audit?: Audit;
    }>,
  ) {
    this.#database = dependencies.database;
    this.#router = dependencies.router;
    this.#systemId = dependencies.systemId;
    this.#timeoutMs = dependencies.timeoutMs;
    this.#clock = dependencies.clock ?? (() => new Date());
    this.#audit = dependencies.audit ?? (databaseAuditWriter as Audit);
  }

  async createSummary(input: Readonly<{ cycleId: string; managerId: string }>) {
    const { cycle, prompt } = await this.#database.$transaction(
      async (transaction) => {
        const [cycle, prompt] = await Promise.all([
          transaction.managerEvaluationCycle.findUnique({
            where: { id: input.cycleId },
            include: {
              responses: {
                include: { criterionResponses: { orderBy: { position: "asc" } } },
                orderBy: { submittedAt: "asc" },
              },
            },
          }),
          transaction.analysisPromptArtifact.findUnique({
            where: {
              routeKey_version: {
                routeKey: MANAGER_EVALUATION_SUMMARY_ROUTE,
                version: MANAGER_EVALUATION_SUMMARY_VERSION,
              },
            },
            select: {
              id: true,
              routeKey: true,
              version: true,
              bodyHash: true,
              trustedBody: true,
            },
          }),
        ]);
        return { cycle, prompt };
      },
      { isolationLevel: "RepeatableRead" },
    );
    if (
      prompt === null ||
      prompt.routeKey !== MANAGER_EVALUATION_SUMMARY_ROUTE ||
      prompt.version !== MANAGER_EVALUATION_SUMMARY_VERSION ||
      prompt.bodyHash !== summaryPromptHash() ||
      prompt.trustedBody !== MANAGER_EVALUATION_SUMMARY_TRUSTED_PROMPT
    ) {
      throw failure("AI_PROMPT_ARTIFACT_MISMATCH", "errors.ai.promptArtifactMismatch", 500);
    }
    if (
      cycle === null ||
      cycle.managerId !== input.managerId ||
      cycle.visibilityMode !== "IDENTIFIED"
    ) {
      throw failure("AUTHZ_SCOPE", "errors.managerEvaluation.forbidden", 403);
    }
    if (cycle.responses.length < 2) {
      throw failure(
        "MANAGER_EVALUATION_SUMMARY_SUPPORT_INSUFFICIENT",
        "errors.managerEvaluation.summarySupportInsufficient",
        409,
      );
    }
    const period = { startsAt: cycle.startsAt.toISOString(), endsAt: cycle.endsAt.toISOString() };
    const responses = cycle.responses.map((response) => ({
      responseId: response.id,
      submittedAt: response.submittedAt.toISOString(),
      responses: response.criterionResponses.map((entry) => ({
        criterionId: entry.criterionId,
        rating: entry.rating,
        comment: entry.comment,
      })),
    }));
    const governed = buildManagerEvaluationSummaryRequest({
      prompt: { artifactId: prompt.id, sha256: prompt.bodyHash },
      cycleId: cycle.id,
      period,
      responses,
    });
    const reference = `manager-evaluation-cycle:${cycle.id}`;
    const correlationId = crypto.randomUUID();
    const result = await this.#router.run<
      typeof governed.input,
      import("zod").infer<typeof ManagerEvaluationAiSummaryOutputSchema>
    >(
      {
        routeKey: governed.routeKey,
        departmentId: cycle.departmentId,
        systemId: this.#systemId,
        input: governed.input,
        inputReference: reference,
        inputSchemaVersion: governed.inputSchemaVersion,
        outputSchemaVersion: governed.outputSchemaVersion,
        promptTemplateVersion: governed.promptTemplateVersion,
        outputSchema: ManagerEvaluationAiSummaryOutputSchema,
        sourceReferences: responses.map(
          (response) => `manager-evaluation-response:${response.responseId}`,
        ),
        classification: "confidential",
        timeoutMs: this.#timeoutMs,
        requiresHumanApproval: false,
        correlationId,
      },
      async () => ({ outputReference: reference }),
    );
    assertManagerSummarySemantics(
      result.output,
      responses.map(({ responseId }) => responseId),
      period,
    );
    const distributions = distributionsFor(responses);
    const createdAt = this.#clock();
    const themes = result.output.themes.map((theme) => ({
      ...theme,
      themeId: crypto.randomUUID(),
    }));
    const revision = await this.#database.$transaction(async (transaction) => {
      const previous = await transaction.managerEvaluationSummaryRevision.findFirst({
        where: { cycleId: cycle.id },
        orderBy: { revision: "desc" },
        select: { revision: true },
      });
      const revision = await transaction.managerEvaluationSummaryRevision.create({
        data: {
          cycleId: cycle.id,
          revision: (previous?.revision ?? 0) + 1,
          visibilityMode: "IDENTIFIED",
          periodStartsAt: cycle.startsAt,
          periodEndsAt: cycle.endsAt,
          distributions: distributions as never,
          themes: themes as never,
          limitations: result.output.limitations as never,
          promptVersion: MANAGER_EVALUATION_SUMMARY_VERSION,
          outputSchemaVersion: MANAGER_EVALUATION_SUMMARY_VERSION,
          aiRunId: result.runId,
          requestedById: input.managerId,
          createdAt,
          sources: {
            create: responses.map((response, position) => ({
              responseId: response.responseId,
              position,
            })),
          },
        },
      });
      await this.#audit.append(transaction, {
        eventType: "manager_evaluation.summary.generated",
        actor: { kind: "human", id: input.managerId },
        effectiveSubjectId: input.managerId,
        scopeType: "cycle",
        scopeId: cycle.id,
        targetType: "manager_evaluation_summary_revision",
        targetId: revision.id,
        safeDiff: {
          visibilityMode: "IDENTIFIED",
          revision: revision.revision,
          sourceResponseCount: responses.length,
          themeCount: themes.length,
        },
        correlationId,
        source: "api",
      });
      return revision;
    });
    return ManagerEvaluationSummaryRevisionSchema.parse({
      schemaVersion: MANAGER_EVALUATION_SUMMARY_VERSION,
      id: revision.id,
      cycleId: cycle.id,
      revision: revision.revision,
      visibilityMode: "IDENTIFIED",
      period,
      sourceResponseIds: responses.map(({ responseId }) => responseId),
      distributions,
      themes,
      limitations: result.output.limitations,
      promptVersion: MANAGER_EVALUATION_SUMMARY_VERSION,
      outputSchemaVersion: MANAGER_EVALUATION_SUMMARY_VERSION,
      aiRunId: result.runId,
      createdAt: revision.createdAt.toISOString(),
    });
  }
}

function summaryPromptHash(): string {
  return createHash("sha256").update(MANAGER_EVALUATION_SUMMARY_TRUSTED_PROMPT).digest("hex");
}

function failure(code: string, messageKey: string, status: number): AppError {
  return new AppError(code, messageKey, status);
}

function distributionsFor(
  responses: ReadonlyArray<{ responses: ReadonlyArray<{ criterionId: string; rating: number }> }>,
) {
  const criterionIds = [
    ...new Set(
      responses.flatMap((response) => response.responses.map(({ criterionId }) => criterionId)),
    ),
  ];
  return criterionIds.map((criterionId) => {
    const ratings = responses.flatMap((response) =>
      response.responses
        .filter((entry) => entry.criterionId === criterionId)
        .map(({ rating }) => rating),
    );
    return {
      criterionId,
      buckets: ([1, 2, 3, 4, 5] as const).map((rating) => ({
        rating,
        count: ratings.filter((value) => value === rating).length,
      })),
      totalResponses: ratings.length,
    };
  });
}
