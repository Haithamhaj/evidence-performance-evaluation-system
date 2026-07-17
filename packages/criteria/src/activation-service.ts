import { ActivateCriteriaSchema, AppError } from "@evaluation/contracts";

import {
  assertCollectionComplete,
  assertCriterionCount,
  assertManagerResolution,
  assertProspectiveEffectiveFrom,
  assertProposalTransition,
} from "./invariants.js";

type Actor = Readonly<{ userId: string; active: boolean }>;
type CriteriaKind = import("./model.js").CriteriaKind;
type Transaction = import("./model.js").CriteriaTransaction;

type DocumentPort = Readonly<{
  lockVersionIdentityIn(
    transaction: Transaction,
    input: Readonly<{ documentVersionId: string }>,
  ): Promise<Readonly<{
    documentId: string;
    documentVersionId: string;
    isCurrent: boolean;
  }> | null>;
  getPrerequisitesIn(
    transaction: Transaction,
    input: Readonly<{ documentVersionId: string }>,
  ): Promise<Readonly<{
    documentId: string;
    documentVersionId: string;
    readinessCheckId: string;
    lifecycleState: import("@evaluation/contracts").ReadinessLifecycleState;
    projectId: string | null;
    workstreamId: string | null;
  }> | null>;
  appendLifecycleTransition(
    transaction: Transaction,
    input: Readonly<{
      readinessCheckId: string;
      documentVersionId: string;
      fromState: import("@evaluation/contracts").ReadinessLifecycleState;
      toState: "criteria_approved";
      actorId: string;
      reason: string;
      effectiveAt: Date;
      criteriaSetId: string;
    }>,
  ): Promise<void>;
}>;

type ActivationReviewReader = Readonly<{
  snapshotIn(
    transaction: Transaction,
    input: Readonly<{ kind: CriteriaKind; resourceId: string; at: Date }>,
  ): Promise<Readonly<{
    kind: CriteriaKind;
    resourceId: string;
    projectId: string;
    primaryOwnerId: string;
  }> | null>;
}>;

export type DynamicCriteriaSetDetail = Readonly<{
  id: string;
  kind: CriteriaKind;
  projectId: string | null;
  workstreamId: string | null;
  version: number;
  sourceDocumentVersionId: string;
  proposalId: string;
  priorSetId: string | null;
  approvedAt: Date;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  [key: string]: unknown;
}>;

export class ActivationService {
  private readonly database: import("./model.js").CriteriaDatabase;
  private readonly audit: import("./model.js").CriteriaAuditWriter;
  private readonly documentPort: DocumentPort;
  private readonly reviewReader: ActivationReviewReader;
  private readonly options: Readonly<{ now?: () => Date }>;

  constructor(
    database: import("./model.js").CriteriaDatabase,
    audit: import("./model.js").CriteriaAuditWriter,
    documentPort: DocumentPort,
    reviewReader: ActivationReviewReader,
    options: Readonly<{ now?: () => Date }> = {},
  ) {
    this.database = database;
    this.audit = audit;
    this.documentPort = documentPort;
    this.reviewReader = reviewReader;
    this.options = options;
  }

