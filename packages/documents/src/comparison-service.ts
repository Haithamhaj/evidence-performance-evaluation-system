import { createHash, randomUUID } from "node:crypto";

import {
  AppError,
  ComparisonAnalysisOutputSchema,
  ReviewMaterialClassificationSchema,
} from "@evaluation/contracts";

import {
  COMPARISON_INPUT_SCHEMA_VERSION,
  COMPARISON_OUTPUT_SCHEMA_VERSION,
} from "./analysis-model.js";
import {
  assertAnalysisFence,
  claimAnalysisRequest,
  completeAnalysisOperation,
  recordAnalysisEffect,
  recordAnalysisFailure,
  validateAnalysisExecutionTiming,
  withAnalysisHeartbeat,
} from "./analysis-execution.js";
import { buildComparisonRequest, COMPARISON_PROMPT_VERSION } from "./analysis-prompts.js";
import { authorizeDocument } from "./document-authorization.js";
import { extractSafeSources } from "./safe-source-extraction.js";

export class ComparisonService {
  private readonly database: import("./model.js").DocumentDatabase;
  private readonly reader: import("./model.js").DocumentResourceIdentityReader;
  private readonly sourceLoader: import("./document-analysis-source-loader.js").DocumentAnalysisSourceLoader;
  private readonly aiRouter: import("./analysis-model.js").DocumentAnalysisAiRouter;
  private readonly audit: import("./model.js").DocumentAuditWriter;
  private readonly enqueue: import("./analysis-model.js").AnalysisJobEnqueuer;
  private readonly options: Readonly<{
    systemId: string;
    timeoutMs: number;
    extractionPolicy: {
      maxSourceBytes: number;
      maxArchiveEntries: number;
      maxArchiveUncompressedBytes: number;
      maxArchiveCompressionRatio: number;
    };
    execution: import("./analysis-execution.js").AnalysisExecutionOptions;
    now?: () => Date;
  }>;

  constructor(
    database: import("./model.js").DocumentDatabase,
    reader: import("./model.js").DocumentResourceIdentityReader,
    sourceLoader: import("./document-analysis-source-loader.js").DocumentAnalysisSourceLoader,
    aiRouter: import("./analysis-model.js").DocumentAnalysisAiRouter,
    audit: import("./model.js").DocumentAuditWriter,
    enqueue: import("./analysis-model.js").AnalysisJobEnqueuer,
    options: Readonly<{
      systemId: string;
      timeoutMs: number;
      extractionPolicy: {
        maxSourceBytes: number;
        maxArchiveEntries: number;
        maxArchiveUncompressedBytes: number;
        maxArchiveCompressionRatio: number;
      };
      execution: import("./analysis-execution.js").AnalysisExecutionOptions;
      now?: () => Date;
    }>,
  ) {
    this.database = database;
    this.reader = reader;
    this.sourceLoader = sourceLoader;
    this.aiRouter = aiRouter;
    this.audit = audit;
    this.enqueue = enqueue;
    this.options = options;
  }

