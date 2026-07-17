import { createHash, randomUUID } from "node:crypto";

import {
  AppError,
  CriteriaGenerationOutputSchema,
  OwnerReviewCriteriaSchema,
} from "@evaluation/contracts";

import { assertCriterionCount, assertProposalTransition } from "./invariants.js";
import {
  CRITERIA_GENERATION_OUTPUT_SCHEMA_VERSION,
  CRITERIA_GENERATION_PROMPT_VERSION,
} from "./prompts.js";

type Actor = Readonly<{ userId: string; active: boolean }>;
type CriteriaKind = import("./model.js").CriteriaKind;
type CriteriaOutput = import("@evaluation/contracts").CriteriaGenerationOutput;
type CriteriaItem = import("@evaluation/contracts").CriterionProposalItem;

type CriteriaReviewIdentity = Readonly<{
  kind: CriteriaKind;
  resourceId: string;
  projectId: string;
  organizationId: string;
  departmentId: string;
  primaryOwnerId: string;
  contributorIds: readonly string[];
}>;

type CriteriaReviewReader = Readonly<{
  snapshot(
    input: Readonly<{
      kind: CriteriaKind;
      resourceId: string;
      at: Date;
    }>,
  ): Promise<CriteriaReviewIdentity | null>;
}>;

type CriteriaDocumentPrerequisites = Readonly<{
  documentId: string;
  documentVersionId: string;
  documentVersion: number;
  readinessCheckId: string;
  lifecycleState: import("@evaluation/contracts").ReadinessLifecycleState;
  projectId: string;
  workstreamId: string | null;
  sourceReferences: readonly string[];
}>;

type CriteriaDocumentReader = Readonly<{
  getPrerequisites(
    input: Readonly<{
      documentVersionId: string;
    }>,
  ): Promise<CriteriaDocumentPrerequisites | null>;
}>;

type CriteriaSourceLoader = Readonly<{
  load(input: Readonly<{ documentVersionId: string }>): Promise<
    Readonly<{
      sources: readonly Readonly<{
        reference: string;
        mediaType: string;
        contentBase64: string;
      }>[];
    }>
  >;
}>;

type CriteriaRouter = Readonly<{
  run(input: Readonly<Record<string, unknown>>): Promise<
    Readonly<{
      runId: string;
      output: unknown;
      outputReference: string;
      requiresHumanApproval: boolean;
    }>
  >;
}>;

type CriteriaRequestOutbox = Readonly<{
  append(
    transaction: import("./model.js").CriteriaTransaction,
    input: Readonly<{
      jobType: "analysis-criteria.process";
      jobVersion: 1;
      operationId: string;
      correlationId: string;
      organizationId: string;
      departmentId: string;
      projectId: string;
      idempotencyKey: string;
      payload: Readonly<{
        type: "criteria.generate.v1";
        requestId: string;
        documentVersionId: string;
        readinessCheckId: string;
        proposalId: string | null;
        schemaArtifactId: string;
        schemaArtifactHash: string;
        promptArtifactId: string;
        promptArtifactHash: string;
        expectedSnapshotVersion: number;
      }>;
    }>,
  ): Promise<unknown>;
}>;

export type CriteriaGenerationRequestSnapshot = Readonly<{
  id: string;
  kind: CriteriaKind;
  routeKey: `criteria.generate.${CriteriaKind}`;
  state: "queued" | "running" | "succeeded" | "failed" | "superseded";
  operationId: string;
  documentId: string;
  documentVersionId: string;
  readinessCheckId: string;
  expectedDocumentVersion: number;
  resourceId: string;
  projectId: string;
  organizationId: string;
  departmentId: string;
  ownerId: string;
  promptArtifactId: string;
  promptVersion: string;
  promptHash: string;
  outputSchemaVersion: string;
  replacesProposalId: string | null;
  materialComparisonReviewId: string | null;
  ownerFeedback: string | null;
  createdById: string;
  outputReference?: string;
}>;

export type DynamicCriteriaProposalDetail = Readonly<{
  id?: string;
  kind: CriteriaKind;
  state: import("./model.js").CriteriaProposalState;
  version: number;
  items: readonly CriteriaItem[];
  [key: string]: unknown;
}>;

