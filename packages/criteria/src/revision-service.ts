import { createHash, randomUUID } from "node:crypto";

import { AppError, ReviseCriteriaSchema } from "@evaluation/contracts";

import {
  CRITERIA_GENERATION_OUTPUT_SCHEMA_VERSION,
  CRITERIA_GENERATION_PROMPT_VERSION,
} from "./prompts.js";

type Transaction = import("./model.js").CriteriaTransaction;
type CriteriaKind = import("./model.js").CriteriaKind;

export type CriteriaRevisionRequestReceipt = Readonly<{
  requestId: string;
  operationId: string;
  state: "queued" | "running" | "succeeded" | "failed" | "superseded";
  documentId: string;
  documentVersionIds: readonly string[];
}>;

type MaterialRevision = Readonly<{
  comparisonReviewId: string;
  documentId: string;
  beforeDocumentVersionId: string;
  afterDocumentVersionId: string;
  effectiveClassification: string;
  reviewReason?: string;
  isLatestReview: boolean;
  isCurrentAfterVersion: boolean;
}>;

type RevisionDocumentPrerequisites = Readonly<{
  documentId: string;
  documentVersionId: string;
  documentVersion: number;
  readinessCheckId: string;
  lifecycleState: import("@evaluation/contracts").ReadinessLifecycleState;
  projectId: string | null;
  workstreamId: string | null;
}>;

type RevisionDocumentPort = Readonly<{
  lockReviewedMaterialRevisionIn(
    transaction: Transaction,
    input: Readonly<{ comparisonReviewId: string }>,
  ): Promise<MaterialRevision | null>;
  getPrerequisitesIn(
    transaction: Transaction,
    input: Readonly<{ documentVersionId: string }>,
  ): Promise<RevisionDocumentPrerequisites | null>;
  appendLifecycleTransition(
    transaction: Transaction,
    input: Readonly<Record<string, unknown>>,
  ): Promise<void>;
}>;

type RevisionReviewReader = Readonly<{
  snapshotIn(
    transaction: Transaction,
    input: Readonly<{ kind: CriteriaKind; resourceId: string; at: Date }>,
  ): Promise<Readonly<{
    kind: CriteriaKind;
    resourceId: string;
    organizationId: string;
    departmentId: string;
    projectId: string;
    primaryOwnerId: string;
    contributorIds: readonly string[];
  }> | null>;
}>;

type RevisionOutbox = Readonly<{
  append(transaction: Transaction, input: Readonly<Record<string, unknown>>): Promise<unknown>;
}>;

export class RevisionService {
  private readonly database: import("./model.js").CriteriaDatabase;
  private readonly documentPort: RevisionDocumentPort;
  private readonly reviewReader: RevisionReviewReader;
  private readonly audit: import("./model.js").CriteriaAuditWriter;
  private readonly outbox: RevisionOutbox;
  private readonly options: Readonly<{ now?: () => Date }>;

  constructor(
    database: import("./model.js").CriteriaDatabase,
    documentPort: RevisionDocumentPort,
    reviewReader: RevisionReviewReader,
    audit: import("./model.js").CriteriaAuditWriter,
    outbox: RevisionOutbox,
    options: Readonly<{ now?: () => Date }> = {},
  ) {
    this.database = database;
    this.documentPort = documentPort;
    this.reviewReader = reviewReader;
    this.audit = audit;
    this.outbox = outbox;
    this.options = options;
  }