  async activate(
    command: Readonly<{
      actor: Actor;
      correlationId: string;
      proposalId: string;
      activation: unknown;
    }>,
  ): Promise<DynamicCriteriaSetDetail> {
    if (!command.actor.active) throw criteriaError("CRITERIA_ACTIVATION_FORBIDDEN", 403);
    const activation = ActivateCriteriaSchema.parse(command.activation);
    const now = this.options.now?.() ?? new Date();
    const effectiveFrom = new Date(activation.effectiveFrom);

    try {
      return await this.database.$transaction(
        async (transaction) => {
          await lockActivationInputs(transaction, command.proposalId);
          const proposal = await transaction.dynamicCriteriaProposal.findUnique({
            where: { id: command.proposalId },
          });
          if (proposal === null) throw criteriaError("CRITERIA_PROPOSAL_NOT_FOUND", 404);
          if (
            proposal.state !== "approved" ||
            proposal.approvedAt === null ||
            proposal.version !== activation.expectedProposalVersion
          ) {
            throw criteriaError("VERSION_CONFLICT", 409);
          }

          const items = await transaction.dynamicCriteriaProposalItem.findMany({
            where: { proposalId: proposal.id },
            orderBy: { position: "asc" },
          });
          assertCriterionCount(proposal.kind, items.length);
          assertProspectiveEffectiveFrom(effectiveFrom, proposal.approvedAt, now);

          const identity = await this.documentPort.lockVersionIdentityIn(transaction, {
            documentVersionId: proposal.sourceDocumentVersionId,
          });
          const prerequisites = await this.documentPort.getPrerequisitesIn(transaction, {
            documentVersionId: proposal.sourceDocumentVersionId,
          });
          if (
            identity === null ||
            !identity.isCurrent ||
            prerequisites === null ||
            prerequisites.readinessCheckId !== proposal.readinessCheckId ||
            !["ready_for_criteria_generation", "revision_required"].includes(
              prerequisites.lifecycleState,
            )
          ) {
            throw criteriaError("CRITERIA_SOURCE_STALE", 409);
          }

          const resourceId =
            proposal.kind === "project" ? proposal.projectId : proposal.workstreamId;
          if (resourceId === null) throw criteriaError("CRITERIA_SCOPE_INVALID");
          const currentIdentity = await this.reviewReader.snapshotIn(transaction, {
            kind: proposal.kind,
            resourceId,
            at: now,
          });
          if (
            currentIdentity === null ||
            currentIdentity.kind !== proposal.kind ||
            currentIdentity.resourceId !== resourceId ||
            currentIdentity.primaryOwnerId !== command.actor.userId
          ) {
            throw criteriaError("CRITERIA_ACTIVATION_FORBIDDEN", 403);
          }
          const scopeMatches =
            proposal.kind === "project"
              ? prerequisites.projectId === proposal.projectId &&
                prerequisites.workstreamId === null &&
                currentIdentity.projectId === proposal.projectId
              : proposal.projectId === null &&
                prerequisites.projectId === null &&
                prerequisites.workstreamId === proposal.workstreamId &&
                currentIdentity.projectId.length > 0;
          if (!scopeMatches) {
            throw criteriaError("CRITERIA_SCOPE_INVALID");
          }

          await assertOwnerApproved(transaction, proposal);
          if (proposal.kind === "workstream") {
            await assertFrozenCollection(transaction, proposal.id);
          }

          const current = await transaction.dynamicCriteriaSet.findFirst({
            where:
              proposal.kind === "project"
                ? { kind: "project", projectId: resourceId, effectiveTo: null }
                : { kind: "workstream", workstreamId: resourceId, effectiveTo: null },
            orderBy: { version: "desc" },
          });
          if ((current?.id ?? null) !== proposal.priorSetId) {
            throw criteriaError("VERSION_CONFLICT", 409);
          }

          if (current !== null) {
            if (effectiveFrom <= current.effectiveFrom) {
              throw criteriaError("CRITERIA_EFFECTIVE_FROM_INVALID");
            }
            await transaction.dynamicCriteriaSetTransition.create({
              data: {
                criteriaSetId: current.id,
                kind: "retired",
                effectiveAt: effectiveFrom,
                actorId: command.actor.userId,
                reason: activation.reason,
              },
            });
            await transaction.dynamicCriteriaSet.update({
              where: { id: current.id },
              data: { effectiveTo: effectiveFrom },
            });
          }

          const created = await transaction.dynamicCriteriaSet.create({
            data: {
              kind: proposal.kind,
              projectId: proposal.projectId,
              workstreamId: proposal.workstreamId,
              version: (current?.version ?? 0) + 1,
              sourceDocumentVersionId: proposal.sourceDocumentVersionId,
              proposalId: proposal.id,
              priorSetId: current?.id ?? null,
              approvedAt: proposal.approvedAt,
              effectiveFrom,
              effectiveTo: null,
            },
          });
          for (const item of items) {
            await transaction.dynamicCriterion.create({
              data: {
                criteriaSetId: created.id,
                position: item.position,
                name: item.name,
                selectionReason: item.selectionReason,
                successLink: item.successLink,
                expectedBehaviorOrResult: item.expectedBehaviorOrResult,
                evaluationMethod: item.evaluationMethod,
                suggestedEvidence: item.suggestedEvidence as any,
                sourceReferences: item.sourceReferences as any,
              },
            });
          }
          await transaction.dynamicCriteriaSetTransition.create({
            data: {
              criteriaSetId: created.id,
              kind: "activated",
              effectiveAt: effectiveFrom,
              actorId: command.actor.userId,
              reason: activation.reason,
            },
          });

          assertProposalTransition("approved", "activated");
          await transaction.dynamicCriteriaProposalTransition.create({
            data: {
              proposalId: proposal.id,
              fromState: "approved",
              toState: "activated",
              actorId: command.actor.userId,
              reason: activation.reason,
              resultingVersion: proposal.version + 1,
            },
          });
          await transaction.dynamicCriteriaProposal.update({
            where: { id: proposal.id },
            data: { state: "activated", version: { increment: 1 } },
          });
          await this.documentPort.appendLifecycleTransition(transaction, {
            readinessCheckId: proposal.readinessCheckId,
            documentVersionId: proposal.sourceDocumentVersionId,
            fromState: prerequisites.lifecycleState,
            toState: "criteria_approved",
            actorId: command.actor.userId,
            reason: activation.reason,
            effectiveAt: effectiveFrom,
            criteriaSetId: created.id,
          });
          await this.audit.append(transaction, {
            eventType: "dynamic_criteria.activated",
            actor: { kind: "human", id: command.actor.userId },
            effectiveSubjectId: command.actor.userId,
            scopeType: proposal.kind,
            scopeId: resourceId,
            targetType: "dynamic_criteria_set",
            targetId: created.id,
            reason: activation.reason,
            safeDiff: {
              proposalId: proposal.id,
              priorSetId: current?.id ?? null,
              version: created.version,
              effectiveFrom: effectiveFrom.toISOString(),
            },
            correlationId: command.correlationId,
            source: "api",
          });
          return created as DynamicCriteriaSetDetail;
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (isConcurrencyCollision(error)) throw criteriaError("VERSION_CONFLICT", 409);
      throw error;
    }
  }
}

export class CriteriaVersionResolver {
  private readonly database: import("./model.js").CriteriaDatabase;

  constructor(database: import("./model.js").CriteriaDatabase) {
    this.database = database;
  }

  async resolve(
    input: Readonly<{
      kind: CriteriaKind;
      resourceId: string;
      occurredAt: Date;
    }>,
  ): Promise<DynamicCriteriaSetDetail | null> {
    return (await this.database.dynamicCriteriaSet.findFirst({
      where: {
        kind: input.kind,
        ...(input.kind === "project"
          ? { projectId: input.resourceId }
          : { workstreamId: input.resourceId }),
        effectiveFrom: { lte: input.occurredAt },
        AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.occurredAt } }] }],
      },
      orderBy: { version: "desc" },
    })) as DynamicCriteriaSetDetail | null;
  }

  async assertLink(
    input: Readonly<{
      criteriaSetId: string;
      kind: CriteriaKind;
      resourceId: string;
      occurredAt: Date;
    }>,
  ): Promise<DynamicCriteriaSetDetail> {
    const resolved = await this.resolve(input);
    if (resolved === null || resolved.id !== input.criteriaSetId) {
      throw criteriaError("RETROACTIVE_CRITERIA_FORBIDDEN", 409);
    }
    return resolved;
  }
}