export class ProposalService {
  private readonly database: import("./model.js").CriteriaDatabase;
  private readonly documentReader: CriteriaDocumentReader;
  private readonly reviewReader: CriteriaReviewReader;
  private readonly sourceLoader: CriteriaSourceLoader;
  private readonly aiRouter: CriteriaRouter;
  private readonly audit: import("./model.js").CriteriaAuditWriter;
  private readonly outbox: CriteriaRequestOutbox;
  private readonly options: Readonly<{
    systemId: string;
    timeoutMs: number;
    now?: () => Date;
  }>;

  constructor(
    database: import("./model.js").CriteriaDatabase,
    documentReader: CriteriaDocumentReader,
    reviewReader: CriteriaReviewReader,
    sourceLoader: CriteriaSourceLoader,
    aiRouter: CriteriaRouter,
    audit: import("./model.js").CriteriaAuditWriter,
    outbox: CriteriaRequestOutbox,
    options: Readonly<{
      systemId: string;
      timeoutMs: number;
      now?: () => Date;
    }>,
  ) {
    this.database = database;
    this.documentReader = documentReader;
    this.reviewReader = reviewReader;
    this.sourceLoader = sourceLoader;
    this.aiRouter = aiRouter;
    this.audit = audit;
    this.outbox = outbox;
    this.options = options;
  }

