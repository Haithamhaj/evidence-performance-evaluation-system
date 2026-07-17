import { randomUUID } from "node:crypto";

import {
  AppError,
  ResolveCriteriaObjectionsSchema,
  RespondToCriteriaSchema,
} from "@evaluation/contracts";

import { assertProposalTransition } from "./invariants.js";

type Actor = Readonly<{ userId: string; active: boolean }>;
type CriteriaReviewIdentity = Readonly<{
  kind: "project" | "workstream";
  resourceId: string;
  projectId: string;
  organizationId: string;
  departmentId: string;
  primaryOwnerId: string;
  contributorIds: readonly string[];
}>;

type PolicyAuthorizer = Readonly<{
  authorize(
    input: Readonly<{
      actor: Actor;
      action: "criteria.contributor.respond" | "criteria.manager.resolve";
      resource: Readonly<Record<string, unknown>>;
    }>,
  ): boolean | Promise<boolean>;
}>;

type PublishInput = Readonly<{
  proposal: Readonly<Record<string, unknown>>;
  identity: CriteriaReviewIdentity;
  actorId: string;
  reason: string;
  correlationId: string;
  publishedAt: Date;
}>;

export type CriteriaCollectionStatus = Readonly<{
  proposalId: string;
  snapshotId: string;
  requiredResponses: number;
  completedResponses: number;
  objectionCount: number;
  state: import("./model.js").CriteriaProposalState;
}>;

export type CriteriaReviewSnapshotDetail = Readonly<{
  id: string;
  proposalId: string;
  primaryOwnerId: string;
  responsibilityAt: Date;
  publishedAt: Date;
  eligibility: readonly Readonly<Record<string, unknown>>[];
}>;

export class WorkstreamReviewService {
  private readonly database: import("./model.js").CriteriaDatabase;
  private readonly audit: import("./model.js").CriteriaAuditWriter;
  private readonly policy: PolicyAuthorizer;
  private readonly options: Readonly<{ now?: () => Date }>;

  constructor(
    database: import("./model.js").CriteriaDatabase,
    audit: import("./model.js").CriteriaAuditWriter,
    policy: PolicyAuthorizer,
    options: Readonly<{ now?: () => Date }> = {},
  ) {
    this.database = database;
    this.audit = audit;
    this.policy = policy;
    this.options = options;
  }

  async publish(
    transaction: import("./model.js").CriteriaTransaction,
    input: PublishInput,
  ): Promise<import("./proposal-service.js").DynamicCriteriaProposalDetail> {
    const proposalId = field(input.proposal, "id");
    const workstreamId = nullableField(input.proposal, "workstreamId");
    const state = field(input.proposal, "state");
    const version = numberField(input.proposal, "version");
    if (
      input.identity.kind !== "workstream" ||
      workstreamId === null ||
      input.identity.resourceId !== workstreamId ||
      input.identity.primaryOwnerId !== input.actorId ||
      state !== "owner_review"
    ) {
      throw invalidState();
    }
    const contributorIds = sortedDistinct(input.identity.contributorIds);
    if (contributorIds.includes(input.actorId)) throw invalidState();
    const snapshotId = randomUUID();
    await transaction.criteriaReviewSnapshot.create({
      data: {
        id: snapshotId,
        proposalId,
        primaryOwnerId: input.actorId,
        responsibilityAt: input.publishedAt,
        publishedAt: input.publishedAt,
      },
    });
    await transaction.criteriaReviewEligibility.create({
      data: {
        snapshotId,
        employeeId: input.actorId,
        role: "owner",
        responseRequired: false,
      },
    });
    for (const employeeId of contributorIds) {
      await transaction.criteriaReviewEligibility.create({
        data: {
          snapshotId,
          employeeId,
          role: "contributor",
          responseRequired: true,
        },
      });
    }
    const toState = contributorIds.length === 0 ? "approved" : "contributor_review";
    assertProposalTransition("owner_review", toState);
    await transitionProposal(transaction, {
      proposalId,
      fromState: "owner_review",
      toState,
      actorId: input.actorId,
      reason: input.reason,
      version,
      at: input.publishedAt,
    });
    await transaction.dynamicCriteriaProposal.update({
      where: { id: proposalId },
      data: {
        state: toState,
        version: { increment: 1 },
        ...(toState === "approved" ? { approvedAt: input.publishedAt } : {}),
      },
    });
    const updated = await loadProposalDetail(transaction, proposalId);
    await this.audit.append(transaction, {
      eventType: "dynamic_criteria.review_published",
      actor: { kind: "human", id: input.actorId },
      effectiveSubjectId: input.actorId,
      scopeType: "workstream",
      scopeId: workstreamId,
      targetType: "criteria_review_snapshot",
      targetId: snapshotId,
      reason: input.reason,
      safeDiff: {
        contributorCount: contributorIds.length,
        fromState: "owner_review",
        toState,
      },
      correlationId: input.correlationId,
      source: "api",
    });
    return updated as unknown as import("./proposal-service.js").DynamicCriteriaProposalDetail;
  }