async function lockActivationInputs(transaction: Transaction, proposalId: string): Promise<void> {
  await transaction.$queryRaw`
    SELECT id FROM "DynamicCriteriaProposal"
    WHERE id = ${proposalId}::uuid
    FOR UPDATE
  `;
  await transaction.$queryRaw`
    SELECT id FROM "DynamicCriteriaSet"
    WHERE "proposalId" = ${proposalId}::uuid
       OR "projectId" = (SELECT "projectId" FROM "DynamicCriteriaProposal" WHERE id = ${proposalId}::uuid)
       OR "workstreamId" = (SELECT "workstreamId" FROM "DynamicCriteriaProposal" WHERE id = ${proposalId}::uuid)
    FOR UPDATE
  `;
  await transaction.$queryRaw`
    SELECT id FROM "CriteriaReviewSnapshot"
    WHERE "proposalId" = ${proposalId}::uuid
    FOR UPDATE
  `;
  await transaction.$queryRaw`
    SELECT id FROM "CriteriaReviewEligibility"
    WHERE "snapshotId" = (SELECT id FROM "CriteriaReviewSnapshot" WHERE "proposalId" = ${proposalId}::uuid)
    FOR UPDATE
  `;
  await transaction.$queryRaw`
    SELECT id FROM "CriteriaContributorResponse"
    WHERE "proposalId" = ${proposalId}::uuid
    FOR UPDATE
  `;
  await transaction.$queryRaw`
    SELECT id FROM "CriteriaManagerResolution"
    WHERE "proposalId" = ${proposalId}::uuid
    FOR UPDATE
  `;
}

