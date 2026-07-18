import { AppError, CriteriaWorkspaceSchema } from "@evaluation/contracts";
import { z } from "zod";

type Actor = Readonly<{ userId: string; active: boolean }>;
type Identity = import("@evaluation/projects").DocumentResourceIdentity;
type Action =
  | "criteria.read"
  | "criteria.generate"
  | "criteria.owner.review"
  | "criteria.contributor.respond"
  | "criteria.manager.resolve"
  | "criteria.activate";

export interface CriteriaWorkspacePolicy {
  allows(
    input: Readonly<{
      actor: Actor;
      action: Action;
      identity: Identity;
      reviewSnapshotId: string | null;
    }>,
  ): boolean | Promise<boolean>;
}

type CriteriaDocumentWorkspaceReader = Readonly<{
  getCurrentPrerequisites(
    input: Readonly<{
      kind: "project" | "workstream";
      resourceId: string;
    }>,
  ): Promise<import("@evaluation/documents").CriteriaDocumentPrerequisites | null>;
  getPrerequisites(
    input: Readonly<{
      documentVersionId: string;
    }>,
  ): Promise<import("@evaluation/documents").CriteriaDocumentPrerequisites | null>;
  getVersionIdentity(
    input: Readonly<{
      documentVersionId: string;
    }>,
  ): Promise<import("@evaluation/documents").CriteriaDocumentVersionIdentity | null>;
}>;

const CommandSchema = z
  .object({
    actor: z.object({ userId: z.string().uuid(), active: z.boolean() }).strict(),
    kind: z.enum(["project", "workstream"]),
    resourceId: z.string().uuid(),
  })
  .strict();

export class CriteriaWorkspaceQueryService {
  private readonly database: import("@evaluation/database").DatabaseClient;
  private readonly reader: import("@evaluation/projects").DocumentResourceIdentityReader;
  private readonly documentReader: CriteriaDocumentWorkspaceReader;
  private readonly policy: CriteriaWorkspacePolicy;
  private readonly clock: () => Date;

  constructor(
    database: import("@evaluation/database").DatabaseClient,
    reader: import("@evaluation/projects").DocumentResourceIdentityReader,
    documentReader: CriteriaDocumentWorkspaceReader,
    policy: CriteriaWorkspacePolicy,
    clock: () => Date = () => new Date(),
  ) {
    this.database = database;
    this.reader = reader;
    this.documentReader = documentReader;
    this.policy = policy;
    this.clock = clock;
  }

  async get(command: unknown): Promise<import("@evaluation/contracts").CriteriaWorkspace> {
    const parsed = CommandSchema.parse(command);
    const at = this.clock();
    if (!Number.isFinite(at.getTime())) {
      throw new AppError("CRITERIA_CLOCK_INVALID", "errors.criteria.clockInvalid", 500);
    }
    const resourceWhere =
      parsed.kind === "project"
        ? { kind: "project" as const, projectId: parsed.resourceId }
        : { kind: "workstream" as const, workstreamId: parsed.resourceId };
    const [identity, proposal, activeSet, currentPrerequisites] = await Promise.all([
      this.reader.read({ kind: parsed.kind, resourceId: parsed.resourceId }),
      this.database.dynamicCriteriaProposal.findFirst({
        where: resourceWhere,
        orderBy: [{ proposalNumber: "desc" }, { id: "desc" }],
        include: {
          items: { orderBy: [{ position: "asc" }, { id: "asc" }] },
          reviewSnapshot: {
            include: {
              eligibility: {
                where: { responseRequired: true },
                select: { employeeId: true, responseRequired: true },
              },
            },
          },
          responses: {
            where: { responseRequired: true },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { employeeId: true, response: true, reason: true },
          },
          managerResolution: { select: { decision: true, reason: true } },
          transitions: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: { id: true, fromState: true, toState: true, reason: true },
          },
        },
      }),
      this.database.dynamicCriteriaSet.findFirst({
        where: {
          ...resourceWhere,
          effectiveFrom: { lte: at },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
        },
        orderBy: [{ version: "desc" }, { id: "desc" }],
        include: {
          proposal: {
            include: { items: { orderBy: [{ position: "asc" }, { id: "asc" }] } },
          },
        },
      }),
      this.documentReader.getCurrentPrerequisites({
        kind: parsed.kind,
        resourceId: parsed.resourceId,
      }),
    ]);
    if (identity === null) throw forbidden();

    const requiredResponses = proposal?.reviewSnapshot?.eligibility.length ?? 0;
    const completedResponses = proposal?.responses.length ?? 0;
    const objectionCount =
      proposal?.responses.filter(({ response }) => response === "object").length ?? 0;
    const viewerResponse =
      proposal?.responses.find(({ employeeId }) => employeeId === parsed.actor.userId) ?? null;
    const eligible =
      proposal?.reviewSnapshot?.eligibility.some(
        ({ employeeId }) => employeeId === parsed.actor.userId,
      ) ?? false;
    const reviewSnapshotId = proposal?.reviewSnapshot?.id ?? null;

