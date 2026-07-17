import { createHash, randomUUID } from "node:crypto";

import {
  AppError,
  ManagerReadinessSummarySchema,
  ReadinessAnalysisOutputSchema,
  ReadinessParticipantDetailSchema,
} from "@evaluation/contracts";

import {
  READINESS_INPUT_SCHEMA_VERSION,
  READINESS_OUTPUT_SCHEMA_VERSION,
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
import { buildReadinessRequest, READINESS_PROMPT_VERSION } from "./analysis-prompts.js";
import { authorizeDocument } from "./document-authorization.js";
import { extractSafeSources } from "./safe-source-extraction.js";

type Actor = Readonly<{ userId: string; active: boolean }>;

export class ReadinessService {
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
      actor: Actor;
      correlationId: string;
      documentId: string;
      idempotencyKey: string;
    }>,
  ): Promise<import("./analysis-model.js").DocumentAnalysisRequestReceipt> {
    const now = this.options.now?.() ?? new Date();
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
        await authorizeDocument(transaction, command.actor, identity, "document.analysis.run", now);
        const document = await transaction.documentRecord.findUnique({
          where: { id: command.documentId },
        });
        if (document === null || document.currentVersion < 1) throw notFound();
        const version = await transaction.documentVersion.findUnique({
          where: {
            documentId_version: { documentId: document.id, version: document.currentVersion },
          },
        });
        if (version === null) throw notFound();
        const prompt = await transaction.analysisPromptArtifact.findUnique({
          where: {
            routeKey_version: {
              routeKey: "document.analyze",
              version: READINESS_PROMPT_VERSION,
            },
          },
        });
        const schema = await transaction.aiOutputSchemaArtifact.findUnique({
          where: {
            routeKey_version: {
              routeKey: "document.analyze",
              version: READINESS_OUTPUT_SCHEMA_VERSION,
            },
          },
        });
        if (prompt === null || schema === null) throw artifactNotFound();
        const payloadHash = hash({
          documentId: document.id,
          documentVersionId: version.id,
          promptArtifactId: prompt.id,
          promptHash: prompt.bodyHash,
          schemaArtifactId: schema.id,
          schemaHash: schema.schemaHash,
        });
        const existingByKey = await transaction.documentAnalysisRequest.findUnique({
          where: { idempotencyKey: command.idempotencyKey },
        });
        if (existingByKey !== null) {
          if (existingByKey.payloadHash !== payloadHash) throw idempotencyConflict();
          return receiptOf(existingByKey);
        }
        const existingVersion = await transaction.documentAnalysisRequest.findFirst({
          where: {
            kind: "readiness",
            documentId: document.id,
            currentDocumentVersionId: version.id,
            promptArtifactId: prompt.id,
            outputSchemaArtifactId: schema.id,
          },
          orderBy: { createdAt: "desc" },
        });
        if (existingVersion !== null) return receiptOf(existingVersion);
        const requestId = randomUUID();
        const operationId = requestId;
        await transaction.operation.create({
          data: {
            id: operationId,
            organizationId: identity.organizationId,
            jobType: "analysis-criteria.process",
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
            kind: "readiness",
            idempotencyKey: command.idempotencyKey,
            payloadHash,
            routeKey: "document.analyze",
            documentId: document.id,
            currentDocumentVersionId: version.id,
            expectedAggregateVersion: document.currentVersion,
            outputSchemaArtifactId: schema.id,
            outputSchemaVersion: READINESS_OUTPUT_SCHEMA_VERSION,
            outputSchemaHash: schema.schemaHash,
            promptArtifactId: prompt.id,
            promptVersion: READINESS_PROMPT_VERSION,
            promptHash: prompt.bodyHash,
            state: "queued",
            operationId,
          },
        });
        await this.audit.append(transaction, {
          eventType: "document.readiness_requested",
          actor: { kind: "human", id: command.actor.userId },
          effectiveSubjectId: command.actor.userId,
          scopeType: identity.kind,
          scopeId: identity.resourceId,
          targetType: "document_analysis_request",
          targetId: created.id,
          reason: "Document readiness requested",
          safeDiff: { documentVersionId: version.id },
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
      kind: "readiness",
      now,
      execution: this.options.execution,
    });
    const recorded = await recordedReadinessReference(this.database, request);
    if (recorded !== null) {
      await completeAnalysisOperation(this.database, request, recorded, now);
      return recorded;
    }
    if (request.currentDocumentVersionId === null) throw notFound();

    try {
      const outputReference = await withAnalysisHeartbeat(
        this.database,
        request,
        this.options.execution,
        () => this.options.now?.() ?? new Date(),
        async () => {
          const source = await this.sourceLoader.load({
            documentVersionId: request.currentDocumentVersionId!,
          });
          const extraction = await extractSafeSources({
            policy: this.options.extractionPolicy,
            sources: source.sources,
          });
          if (!readinessAllowedByExtraction(extraction)) {
            const output = extractionMissingOutput(source);
            return this.database.$transaction(async (transaction) =>
              persistReadiness(
                transaction,
                request,
                source,
                output,
                extraction.coverage,
                actorId,
                true,
              ),
            );
          }
          const prompt = {
            artifactId: request.promptArtifactId,
            version: request.promptVersion,
            sha256: request.promptHash,
          };
          const built = buildReadinessRequest({
            prompt: { artifactId: prompt.artifactId, sha256: prompt.sha256 },
            templateSections: source.templateSections,
            sources: extraction.sources.flatMap((item) =>
              item.contentBase64 === undefined
                ? []
                : [
                    {
                      reference: item.reference,
                      mediaType: item.mediaType,
                      contentBase64: item.contentBase64,
                    },
                  ],
            ),
          });
          const result = await this.aiRouter.run(
            {
              routeKey: "document.analyze",
              projectId: source.identity.projectId,
              departmentId: source.identity.departmentId,
              systemId: this.options.systemId,
              input: {
                trustedInstruction: built.trustedInstruction,
                untrustedContent: built.untrustedContent,
              },
              inputReference: `document-version:${source.documentVersionId}`,
              inputSchemaVersion: READINESS_INPUT_SCHEMA_VERSION,
              outputSchemaVersion: READINESS_OUTPUT_SCHEMA_VERSION,
              promptTemplateVersion: READINESS_PROMPT_VERSION,
              outputSchema: ReadinessAnalysisOutputSchema,
              sourceReferences: source.sourceReferences,
              classification: "confidential",
              timeoutMs: this.options.timeoutMs,
              requiresHumanApproval: false,
              correlationId,
            },
            async (transaction, output) => ({
              outputReference: await persistReadiness(
                transaction,
                request,
                source,
                output,
                extraction.coverage,
                actorId,
                false,
              ),
            }),
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

  async getParticipantDetail(
    command: Readonly<{
      actor: Actor;
      documentId: string;
    }>,
  ): Promise<import("@evaluation/contracts").ReadinessParticipantDetail> {
    const context = await resolveIdentity(this.database, this.reader, command.documentId);
    await authorizeDocument(
      this.database,
      command.actor,
      context.identity,
      "document.readiness.detail.read",
      new Date(),
    );
    const row = await this.database.documentReadinessCheck.findFirst({
      where: { documentId: command.documentId, stale: false },
      orderBy: { createdAt: "desc" },
      include: {
        lifecycleTransitions: { orderBy: [{ effectiveAt: "desc" }, { id: "desc" }], take: 1 },
      },
    });
    if (row === null || row.lifecycleTransitions[0] === undefined) throw notFound();
    const output = ReadinessAnalysisOutputSchema.parse(row.output);
    return ReadinessParticipantDetailSchema.parse({
      readinessCheckId: row.id,
      documentVersionId: row.documentVersionId,
      lifecycleState: row.lifecycleTransitions[0].toState,
      missingItems: output.missingItems,
      sourceReferences: output.sourceReferences,
      analyzedAt: row.createdAt.toISOString(),
    });
  }

  async getOperationalSummary(
    command: Readonly<{
      actor: Actor;
      documentId: string;
    }>,
  ): Promise<import("@evaluation/contracts").ManagerReadinessSummary> {
    const context = await resolveIdentity(this.database, this.reader, command.documentId);
    await authorizeDocument(
      this.database,
      command.actor,
      context.identity,
      "document.readiness.summary.read",
      new Date(),
    );
    const row = await this.database.documentReadinessCheck.findFirst({
      where: { documentId: command.documentId, stale: false },
      orderBy: { createdAt: "desc" },
      select: { managerState: true },
    });
    if (row === null) throw notFound();
    return ManagerReadinessSummarySchema.parse({ state: row.managerState });
  }
}

export function readinessAllowedByExtraction(
  extraction: import("./analysis-model.js").ExtractionBundle,
): boolean {
  return (
    extraction.coverage === "complete" &&
    extraction.sources.length > 0 &&
    extraction.sources.some(
      (source) =>
        source.coverage === "complete" &&
        (source.mediaType === "text/plain" ||
          source.mediaType === "text/markdown" ||
          source.mediaType ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    )
  );
}

export function mapManagerReadiness(
  state: "incomplete" | "ready_for_criteria_generation",
  missingItems: readonly Readonly<{ templateSectionKey: string }>[],
  templateSections: readonly import("./analysis-model.js").AnalysisTemplateSection[],
  extractionComplete: boolean,
) {
  if (state === "ready_for_criteria_generation" && extractionComplete)
    return { state: "ready" } as const;
  if (!extractionComplete) return { state: "missing_critical_information" } as const;
  const criticalKeys = new Set(
    templateSections
      .filter((section) => section.required || section.protected)
      .map((section) => section.key),
  );
  if (missingItems.some((item) => criticalKeys.has(item.templateSectionKey)))
    return { state: "missing_critical_information" } as const;
  return { state: "needs_attention" } as const;
}

async function persistReadiness(
  transaction: import("./model.js").DocumentTransaction,
  request: import("./analysis-execution.js").AnalysisRequestSnapshot,
  source: import("./analysis-model.js").CanonicalAnalysisSources,
  rawOutput: import("@evaluation/contracts").ReadinessAnalysisOutput,
  extractionCoverage: "complete" | "unsupported" | "failed",
  actorId: string,
  forceIncomplete: boolean,
): Promise<string> {
  await transaction.$queryRaw`SELECT id FROM "DocumentAnalysisRequest" WHERE id = ${request.id}::uuid FOR UPDATE`;
  await assertAnalysisFence(transaction, request, new Date());
  const existing = await transaction.documentAnalysisRequest.findUnique({
    where: { id: request.id },
    select: { state: true, resultReference: true },
  });
  if (existing?.state === "succeeded" && existing.resultReference !== null)
    return existing.resultReference;
  if (existing?.state === "superseded") {
    const stale = await transaction.documentReadinessCheck.findUnique({
      where: { requestId: request.id },
      select: { outputReference: true },
    });
    if (stale !== null) return stale.outputReference;
  }
  const parsed = ReadinessAnalysisOutputSchema.parse(rawOutput);
  assertBoundSourceReferences(parsed, source.sourceReferences);
  await transaction.$queryRaw`SELECT id FROM "DocumentRecord" WHERE id = ${source.documentId}::uuid FOR UPDATE`;
  const currentDocument = await transaction.documentRecord.findUnique({
    where: { id: source.documentId },
    select: { currentVersion: true },
  });
  const stale = currentDocument?.currentVersion !== request.expectedAggregateVersion;
  const analyzedState =
    forceIncomplete || !readinessAllowedByOutputCoverage(parsed, extractionCoverage)
      ? "incomplete"
      : parsed.state;
  const manager = mapManagerReadiness(
    analyzedState,
    parsed.missingItems,
    source.templateSections,
    extractionCoverage === "complete",
  );
  const id = randomUUID();
  const outputReference = `document-readiness:${id}`;
  const row = await transaction.documentReadinessCheck.create({
    data: {
      id,
      requestId: request.id,
      documentId: source.documentId,
      documentVersionId: source.documentVersionId,
      templateVersionId: source.templateVersionId,
      analyzedState,
      managerState: manager.state,
      extractionCoverage:
        extractionCoverage === "complete"
          ? "complete"
          : extractionCoverage === "failed"
            ? "failed"
            : "unsupported",
      output: parsed,
      outputReference,
      inputSchemaVersion: READINESS_INPUT_SCHEMA_VERSION,
      outputSchemaVersion: READINESS_OUTPUT_SCHEMA_VERSION,
      promptVersion: request.promptVersion,
      promptHash: request.promptHash,
      validationOutcome: "valid",
      stale,
      sourceReferences: [...source.sourceReferences],
      createdById: actorId,
    },
  });
  const transitionAt = new Date();
  await transaction.documentReadinessLifecycleTransition.create({
    data: {
      readinessCheckId: row.id,
      documentVersionId: source.documentVersionId,
      fromState: "draft",
      toState: analyzedState,
      actorId,
      reason: "Validated readiness analysis",
      effectiveAt: transitionAt,
    },
  });
  if (stale) {
    await transaction.documentReadinessLifecycleTransition.create({
      data: {
        readinessCheckId: row.id,
        documentVersionId: source.documentVersionId,
        fromState: analyzedState,
        toState: "superseded",
        actorId,
        reason: "Newer document version exists",
        effectiveAt: new Date(transitionAt.getTime() + 1),
      },
    });
  }
  if (!stale) {
    const prior = await transaction.documentReadinessCheck.findFirst({
      where: { documentId: source.documentId, id: { not: row.id }, stale: false },
      orderBy: { createdAt: "desc" },
      include: {
        lifecycleTransitions: { orderBy: [{ effectiveAt: "desc" }, { id: "desc" }], take: 1 },
      },
    });
    if (prior !== null && prior.lifecycleTransitions[0]?.toState !== "superseded") {
      await transaction.documentReadinessCheck.update({
        where: { id: prior.id },
        data: { stale: true },
      });
      await transaction.documentReadinessLifecycleTransition.create({
        data: {
          readinessCheckId: prior.id,
          documentVersionId: prior.documentVersionId,
          fromState: prior.lifecycleTransitions[0]?.toState ?? prior.analyzedState,
          toState: "superseded",
          actorId,
          reason: "New document version analyzed",
          effectiveAt: new Date(),
        },
      });
    }
  }
  await transaction.documentAnalysisRequest.update({
    where: { id: request.id },
    data: {
      state: stale ? "superseded" : "succeeded",
      resultReference: stale ? null : outputReference,
      completedAt: new Date(),
    },
  });
  await recordAnalysisEffect(transaction, request, outputReference);
  return outputReference;
}

async function recordedReadinessReference(
  database: import("./model.js").DocumentDatabase,
  request: import("./analysis-execution.js").AnalysisRequestSnapshot,
) {
  if (request.state === "succeeded" && request.resultReference !== null)
    return request.resultReference;
  if (request.state !== "superseded") return null;
  const result = await database.documentReadinessCheck.findUnique({
    where: { requestId: request.id },
    select: { outputReference: true },
  });
  if (result === null) throw invalidState();
  return result.outputReference;
}

function extractionMissingOutput(source: import("./analysis-model.js").CanonicalAnalysisSources) {
  const reference = source.sourceReferences[0] ?? `document-version:${source.documentVersionId}`;
  return {
    state: "incomplete" as const,
    missingItems: [
      {
        templateSectionKey: "extraction_coverage",
        missingItem: "Required document content could not be safely extracted",
        whyItMatters: "Readiness must be grounded in the original stored document",
        correctionInstruction:
          "Update the original document in a safely extractable text or DOCX format, then upload a new version.",
        sourceReferences: [reference],
      },
    ],
    sourceReferences:
      source.sourceReferences.length > 0 ? [...source.sourceReferences] : [reference],
  };
}

function readinessAllowedByOutputCoverage(
  output: import("@evaluation/contracts").ReadinessAnalysisOutput,
  coverage: string,
) {
  return output.state !== "ready_for_criteria_generation" || coverage === "complete";
}
function assertBoundSourceReferences(
  output: import("@evaluation/contracts").ReadinessAnalysisOutput,
  allowed: readonly string[],
) {
  const references = [
    ...output.sourceReferences,
    ...output.missingItems.flatMap((item) => item.sourceReferences),
  ];
  if (references.some((reference) => !allowed.includes(reference))) {
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
    documentVersionIds: [row.currentDocumentVersionId].filter(Boolean),
  };
}
function resourceReference(record: { projectId: string | null; workstreamId: string | null }) {
  if (record.workstreamId !== null)
    return { kind: "workstream" as const, resourceId: record.workstreamId };
  if (record.projectId !== null) return { kind: "project" as const, resourceId: record.projectId };
  throw notFound();
}
async function resolveIdentity(
  database: import("./model.js").DocumentDatabase,
  reader: import("./model.js").DocumentResourceIdentityReader,
  documentId: string,
) {
  const row = await database.documentRecord.findUnique({
    where: { id: documentId },
    select: { projectId: true, workstreamId: true },
  });
  if (row === null) throw notFound();
  const identity = await reader.read(resourceReference(row));
  if (identity === null) throw notFound();
  return { identity };
}
function notFound() {
  return new AppError("RESOURCE_NOT_FOUND", "errors.documents.resourceNotFound", 404);
}
function artifactNotFound() {
  return new AppError("AI_ARTIFACT_NOT_FOUND", "errors.ai.artifactNotFound", 500);
}
function idempotencyConflict() {
  return new AppError("IDEMPOTENCY_CONFLICT", "errors.idempotencyConflict", 409);
}
function invalidState() {
  return new AppError("RESOURCE_STATE_INVALID", "errors.documents.resourceStateInvalid", 409);
}
