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
  snapshotIn(
    transaction: import("./model.js").CriteriaTransaction,
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
  getPrerequisitesIn(
    transaction: import("./model.js").CriteriaTransaction,
    input: Readonly<{ documentVersionId: string }>,
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
        kind: CriteriaKind;
        requestId: string;
        documentVersionId: string;
        readinessCheckId: string;
        ownerId: string;
        contributorIds: readonly string[];
        replacesProposalId: string | null;
        materialComparisonReviewId: string | null;
        schemaArtifactId: string;
        schemaArtifactHash: string;
        promptArtifactId: string;
        promptArtifactHash: string;
        expectedSnapshotVersion: number;
      }>;
    }>,
  ): Promise<unknown>;
}>;

type WorkstreamReviewPublisher = Readonly<{
  publish(
    transaction: import("./model.js").CriteriaTransaction,
    input: Readonly<{
      proposal: Readonly<Record<string, unknown>>;
      identity: CriteriaReviewIdentity;
      actorId: string;
      reason: string;
      correlationId: string;
      publishedAt: Date;
    }>,
  ): Promise<DynamicCriteriaProposalDetail>;
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
  contributorIds: readonly string[];
  promptArtifactId: string;
  promptVersion: string;
  promptHash: string;
  outputSchemaArtifactId: string;
  outputSchemaVersion: string;
  outputSchemaHash: string;
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
  private readonly workstreamPublisher: WorkstreamReviewPublisher;
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
    workstreamPublisher: WorkstreamReviewPublisher,
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
    this.workstreamPublisher = workstreamPublisher;
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
        const currentPrerequisites = await this.documentReader.getPrerequisitesIn(transaction, {
          documentVersionId: command.documentVersionId,
        });
        const currentIdentity = await this.reviewReader.snapshotIn(transaction, {
          kind: command.kind,
          resourceId: command.resourceId,
          at,
        });
        if (
          currentPrerequisites === null ||
          currentIdentity === null ||
          !samePrerequisites(prerequisites, currentPrerequisites) ||
          !sameIdentity(identity, currentIdentity) ||
          currentIdentity.primaryOwnerId !== command.actor.userId
        ) {
          throw invalidPrerequisites();
        }
        await validateReplacementPins(transaction, command, currentPrerequisites);
        const document = await transaction.documentRecord.findUnique({
          where: { id: currentPrerequisites.documentId },
        });
        const version = await transaction.documentVersion.findUnique({
          where: { id: currentPrerequisites.documentVersionId },
        });
        if (
          document === null ||
          version === null ||
          document.currentVersion !== currentPrerequisites.documentVersion
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
          documentVersionId: currentPrerequisites.documentVersionId,
          readinessCheckId: currentPrerequisites.readinessCheckId,
          ownerId: currentIdentity.primaryOwnerId,
          contributorIds: currentIdentity.contributorIds,
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
            organizationId: currentIdentity.organizationId,
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
            documentId: currentPrerequisites.documentId,
            currentDocumentVersionId: currentPrerequisites.documentVersionId,
            pinnedReadinessCheckId: currentPrerequisites.readinessCheckId,
            pinnedProposalId: command.replacesProposalId ?? null,
            expectedAggregateVersion: currentPrerequisites.documentVersion,
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
          organizationId: currentIdentity.organizationId,
          departmentId: currentIdentity.departmentId,
          projectId: currentIdentity.projectId,
          idempotencyKey: command.idempotencyKey,
          payload: {
            type: "criteria.generate.v1",
            kind: command.kind,
            requestId: row.id,
            documentVersionId: currentPrerequisites.documentVersionId,
            readinessCheckId: currentPrerequisites.readinessCheckId,
            ownerId: currentIdentity.primaryOwnerId,
            contributorIds: [...currentIdentity.contributorIds],
            replacesProposalId: command.replacesProposalId ?? null,
            materialComparisonReviewId: command.materialComparisonReviewId ?? null,
            schemaArtifactId: schema.id,
            schemaArtifactHash: schema.schemaHash,
            promptArtifactId: prompt.id,
            promptArtifactHash: prompt.bodyHash,
            expectedSnapshotVersion: currentPrerequisites.documentVersion,
          },
        });
        await this.audit.append(transaction, {
          eventType: "dynamic_criteria.generation_requested",
          actor: { kind: "human", id: command.actor.userId },
          effectiveSubjectId: command.actor.userId,
          scopeType: command.kind,
          scopeId: command.resourceId,
          targetType: "document_analysis_request",
          targetId: row.id,
          reason: "Dynamic criteria generation requested",
          safeDiff: {
            documentVersionId: currentPrerequisites.documentVersionId,
            readinessCheckId: currentPrerequisites.readinessCheckId,
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
    await transaction.$queryRaw`SELECT id FROM "DocumentAnalysisRequest" WHERE id = ${request.id}::uuid FOR UPDATE`;
    await transaction.$queryRaw`SELECT id FROM "DocumentRecord" WHERE id = ${request.documentId}::uuid FOR UPDATE`;
    await transaction.$queryRaw`SELECT id FROM "DocumentReadinessCheck" WHERE id = ${request.readinessCheckId}::uuid FOR UPDATE`;
    const requestRow = await transaction.documentAnalysisRequest.findUnique({
      where: { id: request.id },
    });
    const document = await transaction.documentRecord.findUnique({
      where: { id: request.documentId },
    });
    const readiness = await transaction.documentReadinessCheck.findUnique({
      where: { id: request.readinessCheckId },
      include: {
        lifecycleTransitions: {
          orderBy: [{ effectiveAt: "desc" }, { id: "desc" }],
          take: 1,
        },
      },
    });
    const owner = await this.reviewReader.snapshotIn(transaction, {
      kind: request.kind,
      resourceId: request.resourceId,
      at: this.options.now?.() ?? new Date(),
    });
    const latestLifecycle = readiness?.lifecycleTransitions[0]?.toState;
    if (
      requestRow === null ||
      document === null ||
      readiness === null ||
      owner === null ||
      requestRow.state !== "running" ||
      requestRow.kind !==
        (request.kind === "project" ? "criteria_project" : "criteria_workstream") ||
      requestRow.routeKey !== request.routeKey ||
      requestRow.currentDocumentVersionId !== request.documentVersionId ||
      requestRow.pinnedReadinessCheckId !== request.readinessCheckId ||
      requestRow.pinnedProposalId !== request.replacesProposalId ||
      requestRow.expectedAggregateVersion !== request.expectedDocumentVersion ||
      requestRow.promptArtifactId !== request.promptArtifactId ||
      requestRow.promptVersion !== request.promptVersion ||
      requestRow.promptHash !== request.promptHash ||
      requestRow.outputSchemaArtifactId !== request.outputSchemaArtifactId ||
      requestRow.outputSchemaVersion !== request.outputSchemaVersion ||
      requestRow.outputSchemaHash !== request.outputSchemaHash ||
      document.currentVersion !== request.expectedDocumentVersion ||
      readiness.documentVersionId !== request.documentVersionId ||
      readiness.analyzedState !== "ready_for_criteria_generation" ||
      readiness.stale ||
      !["ready_for_criteria_generation", "revision_required"].includes(latestLifecycle ?? "") ||
      !sameIdentity(owner, {
        kind: request.kind,
        resourceId: request.resourceId,
        projectId: request.projectId,
        organizationId: request.organizationId,
        departmentId: request.departmentId,
        primaryOwnerId: request.ownerId,
        contributorIds: request.contributorIds,
      })
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
    await validateReplacementPins(
      transaction,
      {
        kind: request.kind,
        resourceId: request.resourceId,
        documentVersionId: request.documentVersionId,
        ...(request.replacesProposalId === null
          ? {}
          : { replacesProposalId: request.replacesProposalId }),
        ...(request.ownerFeedback === null ? {} : { ownerFeedback: request.ownerFeedback }),
        ...(request.materialComparisonReviewId === null
          ? {}
          : { materialComparisonReviewId: request.materialComparisonReviewId }),
      },
      {
        documentId: request.documentId,
        documentVersionId: request.documentVersionId,
        documentVersion: request.expectedDocumentVersion,
        readinessCheckId: request.readinessCheckId,
        lifecycleState: latestLifecycle as import("@evaluation/contracts").ReadinessLifecycleState,
        projectId: request.projectId,
        workstreamId: request.kind === "workstream" ? request.resourceId : null,
        sourceReferences: [],
      },
    );

    await lockCriteriaScope(transaction, request);
    const proposalNumber =
      (await transaction.dynamicCriteriaProposal.count({
        where:
          request.kind === "project"
            ? { projectId: request.resourceId }
            : { workstreamId: request.resourceId },
      })) + 1;
    const outputReference = request.outputReference ?? `criteria-proposal:${randomUUID()}`;
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
        outputReference,
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
    await transaction.documentAnalysisRequest.update({
      where: { id: request.id },
      data: {
        state: "succeeded",
        resultReference: outputReference,
        completedAt: this.options.now?.() ?? new Date(),
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
        const identity = await this.reviewReader.snapshotIn(transaction, {
          kind: proposal.kind,
          resourceId,
          at,
        });
        if (identity === null || identity.primaryOwnerId !== command.actor.userId) {
          throw forbidden();
        }
        if (review.action === "approve" && proposal.kind === "workstream") {
          return this.workstreamPublisher.publish(transaction, {
            proposal: proposal as unknown as Readonly<Record<string, unknown>>,
            identity,
            actorId: command.actor.userId,
            reason: review.reason,
            correlationId: command.correlationId,
            publishedAt: at,
          });
        }
        const toState =
          review.action === "approve"
            ? "approved"
            : review.action === "reject"
              ? "rejected"
              : "superseded";
        assertProposalTransition(proposal.state, toState);
        const version = proposal.version + 1;
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
        await this.audit.append(transaction, {
          eventType: "dynamic_criteria.owner_reviewed",
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

function samePrerequisites(
  expected: CriteriaDocumentPrerequisites,
  actual: CriteriaDocumentPrerequisites,
): boolean {
  return (
    expected.documentId === actual.documentId &&
    expected.documentVersionId === actual.documentVersionId &&
    expected.documentVersion === actual.documentVersion &&
    expected.readinessCheckId === actual.readinessCheckId &&
    expected.lifecycleState === actual.lifecycleState &&
    expected.projectId === actual.projectId &&
    expected.workstreamId === actual.workstreamId
  );
}

function sameIdentity(expected: CriteriaReviewIdentity, actual: CriteriaReviewIdentity): boolean {
  return (
    expected.kind === actual.kind &&
    expected.resourceId === actual.resourceId &&
    expected.projectId === actual.projectId &&
    expected.organizationId === actual.organizationId &&
    expected.departmentId === actual.departmentId &&
    expected.primaryOwnerId === actual.primaryOwnerId &&
    sameContributorIds(expected.contributorIds, actual.contributorIds)
  );
}

function sameContributorIds(expected: readonly string[], actual: readonly string[]): boolean {
  return expected.length === actual.length && expected.every((id, index) => id === actual[index]);
}

async function lockCriteriaScope(
  transaction: import("./model.js").CriteriaTransaction,
  request: CriteriaGenerationRequestSnapshot,
): Promise<void> {
  if (request.kind === "project") {
    await transaction.$queryRaw`SELECT id FROM "Project" WHERE id = ${request.resourceId}::uuid FOR UPDATE`;
    return;
  }
  await transaction.$queryRaw`SELECT id FROM "Workstream" WHERE id = ${request.resourceId}::uuid FOR UPDATE`;
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

async function validateReplacementPins(
  transaction: import("./model.js").CriteriaTransaction,
  command: Readonly<{
    kind: CriteriaKind;
    resourceId: string;
    documentVersionId: string;
    replacesProposalId?: string;
    ownerFeedback?: string;
    materialComparisonReviewId?: string;
  }>,
  prerequisites: CriteriaDocumentPrerequisites,
): Promise<void> {
  if (command.replacesProposalId === undefined) {
    if (command.ownerFeedback !== undefined || command.materialComparisonReviewId !== undefined) {
      throw replacementInvalid();
    }
    return;
  }
  if (!command.ownerFeedback?.trim()) throw replacementInvalid();
  await transaction.$queryRaw`SELECT id FROM "DynamicCriteriaProposal" WHERE id = ${command.replacesProposalId}::uuid FOR UPDATE`;
  const prior = await transaction.dynamicCriteriaProposal.findUnique({
    where: { id: command.replacesProposalId },
    include: {
      transitions: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      },
    },
  });
  const priorResourceId = prior?.kind === "project" ? prior.projectId : prior?.workstreamId;
  if (
    prior === null ||
    prior.kind !== command.kind ||
    priorResourceId !== command.resourceId ||
    prior.state !== "superseded" ||
    !prior.transitions.some(
      ({ fromState, toState }) => fromState === "owner_review" && toState === "superseded",
    )
  ) {
    throw replacementInvalid();
  }
  if (command.materialComparisonReviewId === undefined) {
    if (
      prerequisites.lifecycleState !== "ready_for_criteria_generation" ||
      prior.sourceDocumentVersionId !== command.documentVersionId
    ) {
      throw replacementInvalid();
    }
    return;
  }
  const materialReview = await transaction.documentComparisonReview.findUnique({
    where: { id: command.materialComparisonReviewId },
    include: {
      comparison: {
        select: { beforeVersionId: true, afterVersionId: true },
      },
    },
  });
  if (
    prerequisites.lifecycleState !== "revision_required" ||
    materialReview === null ||
    materialReview.effectiveClassification !== "material_scope_or_goal_change" ||
    materialReview.comparison.beforeVersionId !== prior.sourceDocumentVersionId ||
    materialReview.comparison.afterVersionId !== command.documentVersionId
  ) {
    throw replacementInvalid();
  }
}

function replacementInvalid(): AppError {
  return new AppError("CRITERIA_REPLACEMENT_INVALID", "errors.criteria.replacementInvalid", 409);
}
