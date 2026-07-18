import { MyWorkResponseSchema, WorkItemDetailSchema } from "@evaluation/contracts";

type DatabaseClient = import("@evaluation/database").DatabaseClient;

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
}) {
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
  });
}
