import { AppError } from "@evaluation/contracts";
import type { ReadinessLifecycleState } from "@evaluation/contracts";

import type * as DocumentModel from "./model.js";

export type CriteriaDocumentPrerequisites = Readonly<{
  documentId: string;
  documentVersionId: string;
  documentVersion: number;
  readinessCheckId: string;
  lifecycleState: ReadinessLifecycleState;
  projectId: string | null;
  workstreamId: string | null;
  sourceReferences: readonly string[];
}>;

export type CriteriaDocumentVersionIdentity = Readonly<{
  documentId: string;
  documentVersionId: string;
  isCurrent: boolean;
}>;

export type ReviewedMaterialCriteriaRevision = Readonly<{
  comparisonReviewId: string;
  documentId: string;
  beforeDocumentVersionId: string;
  afterDocumentVersionId: string;
  effectiveClassification:
    "editorial" | "routine_execution_update" | "material_scope_or_goal_change";
  reviewReason: string;
  isLatestReview: boolean;
  isCurrentAfterVersion: boolean;
}>;

export class CriteriaDocumentReader {
  private readonly database: DocumentModel.DocumentDatabase;

  constructor(database: DocumentModel.DocumentDatabase) {
    this.database = database;
  }

  async getPrerequisites(
    input: Readonly<{
      documentVersionId: string;
    }>,
  ): Promise<CriteriaDocumentPrerequisites | null> {
    return this.getPrerequisitesUsing(this.database as DocumentModel.DocumentDatabase, input);
  }

  async getPrerequisitesIn(
    transaction: DocumentModel.DocumentTransaction,
    input: Readonly<{ documentVersionId: string }>,
  ): Promise<CriteriaDocumentPrerequisites | null> {
    await transaction.$queryRaw`
      SELECT id FROM "DocumentReadinessCheck"
      WHERE "documentVersionId" = ${input.documentVersionId}::uuid
        AND "analyzedState" = 'ready_for_criteria_generation'
        AND "stale" = false
      ORDER BY "createdAt" DESC
      LIMIT 1
      FOR UPDATE
    `;
    return this.getPrerequisitesUsing(transaction, input);
  }

  async lockVersionIdentityIn(
    transaction: DocumentModel.DocumentTransaction,
    input: Readonly<{ documentVersionId: string }>,
  ): Promise<CriteriaDocumentVersionIdentity | null> {
    await transaction.$queryRaw`
      SELECT document.id
      FROM "DocumentRecord" document
      INNER JOIN "DocumentVersion" version
        ON version."documentId" = document.id
      WHERE version.id = ${input.documentVersionId}::uuid
      FOR UPDATE OF document
    `;
    const version = await transaction.documentVersion.findUnique({
      where: { id: input.documentVersionId },
      select: {
        id: true,
        documentId: true,
        version: true,
      },
    });
    if (version === null) return null;
    const document = await transaction.documentRecord.findUnique({
      where: { id: version.documentId },
      select: { currentVersion: true },
    });
    if (document === null) return null;
    return {
      documentId: version.documentId,
      documentVersionId: version.id,
      isCurrent: version.version === document.currentVersion,
    };
  }

