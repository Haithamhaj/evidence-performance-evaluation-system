import { AppError, ProgressContractSchema } from "@evaluation/contracts";

type Transaction = import("@evaluation/database").DatabaseTransaction;

export type ApprovedProgressSource = Readonly<{
  documentId: string;
  documentVersionId: string;
  documentVersion: number;
  projectId: string | null;
  workstreamId: string | null;
}>;

export function assertProposalAuthority(
  actorId: string,
  draft: import("@evaluation/contracts").ProgressContractDraft,
  source: ApprovedProgressSource | null,
  identity: import("./criteria-review-reader.js").CriteriaReviewIdentity | null,
): asserts identity is import("./criteria-review-reader.js").CriteriaReviewIdentity {
  if (
    source === null ||
    source.documentId !== draft.sourceDocumentId ||
    source.documentVersionId !== draft.sourceDocumentVersionId ||
    source.documentVersion !== draft.sourceDocumentVersion ||
    source.projectId !== (draft.scopeKind === "project" ? draft.projectId : null) ||
    source.workstreamId !== draft.workstreamId
  )
    throw new AppError(
      "PROGRESS_CONTRACT_SOURCE_INVALID",
      "errors.progressContract.sourceInvalid",
      409,
    );
  if (
    identity === null ||
    identity.projectId !== draft.projectId ||
    identity.primaryOwnerId !== actorId
  )
    throw new AppError("PROGRESS_CONTRACT_FORBIDDEN", "errors.common.forbidden", 403);
}

export async function supersedePrevious(
  transaction: Transaction,
  previousContractId: string,
  actorId: string,
  reason: string,
  now: Date,
): Promise<void> {
  const previous = await transaction.progressContract.findUnique({
    where: { id: previousContractId },
    select: { id: true, state: true, version: true },
  });
  if (previous?.state !== "active") return;
  await transaction.progressContract.update({
    where: { id: previous.id },
    data: { state: "superseded", version: { increment: 1 } },
  });
  await transaction.progressContractTransition.create({
    data: {
      contractId: previous.id,
      fromState: "active",
      toState: "superseded",
      actorId,
      reason,
      resultingVersion: previous.version + 1,
      createdAt: now,
    },
  });
}

export function validProgressClock(clock: () => Date): Date {
  const now = clock();
  if (!Number.isFinite(now.getTime()))
    throw new AppError("PROGRESS_CONTRACT_CLOCK_INVALID", "errors.common.clockInvalid", 500);
  return now;
}

export function serializeProgressContract(
  row: any,
): import("@evaluation/contracts").ProgressContract {
  return ProgressContractSchema.parse({
    id: row.id,
    scopeKind: row.scopeKind,
    projectId: row.projectId,
    workstreamId: row.workstreamId,
    sourceDocumentId: row.sourceDocumentId,
    sourceDocumentVersionId: row.sourceDocumentVersionId,
    sourceDocumentVersion: row.sourceDocumentVersionNo,
    calculationKind: row.calculationKind,
    calculationSchemaVersion: row.calculationSchemaVersion,
    contractVersion: row.contractVersion,
    version: row.version,
    state: row.state,
    ownerId: row.ownerId,
    approverId: row.approverId,
    approvedAt: row.approvedAt?.toISOString?.() ?? row.approvedAt,
    previousContractId: row.previousContractId,
    effectiveAt: row.effectiveAt.toISOString?.() ?? row.effectiveAt,
    components: row.components.map((component: any) => ({
      id: component.id,
      kind: component.kind,
      name: component.name,
      description: component.description,
      weight: component.weight === null ? null : Number(component.weight),
      baseline: component.baseline === null ? null : Number(component.baseline),
      target: component.target === null ? null : Number(component.target),
      unit: component.unit,
      direction: component.direction,
      acceptanceConditions: component.acceptanceConditions,
      requiredEvidence: component.requiredEvidence,
      confirmationMode: component.confirmationMode,
    })),
  });
}