  async respond(
    command: Readonly<{
      actor: Actor;
      correlationId: string;
      proposalId: string;
      response: unknown;
    }>,
  ): Promise<CriteriaCollectionStatus> {
    if (!command.actor.active) throw forbidden();
    const response = RespondToCriteriaSchema.parse(command.response);
    return this.database.$transaction(
      async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM "DynamicCriteriaProposal" WHERE id = ${command.proposalId}::uuid FOR UPDATE`;
        const proposal = await loadProposal(transaction, command.proposalId);
        if (
          proposal === null ||
          proposal.kind !== "workstream" ||
          proposal.workstreamId === null ||
          proposal.workstream === null ||
          proposal.reviewSnapshot === null
        ) {
          throw invalidState();
        }
        const snapshot = proposal.reviewSnapshot;
        const allowed = await this.policy.authorize({
          actor: command.actor,
          action: "criteria.contributor.respond",
          resource: {
            kind: "criteriaReviewSnapshot",
            reviewSnapshotId: snapshot.id,
            workstreamId: proposal.workstreamId,
            projectId: proposal.workstream.projectId,
            departmentId: proposal.workstream.project.departmentId,
          },
        });
        if (!allowed) throw forbidden();
        const eligibility = await transaction.criteriaReviewEligibility.findUnique({
          where: {
            snapshotId_employeeId: {
              snapshotId: snapshot.id,
              employeeId: command.actor.userId,
            },
          },
        });
        if (
          eligibility === null ||
          eligibility.role !== "contributor" ||
          !eligibility.responseRequired
        ) {
          throw notEligible();
        }
        const existing = await transaction.criteriaContributorResponse.findUnique({
          where: {
            snapshotId_employeeId: {
              snapshotId: snapshot.id,
              employeeId: command.actor.userId,
            },
          },
        });
        if (existing !== null) throw alreadyRecorded();
        if (proposal.state !== "contributor_review") throw invalidState();
        const created = await transaction.criteriaContributorResponse.create({
          data: {
            proposalId: proposal.id,
            snapshotId: snapshot.id,
            employeeId: command.actor.userId,
            responseRequired: true,
            response: response.action,
            ...(response.action === "object" ? { reason: response.reason } : {}),
          },
        });
        const requiredResponses = await transaction.criteriaReviewEligibility.count({
          where: { snapshotId: snapshot.id, responseRequired: true },
        });
        const completedResponses = await transaction.criteriaContributorResponse.count({
          where: { snapshotId: snapshot.id },
        });
        const objectionCount = await transaction.criteriaContributorResponse.count({
          where: { snapshotId: snapshot.id, response: "object" },
        });
        let nextState: import("./model.js").CriteriaProposalState = proposal.state;
        if (completedResponses === requiredResponses) {
          nextState = objectionCount === 0 ? "approved" : "manager_resolution";
          assertProposalTransition(proposal.state, nextState);
          const at = this.options.now?.() ?? new Date();
          await transitionProposal(transaction, {
            proposalId: proposal.id,
            fromState: proposal.state,
            toState: nextState,
            actorId: command.actor.userId,
            reason:
              objectionCount === 0
                ? "All frozen contributors acknowledged the criteria"
                : "All frozen contributors responded and objections require manager resolution",
            version: proposal.version,
            at,
          });
          await transaction.dynamicCriteriaProposal.update({
            where: { id: proposal.id },
            data: {
              state: nextState,
              version: { increment: 1 },
              ...(nextState === "approved" ? { approvedAt: at } : {}),
            },
          });
        }
        await this.audit.append(transaction, {
          eventType: "dynamic_criteria.contributor_responded",
          actor: { kind: "human", id: command.actor.userId },
          effectiveSubjectId: command.actor.userId,
          scopeType: "workstream",
          scopeId: proposal.workstreamId,
          targetType: "criteria_contributor_response",
          targetId: created.id,
          reason:
            response.action === "object" ? response.reason : "Contributor acknowledged criteria",
          safeDiff: {
            response: response.action,
            completedResponses,
            requiredResponses,
            objectionCount,
            state: nextState,
          },
          correlationId: command.correlationId,
          source: "api",
        });
        return {
          proposalId: proposal.id,
          snapshotId: snapshot.id,
          requiredResponses,
          completedResponses,
          objectionCount,
          state: nextState,
        };
      },
      { isolationLevel: "ReadCommitted" },
    );
  }

  async resolve(
    command: Readonly<{
      actor: Actor;
      correlationId: string;
      proposalId: string;
      resolution: unknown;
    }>,
  ): Promise<import("./proposal-service.js").DynamicCriteriaProposalDetail> {
    if (!command.actor.active) throw forbidden();
    const resolution = ResolveCriteriaObjectionsSchema.parse(command.resolution);
    return this.database.$transaction(
      async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM "DynamicCriteriaProposal" WHERE id = ${command.proposalId}::uuid FOR UPDATE`;
        const proposal = await loadProposal(transaction, command.proposalId);
        if (
          proposal === null ||
          proposal.kind !== "workstream" ||
          proposal.workstreamId === null ||
          proposal.workstream === null ||
          proposal.state !== "manager_resolution" ||
          proposal.reviewSnapshot === null
        ) {
          throw invalidState();
        }
        const allowed = await this.policy.authorize({
          actor: command.actor,
          action: "criteria.manager.resolve",
          resource: {
            kind: "workstream",
            workstreamId: proposal.workstreamId,
            projectId: proposal.workstream.projectId,
            departmentId: proposal.workstream.project.departmentId,
          },
        });
        if (!allowed) throw forbidden();
        const objectionCount = await transaction.criteriaContributorResponse.count({
          where: {
            snapshotId: proposal.reviewSnapshot.id,
            response: "object",
          },
        });
        if (objectionCount < 1 || proposal.managerResolution !== null) {
          throw invalidState();
        }
        const createdResolution = await transaction.criteriaManagerResolution.create({
          data: {
            proposalId: proposal.id,
            decision: resolution.decision,
            reason: resolution.reason,
            actorId: command.actor.userId,
          },
        });
        const toState =
          resolution.decision === "accept_with_objections" ? "approved" : "superseded";
        assertProposalTransition(proposal.state, toState);
        const at = this.options.now?.() ?? new Date();
        await transitionProposal(transaction, {
          proposalId: proposal.id,
          fromState: proposal.state,
          toState,
          actorId: command.actor.userId,
          reason: resolution.reason,
          version: proposal.version,
          at,
        });
        await transaction.dynamicCriteriaProposal.update({
          where: { id: proposal.id },
          data: {
            state: toState,
            version: { increment: 1 },
            ...(toState === "approved" ? { approvedAt: at } : {}),
          },
        });
        const updated = await loadProposalDetail(transaction, proposal.id);
        await this.audit.append(transaction, {
          eventType: "dynamic_criteria.objections_resolved",
          actor: { kind: "human", id: command.actor.userId },
          effectiveSubjectId: command.actor.userId,
          scopeType: "workstream",
          scopeId: proposal.workstreamId,
          targetType: "criteria_manager_resolution",
          targetId: createdResolution.id,
          reason: resolution.reason,
          safeDiff: {
            decision: resolution.decision,
            objectionCount,
            fromState: proposal.state,
            toState,
          },
          correlationId: command.correlationId,
          source: "api",
        });
        return updated as unknown as import("./proposal-service.js").DynamicCriteriaProposalDetail;
      },
      { isolationLevel: "Serializable" },
    );
  }
}

