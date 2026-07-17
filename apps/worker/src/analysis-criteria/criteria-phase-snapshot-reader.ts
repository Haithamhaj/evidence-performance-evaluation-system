import { createHash } from "node:crypto";

import type { AnalysisCriteriaJobPayload } from "@evaluation/contracts";

type Transaction = import("@evaluation/database").DatabaseTransaction;
type GenerationJob = Extract<AnalysisCriteriaJobPayload, { type: "criteria.generate.v1" }>;

type DocumentReader = Readonly<{
  getPrerequisitesIn(
    transaction: Transaction,
    input: Readonly<{ documentVersionId: string }>,
  ): Promise<
    | Readonly<{
        documentId: string;
        documentVersionId: string;
        documentVersion: number;
        readinessCheckId: string;
        projectId: string | null;
        workstreamId: string | null;
        sourceReferences: readonly string[];
      }>
    | null
  >;
}>;

type ReviewReader = Readonly<{
  snapshotIn(
    transaction: Transaction,
    input: Readonly<{
      kind: "project" | "workstream";
      resourceId: string;
      at: Date;
    }>,
  ): Promise<
    | Readonly<{
        kind: "project" | "workstream";
        resourceId: string;
        projectId: string;
        organizationId: string;
        departmentId: string;
        primaryOwnerId: string;
        contributorIds: readonly string[];
      }>
    | null
  >;
}>;

export class PrismaCriteriaPhaseSnapshotReader {
  private readonly documentReader: DocumentReader;
  private readonly reviewReader: ReviewReader;

  constructor(documentReader: DocumentReader, reviewReader: ReviewReader) {
    this.documentReader = documentReader;
    this.reviewReader = reviewReader;
  }

  async readIn(
    transaction: Transaction,
    input: Readonly<{ requestId: string; actorId: string; correlationId: string }>,
  ): Promise<
    import("./criteria-analysis-phase-handler.js").CriteriaPhaseSnapshot | null
  > {
    const row = await transaction.documentAnalysisRequest.findUnique({
      where: { id: input.requestId },
      select: {
        id: true,
        kind: true,
        state: true,
        operationId: true,
        documentId: true,
        currentDocumentVersionId: true,
        pinnedReadinessCheckId: true,
        pinnedProposalId: true,
        expectedAggregateVersion: true,
        routeKey: true,
        promptArtifactId: true,
        promptVersion: true,
        promptHash: true,
        outputSchemaArtifactId: true,
        outputSchemaVersion: true,
        outputSchemaHash: true,
        outputSchemaArtifact: {
          select: {
            routeKey: true,
            version: true,
            schemaHash: true,
          },
        },
        promptArtifact: {
          select: {
            routeKey: true,
            version: true,
            bodyHash: true,
          },
        },
        createdAt: true,
      },
    });
    if (
      row === null ||
      !["criteria_project", "criteria_workstream"].includes(row.kind) ||
      row.currentDocumentVersionId === null ||
      row.pinnedReadinessCheckId === null
    )
      return null;
    const kind = row.kind === "criteria_project" ? "project" : "workstream";
    const prerequisites = await this.documentReader.getPrerequisitesIn(transaction, {
      documentVersionId: row.currentDocumentVersionId,
    });
    if (
      prerequisites === null ||
      prerequisites.documentId !== row.documentId ||
      prerequisites.readinessCheckId !== row.pinnedReadinessCheckId
    )
      return null;
    const resourceId =
      kind === "project" ? prerequisites.projectId : prerequisites.workstreamId;
    if (resourceId === null) return null;
    const identity = await this.reviewReader.snapshotIn(transaction, {
      kind,
      resourceId,
      at: row.createdAt,
    });
    if (identity === null || identity.primaryOwnerId !== input.actorId) return null;
    const replacement = await replacementPins(transaction, {
      requestId: row.id,
      correlationId: input.correlationId,
      pinnedProposalId: row.pinnedProposalId,
    });
    if (replacement === null) return null;
    const routeKey = `criteria.generate.${kind}` as const;
    if (
      row.routeKey !== routeKey ||
      row.promptArtifact.routeKey !== routeKey ||
      row.promptArtifact.version !== row.promptVersion ||
      row.promptArtifact.bodyHash !== row.promptHash ||
      row.outputSchemaArtifact.routeKey !== routeKey ||
      row.outputSchemaArtifact.version !== row.outputSchemaVersion ||
      row.outputSchemaArtifact.schemaHash !== row.outputSchemaHash
    )
      return null;
    const request = {
      id: row.id,
      kind,
      routeKey,
      state: row.state,
      operationId: row.operationId,
      documentId: row.documentId,
      documentVersionId: row.currentDocumentVersionId,
      readinessCheckId: row.pinnedReadinessCheckId,
      expectedDocumentVersion: row.expectedAggregateVersion,
      resourceId,
      projectId: identity.projectId,
      organizationId: identity.organizationId,
      departmentId: identity.departmentId,
      ownerId: identity.primaryOwnerId,
      contributorIds: [...identity.contributorIds],
      promptArtifactId: row.promptArtifactId,
      promptVersion: row.promptVersion,
      promptHash: row.promptHash,
      outputSchemaArtifactId: row.outputSchemaArtifactId,
      outputSchemaVersion: row.outputSchemaVersion,
      outputSchemaHash: row.outputSchemaHash,
      replacesProposalId: row.pinnedProposalId,
      materialComparisonReviewId: replacement.materialComparisonReviewId,
      ownerFeedbackSource: replacement.ownerFeedbackSource,
      createdById: input.actorId,
    } satisfies import("@evaluation/criteria").CriteriaGenerationRequestSnapshot;
    const job = {
      type: "criteria.generate.v1",
      kind,
      requestId: row.id,
      documentVersionId: row.currentDocumentVersionId,
      readinessCheckId: row.pinnedReadinessCheckId,
      ownerId: identity.primaryOwnerId,
      contributorIds: [...identity.contributorIds],
      replacesProposalId: row.pinnedProposalId,
      materialComparisonReviewId: replacement.materialComparisonReviewId,
      ownerFeedbackSource: replacement.ownerFeedbackSource,
      schemaArtifactId: row.outputSchemaArtifactId,
      schemaArtifactHash: row.outputSchemaHash,
      promptArtifactId: row.promptArtifactId,
      promptArtifactHash: row.promptHash,
      expectedSnapshotVersion: row.expectedAggregateVersion,
    } satisfies GenerationJob;
    return {
      request,
      job,
      readinessSourceReferences: [...prerequisites.sourceReferences],
    };
  }
}