async function assertOwnerApproved(transaction: Transaction, proposal: any): Promise<void> {
  if (proposal.kind === "workstream") {
    const snapshot = await transaction.criteriaReviewSnapshot.findUnique({
      where: { proposalId: proposal.id },
    });
    if (snapshot === null) throw criteriaError("CRITERIA_OWNER_APPROVAL_REQUIRED", 409);
    return;
  }
  const transitions = await transaction.dynamicCriteriaProposalTransition.findMany({
    where: { proposalId: proposal.id },
    orderBy: [{ resultingVersion: "asc" }],
  });
  const approval = transitions.find(
    (transition: any) =>
      transition.toState === "approved" && transition.resultingVersion === proposal.version,
  );
  if (approval === undefined) throw criteriaError("CRITERIA_OWNER_APPROVAL_REQUIRED", 409);
}

async function assertFrozenCollection(transaction: Transaction, proposalId: string): Promise<void> {
  const snapshot = await transaction.criteriaReviewSnapshot.findUnique({
    where: { proposalId },
  });
  if (snapshot === null) throw criteriaError("CRITERIA_COLLECTION_INCOMPLETE");
  const eligibility = await transaction.criteriaReviewEligibility.findMany({
    where: { snapshotId: snapshot.id },
    orderBy: { employeeId: "asc" },
  });
  const responses = await transaction.criteriaContributorResponse.findMany({
    where: { proposalId, snapshotId: snapshot.id },
    orderBy: { employeeId: "asc" },
  });
  const collection = assertCollectionComplete(eligibility, responses);
  if (!collection.complete) throw criteriaError("CRITERIA_COLLECTION_INCOMPLETE");
  const resolution = await transaction.criteriaManagerResolution.findUnique({
    where: { proposalId },
  });
  if (collection.objectionCount === 0) {
    if (resolution !== null) throw criteriaError("CRITERIA_RESOLUTION_INVALID");
    return;
  }
  if (resolution === null) throw criteriaError("CRITERIA_RESOLUTION_REQUIRED");
  assertManagerResolution(collection.objectionCount, resolution);
  if (resolution.decision !== "accept_with_objections") {
    throw criteriaError("CRITERIA_RESOLUTION_REQUIRED");
  }
}

function criteriaError(code: string, status = 422): AppError {
  return new AppError(code, `errors.criteria.${code.toLowerCase()}`, status);
}

function isConcurrencyCollision(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const candidate = error as Error & { code?: string; meta?: unknown };
  return (
    candidate.code === "P2034" ||
    candidate.code === "P2002" ||
    /serialize|exclusion|overlap|concurrent|unique constraint/i.test(candidate.message)
  );
}
