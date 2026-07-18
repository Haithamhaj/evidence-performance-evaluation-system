import { AppError } from "@evaluation/contracts";

type Transaction = import("@evaluation/database").DatabaseTransaction;
type AuthorizedWorkItem = Readonly<{
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
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}>;

export async function authorizeProject(
  transaction: Transaction,
  actor: { userId: string; active: boolean },
  projectId: string,
  current: Date,
): Promise<{ id: string; departmentId: string; status: string }> {
  if (!actor.active) throw scopeError();
  const project = await transaction.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      departmentId: true,
      status: true,
      members: {
        where: {
          employeeId: actor.userId,
          startsAt: { lte: current },
          OR: [{ endsAt: null }, { endsAt: { gt: current } }],
        },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (project === null || !["active", "paused"].includes(project.status)) throw scopeError();
  const privileged = await transaction.roleAssignment.findFirst({
    where: {
      userId: actor.userId,
      OR: [
        {
          role: "manager",
          scopeType: "department",
          scope: { departmentId: project.departmentId },
        },
        {
          role: { in: ["project_owner", "contributor"] },
          scopeType: "project",
          scopeId: project.id,
        },
      ],
    },
    select: { id: true },
  });
  if (project.members.length === 0 && privileged === null) throw scopeError();
  return project;
}

export async function loadAuthorizedItem(
  transaction: Transaction,
  actor: { userId: string; active: boolean },
  workItemId: string,
  current: Date,
): Promise<AuthorizedWorkItem> {
  const item = await transaction.workItem.findUnique({ where: { id: workItemId } });
  if (item === null) throw scopeError();
  await authorizeProject(transaction, actor, item.projectId, current);
  return item;
}

export async function assertEligibleAssignee(
  transaction: Transaction,
  assigneeId: string | null,
  projectId: string,
  workstreamId: string | null,
  current: Date,
): Promise<void> {
  if (assigneeId === null) return;
  const member = await transaction.projectMember.findFirst({
    where: {
      projectId,
      employeeId: assigneeId,
      startsAt: { lte: current },
      OR: [{ endsAt: null }, { endsAt: { gt: current } }],
      ...(workstreamId === null
        ? {}
        : {
            employee: {
              workstreamMemberships: {
                some: {
                  workstreamId,
                  startsAt: { lte: current },
                  OR: [{ endsAt: null }, { endsAt: { gt: current } }],
                },
              },
            },
          }),
    },
    select: { id: true },
  });
  if (member === null)
    throw new AppError("WORK_ITEM_ASSIGNEE_INVALID", "errors.workItems.assigneeInvalid", 400);
}

export async function lockWorkItem(transaction: Transaction, workItemId: string): Promise<void> {
  await transaction.$queryRaw`SELECT id FROM "WorkItem" WHERE id = ${workItemId}::uuid FOR UPDATE`;
}

function scopeError(): AppError {
  return new AppError("SCOPE_MISMATCH", "errors.authorization.scopeMismatch", 403);
}
