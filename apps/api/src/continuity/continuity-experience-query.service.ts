/* eslint-disable no-unused-vars */
type DatabaseClient = import("@evaluation/database").DatabaseClient;

type Scope = Readonly<{
  kind: "PROJECT" | "WORKSTREAM";
  id: string;
  name: string;
  departmentId: string;
}>;
type DelegationCandidate = Readonly<{
  id: string;
  name: string;
  departmentId: string;
}>;
type DelegationScope = Readonly<{
  kind: "PROJECT" | "WORKSTREAM";
  id: string;
  name: string;
  actions: readonly string[];
}>;
type Delegation = Readonly<{
  id: string;
  leaveId: string;
  role: "manager" | "owner" | "delegate";
  ownerName: string;
  delegateName: string;
  state: "PENDING_DELEGATE" | "ACTIVE" | "EXPIRED" | "RETURNED";
  startsAt: string;
  endsAt: string;
  scopes: readonly DelegationScope[];
  delegateConfirmed: boolean;
  openAccessGapCount: number;
  returnHandover: null | Readonly<{
    id: string;
    state: "DRAFT" | "OWNER_CONFIRMED" | "FINALIZED";
    version: number;
  }>;
}>;
type Leave = Readonly<{
  id: string;
  employeeId: string;
  employeeName: string;
  state: "SUBMITTED" | "APPROVED" | "ACTIVE" | "REJECTED" | "CANCELLED" | "RETURNED";
  startsAt: string;
  endsAt: string;
  affectedScopeCount: number;
  affectedScopes?: readonly Scope[];
  version: number;
  handover: null | Readonly<{
    id: string;
    revision: number;
    itemCount: number;
    confirmed: boolean;
  }>;
}>;
export type ContinuityExperienceView = Readonly<{
  mode: "employee" | "manager";
  generatedAt: string;
  leaves: readonly Leave[];
  availableScopes: readonly Scope[];
  delegationCandidates: readonly DelegationCandidate[];
  delegations: readonly Delegation[];
}>;

export interface ContinuityExperienceSource {
  load(actorId: string, at: string): Promise<Omit<ContinuityExperienceView, "generatedAt">>;
}

export class ContinuityExperienceQueryService {
  constructor(
    private readonly source: ContinuityExperienceSource,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async load(actorId: string): Promise<ContinuityExperienceView> {
    const generatedAt = this.clock().toISOString();
    const view = await this.source.load(actorId, generatedAt);
    return {
      generatedAt,
      ...view,
      delegations: view.delegations.map((delegation) => ({
        ...delegation,
        state:
          delegation.state === "ACTIVE" && Date.parse(delegation.endsAt) <= Date.parse(generatedAt)
            ? "EXPIRED"
            : delegation.state,
      })),
    };
  }
}

export function createDatabaseContinuityExperienceQueryService(database: DatabaseClient) {
  return new ContinuityExperienceQueryService(new DatabaseContinuityExperienceSource(database));
}

class DatabaseContinuityExperienceSource implements ContinuityExperienceSource {
  constructor(private readonly database: DatabaseClient) {}