  async requestGeneration(
    command: Readonly<{
      actor: Actor;
      correlationId: string;
      kind: CriteriaKind;
      resourceId: string;
      documentVersionId: string;
      idempotencyKey: string;
      replacesProposalId?: string;
      ownerFeedback?: string;
      materialComparisonReviewId?: string;
    }>,
  ): Promise<
    Readonly<{
      requestId: string;
      operationId: string;
      state: string;
      documentId: string;
      documentVersionIds: readonly string[];
    }>
  > {
    if (!command.actor.active) throw forbidden();
    const at = this.options.now?.() ?? new Date();
    const [prerequisites, identity] = await Promise.all([
      this.documentReader.getPrerequisites({ documentVersionId: command.documentVersionId }),
      this.reviewReader.snapshot({
        kind: command.kind,
        resourceId: command.resourceId,
        at,
      }),
    ]);
    if (
      prerequisites === null ||
      identity === null ||
      identity.primaryOwnerId !== command.actor.userId ||
      prerequisites.documentVersionId !== command.documentVersionId ||
      (command.kind === "project"
        ? prerequisites.projectId !== command.resourceId || prerequisites.workstreamId !== null
        : prerequisites.workstreamId !== command.resourceId)
    ) {
      throw forbidden();
    }
    if (
      command.replacesProposalId === undefined &&
      prerequisites.lifecycleState !== "ready_for_criteria_generation"
    ) {
      throw invalidPrerequisites();
    }
    if (
      command.replacesProposalId !== undefined &&
      !["ready_for_criteria_generation", "revision_required"].includes(prerequisites.lifecycleState)
    ) {
      throw invalidPrerequisites();
    }

    const routeKey = `criteria.generate.${command.kind}` as const;
    const pinned = await this.database.$transaction(
      async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM "DocumentRecord" WHERE id = ${prerequisites.documentId}::uuid FOR UPDATE`;
        const document = await transaction.documentRecord.findUnique({
          where: { id: prerequisites.documentId },
        });
        const version = await transaction.documentVersion.findUnique({
          where: { id: prerequisites.documentVersionId },
        });
        if (
          document === null ||
          version === null ||
          document.currentVersion !== prerequisites.documentVersion
        ) {
          throw invalidPrerequisites();
        }
        const prompt = await transaction.analysisPromptArtifact.findUnique({
          where: {
            routeKey_version: {
              routeKey,
              version: CRITERIA_GENERATION_PROMPT_VERSION,
            },
          },
        });
        const schema = await transaction.aiOutputSchemaArtifact.findUnique({
          where: {
            routeKey_version: {
              routeKey,
              version: CRITERIA_GENERATION_OUTPUT_SCHEMA_VERSION,
            },
          },
        });
        if (prompt === null || schema === null) throw artifactNotFound();
        const payloadHash = sha256({
          kind: command.kind,
          resourceId: command.resourceId,
          documentVersionId: prerequisites.documentVersionId,
          readinessCheckId: prerequisites.readinessCheckId,
          ownerId: identity.primaryOwnerId,
          replacesProposalId: command.replacesProposalId ?? null,
          materialComparisonReviewId: command.materialComparisonReviewId ?? null,
          ownerFeedback: command.ownerFeedback ?? null,
          promptArtifactId: prompt.id,
          promptHash: prompt.bodyHash,
          outputSchemaArtifactId: schema.id,
          outputSchemaHash: schema.schemaHash,
        });
        const existing = await transaction.documentAnalysisRequest.findUnique({
          where: { idempotencyKey: command.idempotencyKey },
        });
        if (existing !== null) {
          if (existing.payloadHash !== payloadHash) throw idempotencyConflict();
          return existing;
        }
        const requestId = randomUUID();
        const operationId = requestId;
        await transaction.operation.create({
          data: {
            id: operationId,
            organizationId: identity.organizationId,
            jobType: "analysis-criteria.process",
            jobVersion: 1,
            idempotencyKey: `criteria:${command.idempotencyKey}`,
            correlationId: command.correlationId,
            payloadHash,
            status: "pending",
          },
        });
        const row = await transaction.documentAnalysisRequest.create({
          data: {
            id: requestId,
            kind: command.kind === "project" ? "criteria_project" : "criteria_workstream",
            idempotencyKey: command.idempotencyKey,
            payloadHash,
            routeKey,
            documentId: prerequisites.documentId,
            currentDocumentVersionId: prerequisites.documentVersionId,
            pinnedReadinessCheckId: prerequisites.readinessCheckId,
            pinnedProposalId: command.replacesProposalId ?? null,
            expectedAggregateVersion: prerequisites.documentVersion,
            outputSchemaArtifactId: schema.id,
            outputSchemaVersion: CRITERIA_GENERATION_OUTPUT_SCHEMA_VERSION,
            outputSchemaHash: schema.schemaHash,
            promptArtifactId: prompt.id,
            promptVersion: CRITERIA_GENERATION_PROMPT_VERSION,
            promptHash: prompt.bodyHash,
            state: "queued",
            operationId,
          },
        });
        await this.outbox.append(transaction, {
          jobType: "analysis-criteria.process",
          jobVersion: 1,
          operationId: row.operationId,
          correlationId: command.correlationId,
          organizationId: identity.organizationId,
          departmentId: identity.departmentId,
          projectId: identity.projectId,
          idempotencyKey: command.idempotencyKey,
          payload: {
            type: "criteria.generate.v1",
            requestId: row.id,
            documentVersionId: prerequisites.documentVersionId,
            readinessCheckId: prerequisites.readinessCheckId,
            proposalId: command.replacesProposalId ?? null,
            schemaArtifactId: schema.id,
            schemaArtifactHash: schema.schemaHash,
            promptArtifactId: prompt.id,
            promptArtifactHash: prompt.bodyHash,
            expectedSnapshotVersion: prerequisites.documentVersion,
          },
        });
        await this.audit.append(transaction, {
          eventType: "dynamic_criteria_generation_requested",
          actor: { kind: "human", id: command.actor.userId },
          effectiveSubjectId: command.actor.userId,
          scopeType: command.kind,
          scopeId: command.resourceId,
          targetType: "document_analysis_request",
          targetId: row.id,
          reason: "Dynamic criteria generation requested",
          safeDiff: {
            documentVersionId: prerequisites.documentVersionId,
            readinessCheckId: prerequisites.readinessCheckId,
          },
          correlationId: command.correlationId,
          source: "api",
        });
        return row;
      },
      { isolationLevel: "Serializable" },
    );
    void this.sourceLoader;
    void this.aiRouter;
    return receiptOf(pinned);
  }

  async persistValidatedGeneration(
    transaction: import("./model.js").CriteriaTransaction,
    request: CriteriaGenerationRequestSnapshot,
    output: unknown,
  ): Promise<DynamicCriteriaProposalDetail> {
    const candidateCount =
      typeof output === "object" &&
      output !== null &&
      "criteria" in output &&
      Array.isArray(output.criteria)
        ? output.criteria.length
        : Number.NaN;
    assertCriterionCount(request.kind, candidateCount);
    const parsed = CriteriaGenerationOutputSchema.parse(output);
    const [requestRow, document, readiness, owner] = await Promise.all([
      transaction.documentAnalysisRequest.findUnique({ where: { id: request.id } }),
      transaction.documentRecord.findUnique({ where: { id: request.documentId } }),
      transaction.documentReadinessCheck.findUnique({
        where: { id: request.readinessCheckId },
        include: {
          lifecycleTransitions: {
            orderBy: [{ effectiveAt: "desc" }, { id: "desc" }],
            take: 1,
          },
        },
      }),
      this.reviewReader.snapshot({
        kind: request.kind,
        resourceId: request.resourceId,
        at: this.options.now?.() ?? new Date(),
      }),
    ]);
    const latestLifecycle = readiness?.lifecycleTransitions[0]?.toState;
    if (
      requestRow === null ||
      document === null ||
      readiness === null ||
      owner === null ||
      requestRow.state !== "running" ||
      requestRow.currentDocumentVersionId !== request.documentVersionId ||
      requestRow.pinnedReadinessCheckId !== request.readinessCheckId ||
      requestRow.expectedAggregateVersion !== request.expectedDocumentVersion ||
      document.currentVersion !== request.expectedDocumentVersion ||
      readiness.documentVersionId !== request.documentVersionId ||
      readiness.analyzedState !== "ready_for_criteria_generation" ||
      readiness.stale ||
      !["ready_for_criteria_generation", "revision_required"].includes(latestLifecycle ?? "") ||
      owner.primaryOwnerId !== request.ownerId
    ) {
      await transaction.documentAnalysisRequest.update({
        where: { id: request.id },
        data: { state: "superseded", completedAt: this.options.now?.() ?? new Date() },
      });
      return {
        kind: request.kind,
        state: "superseded",
        version: 1,
        items: [],
      };
    }

    const proposalNumber =
      (await transaction.dynamicCriteriaProposal.count({
        where:
          request.kind === "project"
            ? { projectId: request.resourceId }
            : { workstreamId: request.resourceId },
      })) + 1;
    const proposal = await transaction.dynamicCriteriaProposal.create({
      data: {
        requestId: request.id,
        kind: request.kind,
        projectId: request.kind === "project" ? request.resourceId : null,
        workstreamId: request.kind === "workstream" ? request.resourceId : null,
        sourceDocumentVersionId: request.documentVersionId,
        readinessCheckId: request.readinessCheckId,
        materialComparisonReviewId: request.materialComparisonReviewId,
        replacesProposalId: request.replacesProposalId,
        proposalNumber,
        version: 1,
        state: "owner_review",
        outputReference: request.outputReference ?? `criteria-proposal:${randomUUID()}`,
        outputSchemaVersion: request.outputSchemaVersion,
        promptVersion: request.promptVersion,
        promptHash: request.promptHash,
        createdById: request.createdById,
      },
    });
    await transaction.dynamicCriteriaProposalItem.createMany({
      data: parsed.criteria.map((item, index) => ({
        proposalId: proposal.id,
        position: index + 1,
        ...item,
      })),
    });
    await transaction.dynamicCriteriaProposalTransition.create({
      data: {
        proposalId: proposal.id,
        fromState: "owner_review",
        toState: "owner_review",
        actorId: request.createdById,
        reason: "AI generation validated for mandatory owner review",
        resultingVersion: 1,
      },
    });
    const detail = await transaction.dynamicCriteriaProposal.findUnique({
      where: { id: proposal.id },
      include: {
        items: { orderBy: { position: "asc" } },
        transitions: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      },
    });
    if (detail === null) throw notFound();
    return detail as unknown as DynamicCriteriaProposalDetail;
  }

  async reviewByOwner(
    command: Readonly<{
      actor: Actor;
      correlationId: string;
      proposalId: string;
      review: unknown;
    }>,
  ): Promise<DynamicCriteriaProposalDetail> {
    if (!command.actor.active) throw forbidden();
    const review = OwnerReviewCriteriaSchema.parse(command.review);
    const at = this.options.now?.() ?? new Date();
    return this.database.$transaction(
      async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM "DynamicCriteriaProposal" WHERE id = ${command.proposalId}::uuid FOR UPDATE`;
        const proposal = await transaction.dynamicCriteriaProposal.findUnique({
          where: { id: command.proposalId },
          include: {
            items: { orderBy: { position: "asc" } },
            transitions: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
          },
        });
        if (proposal === null) throw notFound();
        if (proposal.state !== "owner_review") throw invalidState();
        const resourceId = proposal.kind === "project" ? proposal.projectId : proposal.workstreamId;
        if (resourceId === null) throw invalidState();
        const identity = await this.reviewReader.snapshot({
          kind: proposal.kind,
          resourceId,
          at,
        });
        if (identity === null || identity.primaryOwnerId !== command.actor.userId) {
          throw forbidden();
        }
        const toState =
          review.action === "approve"
            ? proposal.kind === "project"
              ? "approved"
              : "contributor_review"
            : review.action === "reject"
              ? "rejected"
              : "superseded";
        assertProposalTransition(proposal.state, toState);
        const version = proposal.version + 1;
        const updated = await transaction.dynamicCriteriaProposal.update({
          where: { id: proposal.id },
          data: {
            state: toState,
            version: { increment: 1 },
            ...(toState === "approved" ? { approvedAt: at } : {}),
          },
          include: {
            items: { orderBy: { position: "asc" } },
            transitions: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
          },
        });
        await transaction.dynamicCriteriaProposalTransition.create({
          data: {
            proposalId: proposal.id,
            fromState: proposal.state,
            toState,
            actorId: command.actor.userId,
            reason: review.reason,
            resultingVersion: version,
          },
        });
        await this.audit.append(transaction, {
          eventType: "dynamic_criteria_owner_reviewed",
          actor: { kind: "human", id: command.actor.userId },
          effectiveSubjectId: command.actor.userId,
          scopeType: proposal.kind,
          scopeId: resourceId,
          targetType: "dynamic_criteria_proposal",
          targetId: proposal.id,
          reason: review.reason,
          safeDiff: {
            fromState: proposal.state,
            toState,
            action: review.action,
          },
          correlationId: command.correlationId,
          source: "api",
        });
        return updated as unknown as DynamicCriteriaProposalDetail;
      },
      { isolationLevel: "Serializable" },
    );
  }
}

