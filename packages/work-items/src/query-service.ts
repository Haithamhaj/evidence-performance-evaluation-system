import { AppError, MyWorkResponseSchema, WorkItemDetailSchema } from "@evaluation/contracts";

import { getDependencyAwareWorkItemTransitions } from "./invariants.js";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type WorkItemWhere = NonNullable<
  NonNullable<Parameters<DatabaseClient["workItem"]["findMany"]>[0]>["where"]
>;

export class WorkItemQueryService {
  private readonly client: DatabaseClient;
  private readonly clock: () => Date;
  private readonly timeZone: string;

  constructor(
    client: DatabaseClient,
    clock: () => Date = () => new Date(),
    timeZone = "Asia/Riyadh",
  ) {
    this.client = client;
    this.clock = clock;
    this.timeZone = timeZone;
  }

  async getAuthorizedWorkItem(input: {
    actorId: string;
    workItemId: string;
  }): Promise<import("@evaluation/contracts").WorkItemDetail> {
    const item = await this.client.workItem.findFirst({
      where: {
        id: input.workItemId,
        project: {
          OR: [
            {
              members: {
                some: {
                  employeeId: input.actorId,
                  startsAt: { lte: this.clock() },
                  OR: [{ endsAt: null }, { endsAt: { gt: this.clock() } }],
                },
              },
            },
            {
              department: {
                authorizationScopes: {
                  some: {
                    roleAssignments: {
                      some: { userId: input.actorId, role: "manager" },
                    },
                  },
                },
              },
            },
          ],
        },
      },
    });
    if (item === null) {
      throw new (await import("@evaluation/contracts")).AppError(
        "SCOPE_MISMATCH",
        "errors.authorization.scopeMismatch",
        403,
      );
    }
    return serialize(item);
  }

  async getAuthorizedDependencies(input: {
    actorId: string;
    workItemId: string;
  }): Promise<import("@evaluation/contracts").WorkItemDependencies> {
    await this.getAuthorizedWorkItem(input);
    const item = await this.client.workItem.findUniqueOrThrow({
      where: { id: input.workItemId },
      select: {
        id: true,
        status: true,
        version: true,
        dependencies: {
          orderBy: { createdAt: "asc" },
          select: { dependsOnWorkItem: { select: { id: true, title: true, status: true } } },
        },
        blocks: {
          orderBy: { createdAt: "asc" },
          select: { workItem: { select: { id: true, title: true, status: true } } },
        },
      },
    });
    const dependsOn = item.dependencies.map(({ dependsOnWorkItem }) => dependsOnWorkItem);
    return (await import("@evaluation/contracts")).WorkItemDependenciesSchema.parse({
      workItemId: item.id,
      version: item.version,
      readiness: dependsOn.some(({ status }) => !["done", "cancelled"].includes(status))
        ? "blocked_by_dependency"
        : "ready",
      allowedTransitions: getDependencyAwareWorkItemTransitions(
        item.status,
        dependsOn.some(({ status }) => !["done", "cancelled"].includes(status)),
      ),
      dependsOn,
      blocks: item.blocks.map(({ workItem }) => workItem),
    });
  }

