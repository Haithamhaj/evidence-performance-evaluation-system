import {
  AnalysisSourceReferenceSchema,
  AppError,
  ResearchScopeSchema,
} from "@evaluation/contracts";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type Transaction = import("@evaluation/database").DatabaseTransaction;
type Actor = Readonly<{ userId: string; active: boolean }>;

export type ResearchAccessBasis =
  "project_owner" | "project_contributor" | "workstream_contributor" | "assigned_manager";

export type ResearchScopeAuthorization = Readonly<{
  actorId: string;
  projectId: string;
  workstreamId: string | null;
  workItemId: string | null;
  projectStatus: "active" | "paused";
  accessBasis: ResearchAccessBasis;
  authorizedAt: string;
}>;

export type ResearchNamedReference = Readonly<{
  id: string;
  name: string;
  sourceReference: string;
}>;

export type ResearchProgressComponentReference = Readonly<{
  id: string;
  kind: "milestone" | "deliverable" | "kpi" | "acceptance";
  name: string;
  description: string;
  baseline: number | null;
  target: number | null;
  unit: string | null;
  direction: "increase" | "decrease" | "maintain" | null;
  acceptanceConditions: readonly string[];
  requiredEvidence: readonly string[];
  confirmationMode: "measured" | "human_confirmed" | "deterministic";
  sourceReference: string;
}>;

export type ResearchActiveProgressContract = Readonly<{
  id: string;
  contractVersion: number;
  calculationSchemaVersion: string;
  effectiveAt: string;
  sourceDocumentVersionId: string;
  components: readonly ResearchProgressComponentReference[];
  rules: readonly ResearchProgressRuleReference[];
  sourceReference: string;
}>;

export type ResearchProgressRuleReference = Readonly<{
  id: string;
  bindingId: string;
  componentId: string;
  sourceId: string;
  eventKind: "pull_request" | "commit" | "check" | "deployment";
  acceptanceState:
    | "open"
    | "closed"
    | "merged"
    | "created"
    | "queued"
    | "in_progress"
    | "success"
    | "failure"
    | "cancelled"
    | "inactive";
  effectiveAt: string;
  expiresAt: string | null;
  sourceReference: string;
}>;

export type ResearchResponsibilityReference = Readonly<{
  id: string;
  employeeId: string;
  projectId: string | null;
  workstreamId: string | null;
  responsibilityType: "original" | "acting" | "permanent" | "contributor";
  startsAt: string;
  endsAt: string | null;
  sourceReference: string;
}>;

export type ResearchProspectiveProgressProposalReference = Readonly<{
  proposalId: string;
  projectId: string;
  documentVersionId: string;
  revision: number;
  state: "ready";
  sourceReference: string;
}>;

export type ResearchProjectContext = Readonly<{
  projectId: string;
  name: string;
  objective: string;
  description: string;
  workstreams: readonly ResearchNamedReference[];
  activeContract: ResearchActiveProgressContract | null;
  responsibilityWindows: readonly ResearchResponsibilityReference[];
  prospectiveProgressProposals: readonly ResearchProspectiveProgressProposalReference[];
  sourceReferences: readonly string[];
}>;

type ResearchWorkItemReference = Readonly<{
  id: string;
  projectId: string;
  workstreamId: string | null;
}>;

export interface ResearchWorkItemScopeAuthorizer {
  authorizeProjectItem(
    input: Readonly<{
      actor: Actor;
      projectId: string;
      workItemId: string;
      at: Date;
    }>,
  ): Promise<ResearchWorkItemReference>;
}

export interface ResearchScopeAuthorizer {
  authorize(
    input: Readonly<{
      actor: Actor;
      scope: import("@evaluation/contracts").ResearchScope;
      at: Date;
    }>,
  ): Promise<ResearchScopeAuthorization>;
}

export class ResearchProjectContextReader implements ResearchScopeAuthorizer {
  private readonly database: DatabaseClient;
  private readonly workItems: ResearchWorkItemScopeAuthorizer | undefined;

  constructor(database: DatabaseClient, workItems?: ResearchWorkItemScopeAuthorizer) {
    this.database = database;
    this.workItems = workItems;
  }