  async load(actorId: string, at: string) {
    const instant = new Date(at);
    const managerAssignments = await this.database.roleAssignment.findMany({
      where: { userId: actorId, role: "manager", scopeType: "department" },
      select: { scope: { select: { departmentId: true } } },
    });
    const departmentIds = managerAssignments.flatMap(({ scope }) =>
      scope.departmentId === null ? [] : [scope.departmentId],
    );
    if (departmentIds.length > 0) {
      const [rows, projects, workstreams, candidates, delegations] = await Promise.all([
        this.database.leaveRecord.findMany({
          where: {
            departmentId: { in: departmentIds },
            state: { in: ["SUBMITTED", "APPROVED", "ACTIVE"] },
          },
          include: {
            employee: { select: { displayName: true } },
            handovers: {
              take: 1,
              orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
              include: {
                currentRevision: {
                  select: {
                    revision: true,
                    items: { select: { id: true } },
                    confirmations: { select: { id: true } },
                  },
                },
              },
            },
          },
          orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        }),
        this.database.project.findMany({
          where: { departmentId: { in: departmentIds }, status: "active" },
          select: { id: true, name: true, departmentId: true },
        }),
        this.database.workstream.findMany({
          where: { project: { departmentId: { in: departmentIds } }, status: "active" },
          select: {
            id: true,
            name: true,
            project: { select: { departmentId: true } },
          },
        }),
        this.database.roleAssignment.findMany({
          where: {
            role: "employee",
            scopeType: "department",
            scope: { departmentId: { in: departmentIds } },
            user: { active: true },
          },
          select: {
            user: { select: { id: true, displayName: true } },
            scope: { select: { departmentId: true } },
          },
          orderBy: [{ user: { displayName: "asc" } }, { userId: "asc" }],
        }),
        loadDelegations(this.database, { managerId: actorId }),
      ]);
      const availableScopes: Scope[] = [
        ...projects.map((project) => ({ kind: "PROJECT" as const, ...project })),
        ...workstreams.map(({ project, ...workstream }) => ({
          kind: "WORKSTREAM" as const,
          ...workstream,
          departmentId: project.departmentId,
        })),
      ];
      return {
        mode: "manager" as const,
        availableScopes: [],
        leaves: rows.map((leave) => projectLeave(leave, availableScopes, true)),
        delegationCandidates: uniqueCandidates(candidates),
        delegations: delegations.map((delegation) => projectDelegation(delegation, actorId)),
      };
    }

    const [rows, projects, workstreams, delegations] = await Promise.all([
      this.database.leaveRecord.findMany({
        where: { employeeId: actorId },
        include: {
          employee: { select: { displayName: true } },
          handovers: {
            take: 1,
            orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
            include: {
              currentRevision: {
                select: {
                  revision: true,
                  items: { select: { id: true } },
                  confirmations: { select: { id: true } },
                },
              },
            },
          },
        },
        orderBy: [{ startsAt: "desc" }, { id: "asc" }],
      }),
      this.database.projectMember.findMany({
        where: {
          employeeId: actorId,
          startsAt: { lte: instant },
          OR: [{ endsAt: null }, { endsAt: { gt: instant } }],
          project: { status: "active" },
        },
        select: { project: { select: { id: true, name: true, departmentId: true } } },
      }),
      this.database.workstreamMember.findMany({
        where: {
          employeeId: actorId,
          startsAt: { lte: instant },
          OR: [{ endsAt: null }, { endsAt: { gt: instant } }],
          workstream: { status: "active" },
        },
        select: {
          workstream: {
            select: { id: true, name: true, project: { select: { departmentId: true } } },
          },
        },
      }),
      loadDelegations(this.database, { actorId }),
    ]);
    const availableScopes: Scope[] = [
      ...projects.map(({ project }) => ({ kind: "PROJECT" as const, ...project })),
      ...workstreams.map(({ workstream }) => ({
        kind: "WORKSTREAM" as const,
        id: workstream.id,
        name: workstream.name,
        departmentId: workstream.project.departmentId,
      })),
    ];
    return {
      mode: "employee" as const,
      leaves: rows.map((leave) => projectLeave(leave, availableScopes)),
      availableScopes,
      delegationCandidates: [],
      delegations: delegations.map((delegation) => projectDelegation(delegation, actorId)),
    };
  }
}

function projectLeave(
  leave: {
    id: string;
    employeeId: string;
    employee: { displayName: string };
    state: string;
    startsAt: Date;
    endsAt: Date;
    affectedScopes: unknown;
    version: number;
    handovers: readonly {
      id: string;
      currentRevision: null | {
        revision: number;
        items: readonly { id: string }[];
        confirmations: readonly { id: string }[];
      };
    }[];
  },
  availableScopes: readonly Scope[] = [],
  exposeScopes = availableScopes.length > 0,
): Leave {
  const rawScopes = Array.isArray(leave.affectedScopes) ? leave.affectedScopes : [];
  const scopes = rawScopes.flatMap((value) => {
    if (value === null || typeof value !== "object") return [];
    const item = value as {
      kind?: unknown;
      id?: unknown;
      name?: unknown;
      departmentId?: unknown;
    };
    if (!["PROJECT", "WORKSTREAM"].includes(String(item.kind)) || typeof item.id !== "string")
      return [];
    const match = availableScopes.find(
      ({ kind, id }) => kind === String(item.kind) && id === item.id,
    );
    return match === undefined ? [] : [match];
  });
  const handover = leave.handovers[0];
  const revision = handover?.currentRevision;
  return {
    id: leave.id,
    employeeId: leave.employeeId,
    employeeName: leave.employee.displayName,
    state: leave.state as Leave["state"],
    startsAt: leave.startsAt.toISOString(),
    endsAt: leave.endsAt.toISOString(),
    affectedScopeCount: rawScopes.length,
    ...(exposeScopes ? { affectedScopes: scopes } : {}),
    version: leave.version,
    handover:
      handover === undefined || revision == null
        ? null
        : {
            id: handover.id,
            revision: revision.revision,
            itemCount: revision.items.length,
            confirmed: revision.confirmations.length > 0,
          },
  };
}

function loadDelegations(
  database: DatabaseClient,
  filter: { managerId: string } | { actorId: string },
) {
  return database.delegation.findMany({
    where: {
      ...(filter && "managerId" in filter
        ? { managerId: filter.managerId }
        : { OR: [{ ownerId: filter.actorId }, { delegateId: filter.actorId }] }),
      state: { in: ["PENDING_DELEGATE", "ACTIVE", "EXPIRED", "RETURNED"] },
    },
    include: {
      owner: { select: { displayName: true } },
      delegate: { select: { displayName: true } },
      periods: { orderBy: [{ startsAt: "asc" }, { id: "asc" }] },
      scopes: {
        include: {
          project: { select: { id: true, name: true } },
          workstream: { select: { id: true, name: true } },
        },
        orderBy: [{ scopeKind: "asc" }, { projectId: "asc" }, { workstreamId: "asc" }],
      },
      confirmations: { select: { receiptConfirmed: true, accessConfirmed: true } },
      accessGaps: { where: { state: "OPEN", resolution: null }, select: { id: true } },
      returnHandovers: {
        take: 1,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        select: { id: true, state: true, version: true },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
}

type LoadedDelegation = Awaited<ReturnType<typeof loadDelegations>>[number];

function projectDelegation(row: LoadedDelegation, actorId: string): Delegation {
  const period = row.periods.at(-1);
  if (!period) throw new Error("Delegation period missing");
  const grouped = new Map<string, DelegationScope>();
  for (const scope of row.scopes) {
    const target = scope.scopeKind === "PROJECT" ? scope.project : scope.workstream;
    if (!target) continue;
    const key = `${scope.scopeKind}:${target.id}`;
    const existing = grouped.get(key);
    grouped.set(key, {
      kind: scope.scopeKind,
      id: target.id,
      name: target.name,
      actions: [...(existing?.actions ?? []), scope.action],
    });
  }
  const returnHandover = row.returnHandovers[0];
  return {
    id: row.id,
    leaveId: row.leaveId,
    role: row.managerId === actorId ? "manager" : row.ownerId === actorId ? "owner" : "delegate",
    ownerName: row.owner.displayName,
    delegateName: row.delegate.displayName,
    state: row.state as Delegation["state"],
    startsAt: period.startsAt.toISOString(),
    endsAt: period.endsAt.toISOString(),
    scopes: [...grouped.values()],
    delegateConfirmed: row.confirmations.some(
      ({ receiptConfirmed, accessConfirmed }) => receiptConfirmed && accessConfirmed,
    ),
    openAccessGapCount: row.accessGaps.length,
    returnHandover:
      returnHandover === undefined
        ? null
        : {
            id: returnHandover.id,
            state: returnHandover.state,
            version: returnHandover.version,
          },
  };
}

function uniqueCandidates(
  rows: readonly {
    user: { id: string; displayName: string };
    scope: { departmentId: string | null };
  }[],
): DelegationCandidate[] {
  const unique = new Map<string, DelegationCandidate>();
  for (const row of rows) {
    if (row.scope.departmentId === null) continue;
    unique.set(row.user.id, {
      id: row.user.id,
      name: row.user.displayName,
      departmentId: row.scope.departmentId,
    });
  }
  return [...unique.values()];
}