  async start(
    command: Readonly<{
      actor: Readonly<{ userId: string; active: boolean }>;
      correlationId: string;
      kind: CriteriaKind;
      resourceId: string;
      idempotencyKey: string;
      revision: unknown;
    }>,
  ): Promise<CriteriaRevisionRequestReceipt> {
    if (!command.actor.active) throw revisionError("CRITERIA_REVISION_FORBIDDEN", 403);
    const revision = ReviseCriteriaSchema.parse(command.revision);
    const now = this.options.now?.() ?? new Date();

    return this.database.$transaction(
      async (transaction) => {
        const reviewed = await this.documentPort.lockReviewedMaterialRevisionIn(transaction, {
          comparisonReviewId: revision.comparisonReviewId,
        });
        if (
          reviewed === null ||
          reviewed.effectiveClassification !== "material_scope_or_goal_change" ||
          !reviewed.isLatestReview ||
          !reviewed.isCurrentAfterVersion
        ) {
          throw revisionError("MATERIAL_CHANGE_REVIEW_REQUIRED", 409);
        }
        const prerequisites = await this.documentPort.getPrerequisitesIn(transaction, {
          documentVersionId: reviewed.afterDocumentVersionId,
        });
        if (
          prerequisites === null ||
          prerequisites.documentId !== reviewed.documentId ||
          prerequisites.documentVersionId !== reviewed.afterDocumentVersionId ||
          !["ready_for_criteria_generation", "revision_required"].includes(
            prerequisites.lifecycleState,
          )
        ) {
          throw revisionError("CRITERIA_REVISION_READINESS_INVALID", 409);
        }

        await transaction.$queryRaw`
          SELECT id FROM "DynamicCriteriaSet"
          WHERE "effectiveTo" IS NULL
            AND (
              ("kind" = 'project' AND "projectId" = ${command.kind === "project" ? command.resourceId : null}::uuid)
              OR
              ("kind" = 'workstream' AND "workstreamId" = ${command.kind === "workstream" ? command.resourceId : null}::uuid)
            )
          FOR UPDATE
        `;
        const activeSet = await transaction.dynamicCriteriaSet.findFirst({
          where:
            command.kind === "project"
              ? { kind: "project", projectId: command.resourceId, effectiveTo: null }
              : { kind: "workstream", workstreamId: command.resourceId, effectiveTo: null },
          orderBy: { version: "desc" },
        });
        if (
          activeSet === null ||
          activeSet.sourceDocumentVersionId !== reviewed.beforeDocumentVersionId
        ) {
          throw revisionError("CRITERIA_REVISION_LINEAGE_INVALID", 409);
        }
        await transaction.$queryRaw`
          SELECT id FROM "DynamicCriteriaProposal"
          WHERE id = ${activeSet.proposalId}::uuid
          FOR UPDATE
        `;
        const priorProposal = await transaction.dynamicCriteriaProposal.findUnique({
          where: { id: activeSet.proposalId },
        });
        if (priorProposal === null || priorProposal.state !== "activated") {
          throw revisionError("CRITERIA_REVISION_LINEAGE_INVALID", 409);
        }
        const identity = await this.reviewReader.snapshotIn(transaction, {
          kind: command.kind,
          resourceId: command.resourceId,
          at: now,
        });
        const identityScopeMatches =
          identity !== null &&
          identity.kind === command.kind &&
          identity.resourceId === command.resourceId &&
          (command.kind === "project"
            ? prerequisites.projectId === command.resourceId &&
              prerequisites.workstreamId === null &&
              identity.projectId === command.resourceId
            : prerequisites.projectId === null &&
              prerequisites.workstreamId === command.resourceId &&
              identity.projectId.length > 0);
        if (
          identity === null ||
          identity.primaryOwnerId !== command.actor.userId ||
          !identityScopeMatches
        ) {
          throw revisionError("CRITERIA_REVISION_FORBIDDEN", 403);
        }

        const routeKey = `criteria.generate.${command.kind}` as const;
        const prompt = await transaction.analysisPromptArtifact.findUnique({
          where: {
            routeKey_version: { routeKey, version: CRITERIA_GENERATION_PROMPT_VERSION },
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
        if (prompt === null || schema === null) {
          throw revisionError("CRITERIA_ARTIFACT_NOT_FOUND", 500);
        }
        const feedbackHash = createHash("sha256")
          .update(reviewed.reviewReason ?? revision.reason, "utf8")
          .digest("hex");
        const payloadHash = sha256({
          kind: command.kind,
          resourceId: command.resourceId,
          documentVersionId: prerequisites.documentVersionId,
          readinessCheckId: prerequisites.readinessCheckId,
          replacesProposalId: priorProposal.id,
          priorSetId: activeSet.id,
          materialComparisonReviewId: reviewed.comparisonReviewId,
          reason: revision.reason,
          promptArtifactId: prompt.id,
          promptHash: prompt.bodyHash,
          outputSchemaArtifactId: schema.id,
          outputSchemaHash: schema.schemaHash,
        });
        const existing = await transaction.documentAnalysisRequest.findUnique({
          where: { idempotencyKey: command.idempotencyKey },
        });
        if (existing !== null) {
          if (
            existing.payloadHash !== payloadHash ||
            !sameRevisionRequest(existing, {
              kind: command.kind,
              routeKey,
              documentId: prerequisites.documentId,
              documentVersionId: prerequisites.documentVersionId,
              readinessCheckId: prerequisites.readinessCheckId,
              proposalId: priorProposal.id,
              expectedDocumentVersion: prerequisites.documentVersion,
              prompt,
              schema,
            })
          ) {
            throw revisionError("IDEMPOTENCY_CONFLICT", 409);
          }
          return receiptOf(existing);
        }
        if (prerequisites.lifecycleState !== "ready_for_criteria_generation") {
          throw revisionError("CRITERIA_REVISION_READINESS_INVALID", 409);
        }

        await this.documentPort.appendLifecycleTransition(transaction, {
          readinessCheckId: prerequisites.readinessCheckId,
          documentVersionId: prerequisites.documentVersionId,
          fromState: prerequisites.lifecycleState,
          toState: "revision_required",
          actorId: command.actor.userId,
          reason: revision.reason,
          effectiveAt: now,
          comparisonReviewId: reviewed.comparisonReviewId,
        });
        const requestId = randomUUID();
        await transaction.operation.create({
          data: {
            id: requestId,
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
            pinnedProposalId: priorProposal.id,
            expectedAggregateVersion: prerequisites.documentVersion,
            outputSchemaArtifactId: schema.id,
            outputSchemaVersion: CRITERIA_GENERATION_OUTPUT_SCHEMA_VERSION,
            outputSchemaHash: schema.schemaHash,
            promptArtifactId: prompt.id,
            promptVersion: CRITERIA_GENERATION_PROMPT_VERSION,
            promptHash: prompt.bodyHash,
            state: "queued",
            operationId: requestId,
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
            kind: command.kind,
            requestId: row.id,
            documentVersionId: prerequisites.documentVersionId,
            readinessCheckId: prerequisites.readinessCheckId,
            ownerId: identity.primaryOwnerId,
            contributorIds: [...identity.contributorIds],
            replacesProposalId: priorProposal.id,
            materialComparisonReviewId: reviewed.comparisonReviewId,
            ownerFeedbackSource: {
              kind: "comparison_review",
              referenceId: reviewed.comparisonReviewId,
              sha256: feedbackHash,
            },
            schemaArtifactId: schema.id,
            schemaArtifactHash: schema.schemaHash,
            promptArtifactId: prompt.id,
            promptArtifactHash: prompt.bodyHash,
            expectedSnapshotVersion: prerequisites.documentVersion,
          },
        });
        await this.audit.append(transaction, {
          eventType: "dynamic_criteria.revision_requested",
          actor: { kind: "human", id: command.actor.userId },
          effectiveSubjectId: command.actor.userId,
          scopeType: command.kind,
          scopeId: command.resourceId,
          targetType: "document_analysis_request",
          targetId: row.id,
          reason: revision.reason,
          safeDiff: {
            priorSetId: activeSet.id,
            replacesProposalId: priorProposal.id,
            comparisonReviewId: reviewed.comparisonReviewId,
            documentVersionId: prerequisites.documentVersionId,
          },
          correlationId: command.correlationId,
          source: "api",
        });
        return receiptOf(row);
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
}): CriteriaRevisionRequestReceipt {
  return {
    requestId: row.id,
    operationId: row.operationId,
    state: row.state as CriteriaRevisionRequestReceipt["state"],
    documentId: row.documentId,
    documentVersionIds: row.currentDocumentVersionId === null ? [] : [row.currentDocumentVersionId],
  };
}

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function sameRevisionRequest(
  row: any,
  expected: Readonly<{
    kind: CriteriaKind;
    routeKey: string;
    documentId: string;
    documentVersionId: string;
    readinessCheckId: string;
    proposalId: string;
    expectedDocumentVersion: number;
    prompt: Readonly<{ id: string; bodyHash: string }>;
    schema: Readonly<{ id: string; schemaHash: string }>;
  }>,
): boolean {
  return (
    row.kind === (expected.kind === "project" ? "criteria_project" : "criteria_workstream") &&
    row.routeKey === expected.routeKey &&
    row.documentId === expected.documentId &&
    row.currentDocumentVersionId === expected.documentVersionId &&
    row.pinnedReadinessCheckId === expected.readinessCheckId &&
    row.pinnedProposalId === expected.proposalId &&
    row.expectedAggregateVersion === expected.expectedDocumentVersion &&
    row.promptArtifactId === expected.prompt.id &&
    row.promptHash === expected.prompt.bodyHash &&
    row.outputSchemaArtifactId === expected.schema.id &&
    row.outputSchemaHash === expected.schema.schemaHash
  );
}

function revisionError(code: string, status = 422): AppError {
  return new AppError(code, `errors.criteria.${code.toLowerCase()}`, status);
}
