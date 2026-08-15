/* eslint-disable no-unused-vars */
type DatabaseClient = import("@evaluation/database").DatabaseClient;

type Scope = Readonly<{
  kind: "PROJECT" | "WORKSTREAM";
  id: string;
  name: string;
  departmentId: string;
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
    return { generatedAt, ...(await this.source.load(actorId, generatedAt)) };
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
      const rows = await this.database.leaveRecord.findMany({
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
      });
      return {
        mode: "manager" as const,
        availableScopes: [],
        leaves: rows.map((leave) => projectLeave(leave)),
      };
    }

    const [rows, projects, workstreams] = await Promise.all([
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
    ...(availableScopes.length > 0 ? { affectedScopes: scopes } : {}),
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