  async authorize(
    input: Readonly<{
      actor: Actor;
      scope: import("@evaluation/contracts").ResearchScope;
      at: Date;
    }>,
  ): Promise<ResearchScopeAuthorization> {
    const scope = ResearchScopeSchema.parse(input.scope);
    const at = validInstant(input.at);
    const authorization = await this.database.$transaction((transaction) =>
      authorizeProjectScope(transaction, input.actor, scope.projectId, scope.workstreamId, at),
    );
    if (scope.workItemId !== null) {
      if (this.workItems === undefined) throw forbidden();
      const item = await this.workItems.authorizeProjectItem({
        actor: input.actor,
        projectId: scope.projectId,
        workItemId: scope.workItemId,
        at,
      });
      if (
        item.id !== scope.workItemId ||
        item.projectId !== scope.projectId ||
        (scope.workstreamId !== null && item.workstreamId !== scope.workstreamId)
      ) {
        throw forbidden();
      }
    }
    return {
      actorId: input.actor.userId,
      projectId: scope.projectId,
      workstreamId: scope.workstreamId,
      workItemId: scope.workItemId,
      projectStatus: authorization.projectStatus,
      accessBasis: authorization.accessBasis,
      authorizedAt: at.toISOString(),
    };
  }

  async readAuthorizedContext(
    input: Readonly<{
      actor: Actor;
      projectId: string;
      at: Date;
    }>,
  ): Promise<ResearchProjectContext> {
    const at = validInstant(input.at);
    return this.database.$transaction(async (transaction) => {
      const authorization = await authorizeProjectScope(
        transaction,
        input.actor,
        input.projectId,
        null,
        at,
      );
      const project = await transaction.project.findUnique({
        where: { id: input.projectId },
        select: { id: true, name: true, description: true },
      });
      const allWorkstreams = await transaction.workstream.findMany({
        where: { projectId: input.projectId, status: { in: ["active", "paused"] } },
        orderBy: [{ id: "asc" }],
        select: {
          id: true,
          name: true,
          members: {
            where: {
              employeeId: input.actor.userId,
              startsAt: { lte: at },
              OR: [{ endsAt: null }, { endsAt: { gt: at } }],
            },
            take: 1,
            select: { id: true },
          },
        },
      });
      const responsibilities = await transaction.responsibilityWindow.findMany({
        where: {
          AND: [
            {
              OR: [{ projectId: input.projectId }, { workstream: { projectId: input.projectId } }],
            },
            { OR: [{ endsAt: null }, { endsAt: { gt: at } }] },
          ],
          startsAt: { lte: at },
        },
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          employeeId: true,
          projectId: true,
          workstreamId: true,
          responsibilityType: true,
          startsAt: true,
          endsAt: true,
        },
      });
      const activeContract = await transaction.progressContract.findFirst({
        where: {
          projectId: input.projectId,
          workstreamId: null,
          state: "active",
          effectiveAt: { lte: at },
        },
        orderBy: [{ effectiveAt: "desc" }, { contractVersion: "desc" }, { id: "desc" }],
        select: {
          id: true,
          contractVersion: true,
          calculationSchemaVersion: true,
          effectiveAt: true,
          sourceDocumentVersionId: true,
          components: {
            orderBy: [{ position: "asc" }, { id: "asc" }],
            select: {
              id: true,
              kind: true,
              name: true,
              description: true,
              baseline: true,
              target: true,
              unit: true,
              direction: true,
              acceptanceConditions: true,
              requiredEvidence: true,
              confirmationMode: true,
            },
          },
          githubRules: {
            where: {
              effectiveAt: { lte: at },
              OR: [{ expiresAt: null }, { expiresAt: { gt: at } }],
            },
            orderBy: [{ effectiveAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              bindingId: true,
              componentId: true,
              sourceId: true,
              eventKind: true,
              acceptanceState: true,
              effectiveAt: true,
              expiresAt: true,
            },
          },
        },
      });
      const proposals = await transaction.progressContractAiDraftRequest.findMany({
        where: {
          projectId: input.projectId,
          requestedById: input.actor.userId,
          state: "ready",
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          projectId: true,
          documentVersionId: true,
          state: true,
          revisions: {
            orderBy: [{ revision: "desc" }],
            take: 1,
            select: { revision: true },
          },
        },
      });
      if (project === null) throw forbidden();

      const ownedProject = authorization.accessBasis === "project_owner";
      const assignedManager = authorization.accessBasis === "assigned_manager";
      const authorizedWorkstreamIds = new Set([
        ...responsibilities
          .filter(
            (window) => window.employeeId === input.actor.userId && window.workstreamId !== null,
          )
          .map((window) => window.workstreamId!),
        ...allWorkstreams.filter(({ members }) => members.length > 0).map(({ id }) => id),
      ]);
      const visibleWorkstreams =
        ownedProject || assignedManager
          ? allWorkstreams
          : allWorkstreams.filter(({ id }) => authorizedWorkstreamIds.has(id));
      const visibleWorkstreamIds = new Set(visibleWorkstreams.map(({ id }) => id));
      const visibleResponsibilities = responsibilities.filter(
        ({ workstreamId }) => workstreamId === null || visibleWorkstreamIds.has(workstreamId),
      );

      const workstreams = visibleWorkstreams.map(({ id, name }) => ({
        id,
        name,
        sourceReference: sourceReference("workstream", id),
      }));
      const contract =
        activeContract === null
          ? null
          : {
              id: activeContract.id,
              contractVersion: activeContract.contractVersion,
              calculationSchemaVersion: activeContract.calculationSchemaVersion,
              effectiveAt: activeContract.effectiveAt.toISOString(),
              sourceDocumentVersionId: activeContract.sourceDocumentVersionId,
              components: activeContract.components.map((component) => ({
                id: component.id,
                kind: component.kind,
                name: component.name,
                description: component.description,
                baseline: component.baseline === null ? null : Number(component.baseline),
                target: component.target === null ? null : Number(component.target),
                unit: component.unit,
                direction: component.direction,
                acceptanceConditions: strings(component.acceptanceConditions),
                requiredEvidence: strings(component.requiredEvidence),
                confirmationMode: component.confirmationMode,
                sourceReference: sourceReference("progress-component", component.id),
              })),
              rules: activeContract.githubRules.map((rule) => ({
                id: rule.id,
                bindingId: rule.bindingId,
                componentId: rule.componentId,
                sourceId: rule.sourceId,
                eventKind: rule.eventKind,
                acceptanceState: rule.acceptanceState,
                effectiveAt: rule.effectiveAt.toISOString(),
                expiresAt: rule.expiresAt?.toISOString() ?? null,
                sourceReference: sourceReference("progress-rule", rule.id),
              })),
              sourceReference: sourceReference("progress-contract", activeContract.id),
            };
      const responsibilityWindows = visibleResponsibilities.map((window) => ({
        id: window.id,
        employeeId: window.employeeId,
        projectId: window.projectId,
        workstreamId: window.workstreamId,
        responsibilityType: window.responsibilityType,
        startsAt: window.startsAt.toISOString(),
        endsAt: window.endsAt?.toISOString() ?? null,
        sourceReference: sourceReference("responsibility-window", window.id),
      }));
      const prospectiveProgressProposals = proposals.flatMap((proposal) => {
        const revision = proposal.revisions[0]?.revision;
        return revision === undefined
          ? []
          : [
              {
                proposalId: proposal.id,
                projectId: proposal.projectId,
                documentVersionId: proposal.documentVersionId,
                revision,
                state: "ready" as const,
                sourceReference: sourceReference("progress-proposal", proposal.id),
              },
            ];
      });
      const sourceReferences = [
        sourceReference("project", project.id),
        ...workstreams.map(({ sourceReference: reference }) => reference),
        ...responsibilityWindows.map(({ sourceReference: reference }) => reference),
        ...(contract === null
          ? []
          : [
              contract.sourceReference,
              ...contract.components.map(({ sourceReference: reference }) => reference),
              ...contract.rules.map(({ sourceReference: reference }) => reference),
            ]),
        ...prospectiveProgressProposals.map(({ sourceReference: reference }) => reference),
      ].sort();
      return {
        projectId: project.id,
        name: project.name,
        objective: project.description,
        description: project.description,
        workstreams,
        activeContract: contract,
        responsibilityWindows,
        prospectiveProgressProposals,
        sourceReferences,
      };
    });
  }
}