async function loadProposalDetail(
  transaction: import("./model.js").CriteriaTransaction,
  proposalId: string,
): Promise<import("./proposal-service.js").DynamicCriteriaProposalDetail> {
  const proposal = await transaction.dynamicCriteriaProposal.findUniqueOrThrow({
    where: { id: proposalId },
  });
  const items = await transaction.dynamicCriteriaProposalItem.findMany({
    where: { proposalId },
    orderBy: { position: "asc" },
  });
  const transitions = await transaction.dynamicCriteriaProposalTransition.findMany({
    where: { proposalId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const snapshot = await transaction.criteriaReviewSnapshot.findUnique({
    where: { proposalId },
  });
  const eligibility =
    snapshot === null
      ? []
      : await transaction.criteriaReviewEligibility.findMany({
          where: { snapshotId: snapshot.id },
          orderBy: { employeeId: "asc" },
        });
  const responses =
    snapshot === null
      ? []
      : await transaction.criteriaContributorResponse.findMany({
          where: { snapshotId: snapshot.id },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });
  const managerResolution = await transaction.criteriaManagerResolution.findUnique({
    where: { proposalId },
  });
  return {
    ...proposal,
    items,
    transitions,
    reviewSnapshot: snapshot === null ? null : { ...snapshot, eligibility, responses },
    managerResolution,
  } as unknown as import("./proposal-service.js").DynamicCriteriaProposalDetail;
}

async function loadProposal(
  transaction: import("./model.js").CriteriaTransaction,
  proposalId: string,
) {
  const proposal = await transaction.dynamicCriteriaProposal.findUnique({
    where: { id: proposalId },
  });
  if (proposal === null) return null;
  const snapshot = await transaction.criteriaReviewSnapshot.findUnique({
    where: { proposalId },
  });
  const managerResolution = await transaction.criteriaManagerResolution.findUnique({
    where: { proposalId },
  });
  const workstream =
    proposal.workstreamId === null
      ? null
      : await transaction.workstream.findUnique({
          where: { id: proposal.workstreamId },
        });
  const project =
    workstream === null
      ? null
      : await transaction.project.findUnique({
          where: { id: workstream.projectId },
          select: { departmentId: true },
        });
  return {
    ...proposal,
    reviewSnapshot: snapshot,
    managerResolution,
    workstream: workstream === null || project === null ? null : { ...workstream, project },
  };
}

async function transitionProposal(
  transaction: import("./model.js").CriteriaTransaction,
  input: Readonly<{
    proposalId: string;
    fromState: import("./model.js").CriteriaProposalState;
    toState: import("./model.js").CriteriaProposalState;
    actorId: string;
    reason: string;
    version: number;
    at: Date;
  }>,
): Promise<void> {
  await transaction.dynamicCriteriaProposalTransition.create({
    data: {
      proposalId: input.proposalId,
      fromState: input.fromState,
      toState: input.toState,
      actorId: input.actorId,
      reason: input.reason,
      resultingVersion: input.version + 1,
      createdAt: input.at,
    },
  });
}

function sortedDistinct(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function field(input: Readonly<Record<string, unknown>>, name: string): string {
  const value = input[name];
  if (typeof value !== "string") throw invalidState();
  return value;
}

function nullableField(input: Readonly<Record<string, unknown>>, name: string): string | null {
  const value = input[name];
  if (value !== null && typeof value !== "string") throw invalidState();
  return value;
}

function numberField(input: Readonly<Record<string, unknown>>, name: string): number {
  const value = input[name];
  if (!Number.isInteger(value) || typeof value !== "number") throw invalidState();
  return value;
}

function forbidden(): AppError {
  return new AppError("FORBIDDEN", "errors.authorization.forbidden", 403);
}

function invalidState(): AppError {
  return new AppError("CRITERIA_TRANSITION_INVALID", "errors.criteria.transitionInvalid", 409);
}

function notEligible(): AppError {
  return new AppError("CRITERIA_RESPONSE_NOT_ELIGIBLE", "errors.criteria.responseNotEligible", 403);
}

function alreadyRecorded(): AppError {
  return new AppError(
    "CRITERIA_RESPONSE_ALREADY_RECORDED",
    "errors.criteria.responseAlreadyRecorded",
    409,
  );
}
