import { AppError } from "@evaluation/contracts";

export type CriteriaDocumentPrerequisites = Readonly<{
  documentId: string;
  documentVersionId: string;
  documentVersion: number;
  readinessCheckId: string;
  lifecycleState: import("@evaluation/contracts").ReadinessLifecycleState;
  projectId: string;
  workstreamId: string | null;
  sourceReferences: readonly string[];
}>;

export class CriteriaDocumentReader {
  private readonly database: import("./model.js").DocumentDatabase;

  constructor(database: import("./model.js").DocumentDatabase) {
    this.database = database;
  }

  async getPrerequisites(
    input: Readonly<{
      documentVersionId: string;
    }>,
  ): Promise<CriteriaDocumentPrerequisites | null> {
    const readiness = await this.database.documentReadinessCheck.findFirst({
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
    transaction: import("./model.js").DocumentTransaction,
    input: Readonly<{
      readinessCheckId: string;
      documentVersionId: string;
      fromState: import("@evaluation/contracts").ReadinessLifecycleState;
      toState: import("@evaluation/contracts").ReadinessLifecycleState;
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
  from: import("@evaluation/contracts").ReadinessLifecycleState,
  to: import("@evaluation/contracts").ReadinessLifecycleState,
) {
  const allowed: Readonly<Record<string, readonly string[]>> = {
    draft: ["incomplete", "ready_for_criteria_generation"],
    incomplete: ["superseded"],
    ready_for_criteria_generation: ["revision_required", "criteria_approved", "superseded"],
    revision_required: ["criteria_approved", "superseded"],
    criteria_approved: ["revision_required", "superseded"],
    superseded: [],
  };
  if (!allowed[from]?.includes(to)) {
    throw new AppError(
      "READINESS_LIFECYCLE_INVALID",
      "errors.documents.readinessLifecycleInvalid",
      409,
    );
  }
}