    const allowedActions: import("@evaluation/contracts").CriteriaWorkspaceAction[] = [];
    const can = (action: Action) =>
      this.policy.allows({ actor: parsed.actor, action, identity, reviewSnapshotId });
    const regularRead = await can("criteria.read");
    const frozenRead =
      parsed.kind === "workstream" &&
      proposal?.state === "contributor_review" &&
      eligible &&
      viewerResponse === null &&
      reviewSnapshotId !== null &&
      (await can("criteria.contributor.respond"));
    if (!regularRead && !frozenRead) throw forbidden();

    const proposalPrerequisites =
      proposal === null
        ? null
        : await this.documentReader.getPrerequisites({
            documentVersionId: proposal.sourceDocumentVersionId,
          });
    const versionIdentity =
      proposal === null
        ? null
        : await this.documentReader.getVersionIdentity({
            documentVersionId: proposal.sourceDocumentVersionId,
          });
    const scopeMatches = (
      prerequisites: import("@evaluation/documents").CriteriaDocumentPrerequisites,
    ) =>
      parsed.kind === "project"
        ? prerequisites.projectId === parsed.resourceId && prerequisites.workstreamId === null
        : prerequisites.projectId === null && prerequisites.workstreamId === parsed.resourceId;
    const currentReady =
      currentPrerequisites !== null &&
      currentPrerequisites.lifecycleState === "ready_for_criteria_generation" &&
      scopeMatches(currentPrerequisites);
    const sourceIsCurrentAndReady =
      proposal !== null &&
      versionIdentity?.isCurrent === true &&
      proposalPrerequisites !== null &&
      proposalPrerequisites.documentVersionId === proposal.sourceDocumentVersionId &&
      proposalPrerequisites.readinessCheckId === proposal.readinessCheckId &&
      ["ready_for_criteria_generation", "revision_required"].includes(
        proposalPrerequisites.lifecycleState,
      ) &&
      scopeMatches(proposalPrerequisites);
    const replacementTransition = proposal?.transitions.find(
      ({ fromState, toState }) =>
        ["owner_review", "manager_resolution"].includes(fromState) && toState === "superseded",
    );
    const replacementRequest =
      proposal?.state === "superseded" &&
      replacementTransition !== undefined &&
      currentReady &&
      currentPrerequisites !== null &&
      currentPrerequisites.documentVersionId === proposal.sourceDocumentVersionId
        ? {
            replacesProposalId: proposal.id,
            ownerFeedback: replacementTransition.reason,
          }
        : null;

    if (
      (proposal === null || proposal.state === "rejected" || replacementRequest !== null) &&
      currentReady &&
      (await can("criteria.generate"))
    ) {
      allowedActions.push("generate");
    }
    if (proposal?.state === "owner_review" && (await can("criteria.owner.review"))) {
      allowedActions.push("owner_review");
      if (sourceIsCurrentAndReady) allowedActions.push("publish");
    }
    if (
      proposal?.state === "contributor_review" &&
      eligible &&
      viewerResponse === null &&
      (await can("criteria.contributor.respond"))
    ) {
      allowedActions.push("respond");
    }
    if (proposal?.state === "manager_resolution" && (await can("criteria.manager.resolve"))) {
      allowedActions.push("manager_resolve");
    }
    if (
      proposal?.state === "approved" &&
      completedResponses === requiredResponses &&
      sourceIsCurrentAndReady &&
      (await can("criteria.activate"))
    ) {
      allowedActions.push("activate");
    }

    return CriteriaWorkspaceSchema.parse({
      proposal:
        proposal === null
          ? null
          : {
              id: proposal.id,
              kind: proposal.kind,
              state: proposal.state,
              version: proposal.version,
              sourceDocumentVersionId: proposal.sourceDocumentVersionId,
              items: proposal.items.map(serializeItem),
              requiredResponses,
              completedResponses,
              objectionCount,
              viewerResponse:
                viewerResponse === null
                  ? null
                  : {
                      action: viewerResponse.response,
                      reason: viewerResponse.reason,
                    },
              managerResolution: proposal.managerResolution,
            },
      activeSet:
        activeSet === null
          ? null
          : {
              id: activeSet.id,
              proposalId: activeSet.proposalId,
              version: activeSet.version,
              effectiveFrom: activeSet.effectiveFrom.toISOString(),
              effectiveTo: activeSet.effectiveTo?.toISOString() ?? null,
              items: activeSet.proposal.items.map(serializeItem),
            },
      replacementRequest,
      allowedActions,
    });
  }
}

function serializeItem(item: {
  id: string;
  position: number;
  name: string;
  selectionReason: string;
  successLink: string;
  expectedBehaviorOrResult: string;
  evaluationMethod: string;
  suggestedEvidence: unknown;
  sourceReferences: unknown;
}) {
  return {
    id: item.id,
    position: item.position,
    name: item.name,
    selectionReason: item.selectionReason,
    successLink: item.successLink,
    expectedBehaviorOrResult: item.expectedBehaviorOrResult,
    evaluationMethod: item.evaluationMethod,
    suggestedEvidence: item.suggestedEvidence,
    sourceReferences: item.sourceReferences,
  };
}

function forbidden(): AppError {
  return new AppError("AUTHZ_SCOPE_MISMATCH", "errors.authorization.denied", 403);
}