function receiptOf(row: {
  id: string;
  operationId: string;
  state: string;
  documentId: string;
  currentDocumentVersionId: string | null;
}) {
  return {
    requestId: row.id,
    operationId: row.operationId,
    state: row.state,
    documentId: row.documentId,
    documentVersionIds: row.currentDocumentVersionId === null ? [] : [row.currentDocumentVersionId],
  };
}

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function forbidden(): AppError {
  return new AppError("FORBIDDEN", "errors.authorization.forbidden", 403);
}

function notFound(): AppError {
  return new AppError("RESOURCE_NOT_FOUND", "errors.common.resourceNotFound", 404);
}

function invalidPrerequisites(): AppError {
  return new AppError(
    "CRITERIA_PREREQUISITES_INVALID",
    "errors.criteria.prerequisitesInvalid",
    409,
  );
}

function artifactNotFound(): AppError {
  return new AppError("AI_ARTIFACT_NOT_FOUND", "errors.ai.artifactNotFound", 409);
}

function idempotencyConflict(): AppError {
  return new AppError("IDEMPOTENCY_CONFLICT", "errors.idempotency.conflict", 409);
}

function invalidState(): AppError {
  return new AppError("CRITERIA_TRANSITION_INVALID", "errors.criteria.transitionInvalid", 409);
}