  async listMyWork(input: {
    actorId: string;
    limit?: number;
  }): Promise<import("@evaluation/contracts").MyWorkResponse> {
    const now = this.clock();
    const todayKey = calendarDayKey(now, this.timeZone);
    const rows = await this.client.workItem.findMany({
      where: {
        assigneeId: input.actorId,
        status: { notIn: ["done", "cancelled"] },
      },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }, { id: "asc" }],
      take: Math.min(Math.max(input.limit ?? 100, 1), 200),
    });
    const needsAction = rows.filter(({ status }) => ["ready", "in_review"].includes(status));
    const needsActionIds = new Set(needsAction.map(({ id }) => id));
    const today = rows.filter(
      ({ id, dueAt }) =>
        !needsActionIds.has(id) &&
        dueAt !== null &&
        dueAt >= now &&
        calendarDayKey(dueAt, this.timeZone) === todayKey,
    );
    const todayIds = new Set(today.map(({ id }) => id));
    const overdue = rows.filter(
      ({ id, dueAt }) =>
        !needsActionIds.has(id) && !todayIds.has(id) && dueAt !== null && dueAt < now,
    );
    const claimed = new Set([...needsAction, ...overdue, ...today].map(({ id }) => id));
    const remaining = rows.filter(({ id }) => !claimed.has(id));
    return MyWorkResponseSchema.parse({
      groups: [
        { key: "needs_my_action", items: needsAction.map(serialize), collapsedByDefault: false },
        { key: "today", items: today.map(serialize), collapsedByDefault: false },
        { key: "overdue", items: overdue.map(serialize), collapsedByDefault: false },
        {
          key: "waiting_blocked",
          items: remaining.filter(({ status }) => status === "blocked").map(serialize),
          collapsedByDefault: true,
        },
        {
          key: "this_week",
          items: remaining.filter(({ status }) => status !== "blocked").map(serialize),
          collapsedByDefault: true,
        },
      ],
      nextCursor: null,
    });
  }

  async listUpdatable(input: { actorId: string }): Promise<
    ReadonlyArray<
      Readonly<{
        id: string;
        projectId: string;
        workstreamId: string | null;
        title: string;
      }>
    >
  > {
    const rows = await this.client.workItem.findMany({
      where: {
        project: {
          members: {
            some: {
              employeeId: input.actorId,
              startsAt: { lte: this.clock() },
              OR: [{ endsAt: null }, { endsAt: { gt: this.clock() } }],
            },
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        projectId: true,
        workstreamId: true,
        title: true,
      },
      take: 200,
    });
    return rows.map(({ id, projectId, workstreamId, title }) => ({
      id,
      projectId,
      workstreamId,
      title,
    }));
  }

  async listWorkspace(input: {
    actor: { userId: string; active: boolean };
    view: import("@evaluation/contracts").WorkItemWorkspaceView;
    layout: import("@evaluation/contracts").WorkItemWorkspaceLayout;
    projectId: string | null;
    status: import("@evaluation/contracts").WorkItemStatus | null;
    search: string | null;
    sort: import("@evaluation/contracts").WorkItemWorkspaceSort;
    limit: number;
    cursor: string | null;
  }): Promise<{
    view: import("@evaluation/contracts").WorkItemWorkspaceView;
    layout: import("@evaluation/contracts").WorkItemWorkspaceLayout;
    items: import("@evaluation/contracts").WorkItemDetail[];
    nextCursor: string | null;
    counts: Record<import("@evaluation/contracts").WorkItemStatus | "all", number>;
  }> {
    if (!input.actor.active) throw scopeError();
    const scopeWhere: WorkItemWhere =
      input.view === "my"
        ? {
            OR: [
              { assigneeId: input.actor.userId },
              { createdById: input.actor.userId },
              {
                participants: {
                  some: {
                    employeeId: input.actor.userId,
                    startsAt: { lte: this.clock() },
                    OR: [{ endsAt: null }, { endsAt: { gt: this.clock() } }],
                  },
                },
              },
            ],
          }
        : {
            project: {
              department: {
                authorizationScopes: {
                  some: {
                    roleAssignments: {
                      some: { userId: input.actor.userId, role: "manager" },
                    },
                  },
                },
              },
            },
          };
    const baseWhere: WorkItemWhere = {
      AND: [
        scopeWhere,
        ...(input.projectId === null ? [] : [{ projectId: input.projectId }]),
        ...(input.search === null
          ? []
          : [
              {
                OR: [
                  { title: { contains: input.search, mode: "insensitive" as const } },
                  { description: { contains: input.search, mode: "insensitive" as const } },
                ],
              },
            ]),
      ],
    };
    const where: WorkItemWhere =
      input.status === null ? baseWhere : { AND: [baseWhere, { status: input.status }] };
    const limit = Math.min(Math.max(input.limit, 1), 200);
    const orderBy =
      input.sort === "updated_desc"
        ? ([{ updatedAt: "desc" }, { id: "desc" }] as const)
        : input.sort === "priority_desc"
          ? ([{ priority: "desc" }, { dueAt: "asc" }, { id: "asc" }] as const)
          : ([{ dueAt: "asc" }, { updatedAt: "desc" }, { id: "asc" }] as const);
    const rows = await this.client.workItem.findMany({
      where,
      orderBy: [...orderBy],
      ...(input.cursor === null ? {} : { cursor: { id: input.cursor }, skip: 1 }),
      take: limit + 1,
      include: {
        dependencies: { select: { dependsOnWorkItem: { select: { status: true } } } },
      },
    });
    const statuses = [
      "planned",
      "ready",
      "in_progress",
      "blocked",
      "in_review",
      "done",
      "cancelled",
    ] as const;
    const [all, ...statusCounts] = await Promise.all([
      this.client.workItem.count({ where: baseWhere }),
      ...statuses.map((status) =>
        this.client.workItem.count({ where: { AND: [baseWhere, { status }] } }),
      ),
    ]);
    const visibleRows = rows.slice(0, limit);
    return {
      view: input.view,
      layout: input.layout,
      items: visibleRows.map(serialize),
      nextCursor: rows.length > limit ? (visibleRows.at(-1)?.id ?? null) : null,
      counts: Object.fromEntries([
        ["all", all],
        ...statuses.map((status, index) => [status, statusCounts[index] ?? 0]),
      ]) as Record<import("@evaluation/contracts").WorkItemStatus | "all", number>,
    };
  }
}

function calendarDayKey(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(value);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function serialize(item: {
  id: string;
  projectId: string;
  workstreamId: string | null;
  title: string;
  description: string;
  status: import("@evaluation/contracts").WorkItemStatus;
  priority: import("@evaluation/contracts").WorkItemPriority;
  assigneeId: string | null;
  dueAt: Date | null;
  requirements: unknown;
  acceptanceConditions: unknown;
  blocker: string | null;
  nextAction: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  dependencies?: readonly Readonly<{
    dependsOnWorkItem: Readonly<{ status: import("@evaluation/contracts").WorkItemStatus }>;
  }>[];
}) {
  const hasUnfinishedDependency =
    item.dependencies?.some(
      ({ dependsOnWorkItem }) => !["done", "cancelled"].includes(dependsOnWorkItem.status),
    ) ?? false;
  return WorkItemDetailSchema.parse({
    id: item.id,
    projectId: item.projectId,
    workstreamId: item.workstreamId,
    title: item.title,
    description: item.description,
    status: item.status,
    priority: item.priority,
    assigneeId: item.assigneeId,
    dueAt: item.dueAt?.toISOString() ?? null,
    requirements: item.requirements,
    acceptanceConditions: item.acceptanceConditions,
    blocker: item.blocker,
    nextAction: item.nextAction,
    version: item.version,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    allowedActions:
      item.status === "done" || item.status === "cancelled"
        ? ["add_update"]
        : ["edit", "transition", "assign", "add_update"],
    allowedTransitions: getDependencyAwareWorkItemTransitions(item.status, hasUnfinishedDependency),
  });
}

function scopeError(): AppError {
  return new AppError("SCOPE_MISMATCH", "errors.authorization.scopeMismatch", 403);
}