  async request(
    command: Readonly<{
      actor: { userId: string; active: boolean };
      correlationId: string;
      documentId: string;
      beforeDocumentVersionId: string;
      afterDocumentVersionId: string;
      idempotencyKey: string;
    }>,
  ): Promise<import("./analysis-model.js").DocumentAnalysisRequestReceipt> {
    const preview = await this.database.documentRecord.findUnique({
      where: { id: command.documentId },
      select: { projectId: true, workstreamId: true },
    });
    if (preview === null) throw notFound();
    const identity = await this.reader.read(resourceReference(preview));
    if (identity === null) throw notFound();
    const receipt = await this.database.$transaction(
      async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM "DocumentRecord" WHERE id = ${command.documentId}::uuid FOR UPDATE`;
        await authorizeDocument(
          transaction,
          command.actor,
          identity,
          "document.analysis.run",
          this.options.now?.() ?? new Date(),
        );
        const versions = await transaction.documentVersion.findMany({
          where: {
            id: { in: [command.beforeDocumentVersionId, command.afterDocumentVersionId] },
            documentId: command.documentId,
          },
          orderBy: { version: "asc" },
        });
        if (
          versions.length !== 2 ||
          versions[0]!.id !== command.beforeDocumentVersionId ||
          versions[1]!.id !== command.afterDocumentVersionId ||
          versions[0]!.version >= versions[1]!.version
        )
          throw invalidComparison();
        const prompt = await transaction.analysisPromptArtifact.findUnique({
          where: {
            routeKey_version: {
              routeKey: "document.compare",
              version: COMPARISON_PROMPT_VERSION,
            },
          },
        });
        const schema = await transaction.aiOutputSchemaArtifact.findUnique({
          where: {
            routeKey_version: {
              routeKey: "document.compare",
              version: COMPARISON_OUTPUT_SCHEMA_VERSION,
            },
          },
        });
        if (prompt === null || schema === null) throw artifactNotFound();
        const payloadHash = hash({
          documentId: command.documentId,
          before: versions[0]!.id,
          after: versions[1]!.id,
          prompt: [prompt.id, prompt.bodyHash],
          schema: [schema.id, schema.schemaHash],
        });
        const sameKey = await transaction.documentAnalysisRequest.findUnique({
          where: { idempotencyKey: command.idempotencyKey },
        });
        if (sameKey !== null) {
          if (sameKey.payloadHash !== payloadHash) throw idempotencyConflict();
          return receiptOf(sameKey);
        }
        const existing = await transaction.documentAnalysisRequest.findFirst({
          where: {
            kind: "comparison",
            documentId: command.documentId,
            beforeVersionId: versions[0]!.id,
            afterVersionId: versions[1]!.id,
            promptArtifactId: prompt.id,
            outputSchemaArtifactId: schema.id,
          },
        });
        if (existing !== null) return receiptOf(existing);
        const requestId = randomUUID();
        const operationId = requestId;
        await transaction.operation.create({
          data: {
            id: operationId,
            organizationId: identity.organizationId,
            jobType: "document.comparison",
            jobVersion: 1,
            idempotencyKey: `analysis:${command.idempotencyKey}`,
            correlationId: command.correlationId,
            payloadHash,
            status: "pending",
          },
        });
        const created = await transaction.documentAnalysisRequest.create({
          data: {
            id: requestId,
            kind: "comparison",
            idempotencyKey: command.idempotencyKey,
            payloadHash,
            routeKey: "document.compare",
            documentId: command.documentId,
            beforeVersionId: versions[0]!.id,
            afterVersionId: versions[1]!.id,
            expectedAggregateVersion: versions[1]!.version,
            outputSchemaArtifactId: schema.id,
            outputSchemaVersion: COMPARISON_OUTPUT_SCHEMA_VERSION,
            outputSchemaHash: schema.schemaHash,
            promptArtifactId: prompt.id,
            promptVersion: COMPARISON_PROMPT_VERSION,
            promptHash: prompt.bodyHash,
            state: "queued",
            operationId,
          },
        });
        await this.audit.append(transaction, {
          eventType: "document.comparison_requested",
          actor: { kind: "human", id: command.actor.userId },
          effectiveSubjectId: command.actor.userId,
          scopeType: identity.kind,
          scopeId: identity.resourceId,
          targetType: "document_analysis_request",
          targetId: created.id,
          reason: "Document comparison requested",
          safeDiff: { beforeVersionId: versions[0]!.id, afterVersionId: versions[1]!.id },
          correlationId: command.correlationId,
          source: "api",
        });
        return receiptOf(created);
      },
      { isolationLevel: "Serializable" },
    );
    await this.enqueue(receipt);
    return receipt;
  }

  async process(requestId: string, actorId: string, correlationId: string): Promise<string> {
    validateAnalysisExecutionTiming(this.options.execution, this.options.timeoutMs);
    const now = this.options.now?.() ?? new Date();
    const request = await claimAnalysisRequest(this.database, {
      requestId,
      kind: "comparison",
      now,
      execution: this.options.execution,
    });
    const recorded = await recordedComparisonReference(this.database, request);
    if (recorded !== null) {
      await completeAnalysisOperation(this.database, request, recorded, now);
      return recorded;
    }
    if (request.beforeVersionId === null || request.afterVersionId === null) throw notFound();

    try {
      const outputReference = await withAnalysisHeartbeat(
        this.database,
        request,
        this.options.execution,
        () => this.options.now?.() ?? new Date(),
        async () => {
          const [before, after] = await Promise.all([
            this.sourceLoader.load({ documentVersionId: request.beforeVersionId! }),
            this.sourceLoader.load({ documentVersionId: request.afterVersionId! }),
          ]);
          const [beforeExtraction, afterExtraction] = await Promise.all([
            extractSafeSources({ policy: this.options.extractionPolicy, sources: before.sources }),
            extractSafeSources({ policy: this.options.extractionPolicy, sources: after.sources }),
          ]);
          if (beforeExtraction.coverage !== "complete" || afterExtraction.coverage !== "complete")
            throw extractionFailed();
          const built = buildComparisonRequest({
            prompt: { artifactId: request.promptArtifactId, sha256: request.promptHash },
            before: {
              documentVersionId: before.documentVersionId,
              sources: extractedInputs(beforeExtraction),
            },
            after: {
              documentVersionId: after.documentVersionId,
              sources: extractedInputs(afterExtraction),
            },
          });
          const sourceReferences = [...before.sourceReferences, ...after.sourceReferences];
          const result = await this.aiRouter.run(
            {
              routeKey: "document.compare",
              projectId: after.identity.projectId,
              departmentId: after.identity.departmentId,
              systemId: this.options.systemId,
              input: {
                trustedInstruction: built.trustedInstruction,
                untrustedContent: built.untrustedContent,
              },
              inputReference: `document-version:${after.documentVersionId}`,
              inputSchemaVersion: COMPARISON_INPUT_SCHEMA_VERSION,
              outputSchemaVersion: COMPARISON_OUTPUT_SCHEMA_VERSION,
              promptTemplateVersion: COMPARISON_PROMPT_VERSION,
              outputSchema: ComparisonAnalysisOutputSchema,
              sourceReferences,
              classification: "confidential",
              timeoutMs: this.options.timeoutMs,
              requiresHumanApproval: true,
              correlationId,
            },
            async (transaction, rawOutput) => {
              await transaction.$queryRaw`SELECT id FROM "DocumentAnalysisRequest" WHERE id = ${request.id}::uuid FOR UPDATE`;
              await assertAnalysisFence(transaction, request, new Date());
              const existing = await transaction.documentAnalysisRequest.findUnique({
                where: { id: request.id },
                select: { state: true, resultReference: true },
              });
              if (existing?.state === "succeeded" && existing.resultReference !== null)
                return { outputReference: existing.resultReference };
              if (existing?.state === "superseded") {
                const staleResult = await transaction.documentComparison.findUnique({
                  where: { requestId: request.id },
                  select: { outputReference: true },
                });
                if (staleResult !== null) return { outputReference: staleResult.outputReference };
              }
              const output = ComparisonAnalysisOutputSchema.parse(rawOutput);
              assertBoundComparisonReferences(
                output,
                before.sourceReferences,
                after.sourceReferences,
              );
              await transaction.$queryRaw`SELECT id FROM "DocumentRecord" WHERE id = ${request.documentId}::uuid FOR UPDATE`;
              const current = await transaction.documentRecord.findUnique({
                where: { id: request.documentId },
                select: { currentVersion: true },
              });
              const stale = current?.currentVersion !== request.expectedAggregateVersion;
              const id = randomUUID();
              const persistedReference = `document-comparison:${id}`;
              await transaction.documentComparison.create({
                data: {
                  id,
                  requestId: request.id,
                  documentId: request.documentId,
                  beforeVersionId: before.documentVersionId,
                  afterVersionId: after.documentVersionId,
                  aiClassification: output.classification,
                  output,
                  outputReference: persistedReference,
                  inputSchemaVersion: COMPARISON_INPUT_SCHEMA_VERSION,
                  outputSchemaVersion: COMPARISON_OUTPUT_SCHEMA_VERSION,
                  promptVersion: request.promptVersion,
                  promptHash: request.promptHash,
                  validationOutcome: "valid",
                  stale,
                  sourceReferences,
                  createdById: actorId,
                },
              });
              await transaction.documentAnalysisRequest.update({
                where: { id: request.id },
                data: {
                  state: stale ? "superseded" : "succeeded",
                  resultReference: stale ? null : persistedReference,
                  completedAt: new Date(),
                },
              });
              await recordAnalysisEffect(transaction, request, persistedReference);
              return { outputReference: persistedReference };
            },
          );
          return result.outputReference;
        },
      );
      await completeAnalysisOperation(this.database, request, outputReference, new Date());
      return outputReference;
    } catch (error) {
      await recordAnalysisFailure(
        this.database,
        request,
        error,
        new Date(),
        this.options.execution,
      );
      throw error;
    }
  }

  async review(
    command: Readonly<{
      actor: { userId: string; active: boolean };
      correlationId: string;
      comparisonId: string;
      review: unknown;
    }>,
  ): Promise<import("./analysis-model.js").DocumentComparisonReview> {
    const review = ReviewMaterialClassificationSchema.parse(command.review);
    const preview = await this.database.documentComparison.findUnique({
      where: { id: command.comparisonId },
      select: { documentId: true },
    });
    if (preview === null) throw notFound();
    return this.database.$transaction(
      async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM "DocumentRecord" WHERE id = ${preview.documentId}::uuid FOR UPDATE`;
        await transaction.$queryRaw`SELECT id FROM "DocumentComparison" WHERE id = ${command.comparisonId}::uuid FOR UPDATE`;
        const comparison = await transaction.documentComparison.findUnique({
          where: { id: command.comparisonId },
          include: {
            document: { select: { projectId: true, workstreamId: true, currentVersion: true } },
          },
        });
        if (comparison === null || comparison.documentId !== preview.documentId) throw notFound();
        const identity = await this.reader.read(resourceReference(comparison.document));
        if (identity === null) throw notFound();
        await authorizeDocument(
          transaction,
          command.actor,
          identity,
          "document.comparison.review",
          this.options.now?.() ?? new Date(),
        );
        const after = await transaction.documentVersion.findUnique({
          where: { id: comparison.afterVersionId },
          select: { version: true },
        });
        if (
          comparison.stale ||
          after === null ||
          comparison.document.currentVersion !== after.version
        )
          throw staleComparison();
        const effective = effectiveClassification(comparison.aiClassification, review);
        const created = await transaction.documentComparisonReview.create({
          data: {
            comparisonId: comparison.id,
            effectiveClassification: effective,
            reviewerId: command.actor.userId,
            reason: review.reason,
          },
        });
        await this.audit.append(transaction, {
          eventType: "document.comparison_reviewed",
          actor: { kind: "human", id: command.actor.userId },
          effectiveSubjectId: command.actor.userId,
          scopeType: identity.kind,
          scopeId: identity.resourceId,
          targetType: "document_comparison_review",
          targetId: created.id,
          reason: review.reason,
          safeDiff: { effectiveClassification: effective },
          correlationId: command.correlationId,
          source: "api",
        });
        return {
          id: created.id,
          comparisonId: created.comparisonId,
          effectiveClassification: created.effectiveClassification,
          reviewerId: created.reviewerId,
          reason: created.reason,
          createdAt: created.createdAt.toISOString(),
        };
      },
      { isolationLevel: "Serializable" },
    );
  }
}