  async lockReviewedMaterialRevisionIn(
    transaction: DocumentModel.DocumentTransaction,
    input: Readonly<{ comparisonReviewId: string }>,
  ): Promise<ReviewedMaterialCriteriaRevision | null> {
    await transaction.$queryRaw`
      SELECT review.id
      FROM "DocumentComparisonReview" review
      INNER JOIN "DocumentComparison" comparison
        ON comparison.id = review."comparisonId"
      INNER JOIN "DocumentRecord" document
        ON document.id = comparison."documentId"
      WHERE review.id = ${input.comparisonReviewId}::uuid
      FOR UPDATE OF review, comparison, document
    `;
    const review = await transaction.documentComparisonReview.findUnique({
      where: { id: input.comparisonReviewId },
      select: {
        id: true,
        comparisonId: true,
        effectiveClassification: true,
        reason: true,
      },
    });
    if (review === null) return null;
    const comparison = await transaction.documentComparison.findUnique({
      where: { id: review.comparisonId },
      select: {
        documentId: true,
        beforeVersionId: true,
        afterVersionId: true,
      },
    });
    if (comparison === null) return null;
    const afterVersion = await transaction.documentVersion.findUnique({
      where: { id: comparison.afterVersionId },
      select: { version: true },
    });
    const document = await transaction.documentRecord.findUnique({
      where: { id: comparison.documentId },
      select: { currentVersion: true },
    });
    if (afterVersion === null || document === null) return null;
    const latest = await transaction.documentComparisonReview.findFirst({
      where: { comparison: { documentId: comparison.documentId } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
    });
    return {
      comparisonReviewId: review.id,
      documentId: comparison.documentId,
      beforeDocumentVersionId: comparison.beforeVersionId,
      afterDocumentVersionId: comparison.afterVersionId,
      effectiveClassification: review.effectiveClassification,
      reviewReason: review.reason,
      isLatestReview: latest?.id === review.id,
      isCurrentAfterVersion: afterVersion.version === document.currentVersion,
    };
  }

  private async getPrerequisitesUsing(
    database: Pick<
      DocumentModel.DocumentDatabase,
      | "documentReadinessCheck"
      | "documentReadinessLifecycleTransition"
      | "documentRecord"
      | "documentVersion"
    >,
    input: Readonly<{ documentVersionId: string }>,
  ): Promise<CriteriaDocumentPrerequisites | null> {
    const readiness = await database.documentReadinessCheck.findFirst({
      where: {
        documentVersionId: input.documentVersionId,
        analyzedState: "ready_for_criteria_generation",
        stale: false,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        documentId: true,
        documentVersionId: true,
        sourceReferences: true,
      },
    });
    if (readiness === null) return null;
    const document = await database.documentRecord.findUnique({
      where: { id: readiness.documentId },
      select: { projectId: true, workstreamId: true },
    });
    const version = await database.documentVersion.findUnique({
      where: { id: readiness.documentVersionId },
      select: { version: true },
    });
    const latest = await database.documentReadinessLifecycleTransition.findFirst({
      where: { readinessCheckId: readiness.id },
      orderBy: [{ effectiveAt: "desc" }, { id: "desc" }],
      select: { toState: true },
    });
    if (
      document === null ||
      version === null ||
      latest === null ||
      !["ready_for_criteria_generation", "revision_required"].includes(latest.toState) ||
      (document.projectId === null && document.workstreamId === null)
    )
      return null;
    return {
      documentId: readiness.documentId,
      documentVersionId: readiness.documentVersionId,
      documentVersion: version.version,
      readinessCheckId: readiness.id,
      lifecycleState: latest.toState,
      projectId: document.projectId,
      workstreamId: document.workstreamId,
      sourceReferences: Array.isArray(readiness.sourceReferences)
        ? (readiness.sourceReferences as string[])
        : [],
    };
  }

  async appendLifecycleTransition(
    transaction: DocumentModel.DocumentTransaction,
    input: Readonly<{
      readinessCheckId: string;
      documentVersionId: string;
      fromState: ReadinessLifecycleState;
      toState: ReadinessLifecycleState;
      actorId: string;
      reason: string;
      effectiveAt: Date;
      criteriaSetId?: string;
      comparisonReviewId?: string;
    }>,
  ): Promise<void> {
    assertReadinessLifecycleTransition(input.fromState, input.toState);
    await transaction.documentReadinessLifecycleTransition.create({
      data: { ...input },
    });
  }
}

export function assertReadinessLifecycleTransition(
  from: ReadinessLifecycleState,
  to: ReadinessLifecycleState,
) {
  const allowed =
    from === "draft"
      ? ["incomplete", "ready_for_criteria_generation"]
      : from === "incomplete"
        ? ["superseded"]
        : from === "ready_for_criteria_generation"
          ? ["revision_required", "criteria_approved", "superseded"]
          : from === "revision_required"
            ? ["criteria_approved", "superseded"]
            : from === "criteria_approved"
              ? ["revision_required", "superseded"]
              : [];
  if (!(allowed as readonly ReadinessLifecycleState[]).includes(to)) {
    throw new AppError(
      "READINESS_LIFECYCLE_INVALID",
      "errors.documents.readinessLifecycleInvalid",
      409,
    );
  }
}