async function authorizeProjectScope(
  transaction: Transaction,
  actor: Actor,
  projectId: string,
  workstreamId: string | null,
  at: Date,
): Promise<Readonly<{ projectStatus: "active" | "paused"; accessBasis: ResearchAccessBasis }>> {
  if (!actor.active) throw forbidden();
  const user = await transaction.user.findUnique({
    where: { id: actor.userId },
    select: { active: true },
  });
  const project = await transaction.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      departmentId: true,
      status: true,
      members: {
        where: {
          employeeId: actor.userId,
          startsAt: { lte: at },
          OR: [{ endsAt: null }, { endsAt: { gt: at } }],
        },
        take: 1,
        select: { id: true },
      },
      workstreams: {
        where: {
          status: { in: ["active", "paused"] },
          members: {
            some: {
              employeeId: actor.userId,
              startsAt: { lte: at },
              OR: [{ endsAt: null }, { endsAt: { gt: at } }],
            },
          },
        },
        select: { id: true },
      },
    },
  });
  const manager = await transaction.roleAssignment.findMany({
    where: {
      userId: actor.userId,
      role: "manager",
      scopeType: "department",
    },
    select: { scope: { select: { departmentId: true } } },
  });
  const projectWindows = await transaction.responsibilityWindow.findMany({
    where: {
      employeeId: actor.userId,
      AND: [
        { OR: [{ projectId }, { workstream: { projectId } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: at } }] },
      ],
      startsAt: { lte: at },
    },
    select: { projectId: true, workstreamId: true, responsibilityType: true },
  });
  const workstream =
    workstreamId === null
      ? null
      : await transaction.workstream.findFirst({
          where: { id: workstreamId, projectId, status: { in: ["active", "paused"] } },
          select: {
            id: true,
            members: {
              where: {
                employeeId: actor.userId,
                startsAt: { lte: at },
                OR: [{ endsAt: null }, { endsAt: { gt: at } }],
              },
              take: 1,
              select: { id: true },
            },
          },
        });
  if (
    user === null ||
    !user.active ||
    project === null ||
    !["active", "paused"].includes(project.status)
  ) {
    throw forbidden();
  }
  const isManager = manager.some(
    (assignment) => assignment.scope.departmentId === project.departmentId,
  );
  const projectOwner = projectWindows.some(
    (window) =>
      window.projectId === projectId &&
      ["original", "acting", "permanent"].includes(window.responsibilityType),
  );
  const projectContributor =
    project.members.length > 0 ||
    projectWindows.some(
      (window) => window.projectId === projectId && window.responsibilityType === "contributor",
    );
  const workstreamContributor =
    workstream !== null &&
    (workstream.members.length > 0 ||
      projectWindows.some((window) => window.workstreamId === workstreamId));
  const anyWorkstreamContributor =
    project.workstreams.length > 0 || projectWindows.some((window) => window.workstreamId !== null);
  if (workstreamId !== null && workstream === null) throw forbidden();
  if (workstreamId !== null && !isManager && !projectOwner && !workstreamContributor) {
    throw forbidden();
  }
  const accessBasis: ResearchAccessBasis | null = isManager
    ? "assigned_manager"
    : projectOwner
      ? "project_owner"
      : workstreamContributor
        ? "workstream_contributor"
        : projectContributor
          ? "project_contributor"
          : anyWorkstreamContributor
            ? "workstream_contributor"
            : null;
  if (accessBasis === null) throw forbidden();
  return { projectStatus: project.status as "active" | "paused", accessBasis };
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function sourceReference(kind: string, id: string): string {
  return AnalysisSourceReferenceSchema.parse(`${kind}:${id}`);
}

function validInstant(at: Date): Date {
  if (!Number.isFinite(at.getTime())) throw forbidden();
  return at;
}

function forbidden(): AppError {
  return new AppError("RESEARCH_SCOPE_FORBIDDEN", "errors.research.scopeForbidden", 403);
}
