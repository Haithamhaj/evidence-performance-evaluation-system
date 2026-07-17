import { AppError } from "@evaluation/contracts";
import type { ReadinessLifecycleState } from "@evaluation/contracts";

import type * as DocumentModel from "./model.js";

export type CriteriaDocumentPrerequisites = Readonly<{
  documentId: string;
  documentVersionId: string;
  documentVersion: number;
  readinessCheckId: string;
  lifecycleState: ReadinessLifecycleState;
  projectId: string;
  workstreamId: string | null;
  sourceReferences: readonly string[];
}>;

export type CriteriaDocumentVersionIdentity = Readonly<{
  documentId: string;
  documentVersionId: string;
  isCurrent: boolean;
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
        document: { select: { currentVersion: true } },
      },
    });
    if (version === null) return null;
    return {
      documentId: version.documentId,
      documentVersionId: version.id,
      isCurrent: version.version === version.document.currentVersion,
    };
  }

  private async getPrerequisitesUsing(
    database: Pick<DocumentModel.DocumentDatabase, "documentReadinessCheck">,
    input: Readonly<{ documentVersionId: string }>,
  ): Promise<CriteriaDocumentPrerequisites | null> {
    const readiness = await database.documentReadinessCheck.findFirst({
      where: {
        documentVersionId: input.documentVersionId,
        analyzedState: "ready_for_criteria_generation",
        stale: false,
      },
      orderBy: { createdAt: "desc" },
      include: {
        document: { select: { projectId: true, workstreamId: true } },
        documentVersion: { select: { version: true } },
        lifecycleTransitions: {
          orderBy: [{ effectiveAt: "desc" }, { id: "desc" }],
          take: 1,
        },
      },
    });
    const latest = readiness?.lifecycleTransitions[0];
    if (
      readiness === null ||
      latest === undefined ||
      !["ready_for_criteria_generation", "revision_required"].includes(latest.toState) ||
      readiness.document.projectId === null
    )
      return null;
    return {
      documentId: readiness.documentId,
      documentVersionId: readiness.documentVersionId,
      documentVersion: readiness.documentVersion.version,
      readinessCheckId: readiness.id,
      lifecycleState: latest.toState,
      projectId: readiness.document.projectId,
      workstreamId: readiness.document.workstreamId,
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