export function effectiveClassification(
  ai: import("@evaluation/contracts").ComparisonAnalysisOutput["classification"],
  review: import("@evaluation/contracts").ReviewMaterialClassification,
) {
  return review.action === "confirm" ? ai : review.classification;
}

async function recordedComparisonReference(
  database: import("./model.js").DocumentDatabase,
  request: import("./analysis-execution.js").AnalysisRequestSnapshot,
) {
  if (request.state === "succeeded" && request.resultReference !== null)
    return request.resultReference;
  if (request.state !== "superseded") return null;
  const result = await database.documentComparison.findUnique({
    where: { requestId: request.id },
    select: { outputReference: true },
  });
  if (result === null) throw staleComparison();
  return result.outputReference;
}

function extractedInputs(bundle: import("./analysis-model.js").ExtractionBundle) {
  return bundle.sources.flatMap((source) =>
    source.contentBase64 === undefined
      ? []
      : [
          {
            reference: source.reference,
            mediaType: source.mediaType,
            contentBase64: source.contentBase64,
          },
        ],
  );
}
function assertBoundComparisonReferences(
  output: import("@evaluation/contracts").ComparisonAnalysisOutput,
  before: readonly string[],
  after: readonly string[],
) {
  if (
    output.beforeSourceReferences.some((reference) => !before.includes(reference)) ||
    output.afterSourceReferences.some((reference) => !after.includes(reference))
  ) {
    throw new AppError("AI_SOURCE_REFERENCE_INVALID", "errors.ai.sourceReferenceInvalid", 502);
  }
}
function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function receiptOf(row: any): import("./analysis-model.js").DocumentAnalysisRequestReceipt {
  return {
    requestId: row.id,
    operationId: row.operationId,
    state: row.state,
    documentId: row.documentId,
    documentVersionIds: [row.beforeVersionId, row.afterVersionId].filter(Boolean),
  };
}
function resourceReference(record: { projectId: string | null; workstreamId: string | null }) {
  if (record.workstreamId !== null)
    return { kind: "workstream" as const, resourceId: record.workstreamId };
  if (record.projectId !== null) return { kind: "project" as const, resourceId: record.projectId };
  throw notFound();
}
function notFound() {
  return new AppError("RESOURCE_NOT_FOUND", "errors.documents.resourceNotFound", 404);
}
function invalidComparison() {
  return new AppError("DOCUMENT_COMPARISON_INVALID", "errors.documents.comparisonInvalid", 400);
}
function staleComparison() {
  return new AppError("DOCUMENT_COMPARISON_STALE", "errors.documents.comparisonStale", 409);
}
function extractionFailed() {
  return new AppError(
    "DOCUMENT_EXTRACTION_INCOMPLETE",
    "errors.documents.extractionIncomplete",
    409,
  );
}
function artifactNotFound() {
  return new AppError("AI_ARTIFACT_NOT_FOUND", "errors.ai.artifactNotFound", 500);
}
function idempotencyConflict() {
  return new AppError("IDEMPOTENCY_CONFLICT", "errors.idempotencyConflict", 409);
}