async function replacementPins(
  transaction: Transaction,
  input: Readonly<{
    requestId: string;
    correlationId: string;
    pinnedProposalId: string | null;
  }>,
): Promise<
  | Readonly<{
      materialComparisonReviewId: string | null;
      ownerFeedbackSource:
        | Readonly<{
            kind: "proposal_transition" | "comparison_review";
            referenceId: string;
            sha256: string;
          }>
        | null;
    }>
  | null
> {
  if (input.pinnedProposalId === null) {
    return { materialComparisonReviewId: null, ownerFeedbackSource: null };
  }
  const audit = await transaction.auditEvent.findFirst({
    where: {
      targetType: "document_analysis_request",
      targetId: input.requestId,
      correlationId: input.correlationId,
      eventType: {
        in: [
          "dynamic_criteria.generation_requested",
          "dynamic_criteria.revision_requested",
        ],
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { eventType: true, safeDiff: true },
  });
  if (audit === null) return null;
  if (audit.eventType === "dynamic_criteria.revision_requested") {
    const comparisonReviewId = jsonUuid(audit.safeDiff, "comparisonReviewId");
    if (comparisonReviewId === null) return null;
    const review = await transaction.documentComparisonReview.findUnique({
      where: { id: comparisonReviewId },
      select: { reason: true },
    });
    if (review === null) return null;
    return {
      materialComparisonReviewId: comparisonReviewId,
      ownerFeedbackSource: {
        kind: "comparison_review",
        referenceId: comparisonReviewId,
        sha256: sha256(review.reason),
      },
    };
  }
  const transition = await transaction.dynamicCriteriaProposalTransition.findFirst({
    where: {
      proposalId: input.pinnedProposalId,
      fromState: "owner_review",
      toState: "superseded",
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, reason: true },
  });
  if (transition === null) return null;
  return {
    materialComparisonReviewId: null,
    ownerFeedbackSource: {
      kind: "proposal_transition",
      referenceId: transition.id,
      sha256: sha256(transition.reason),
    },
  };
}

function jsonUuid(value: unknown, key: string): string | null {
  if (typeof value !== "object" || value === null || !(key in value)) return null;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      candidate,
    )
    ? candidate
    : null;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
