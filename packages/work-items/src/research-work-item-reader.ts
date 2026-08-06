import { createHash } from "node:crypto";

import { AnalysisSourceReferenceSchema, AppError } from "@evaluation/contracts";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type DatabaseTransaction = import("@evaluation/database").DatabaseTransaction;
type Actor = Readonly<{ userId: string; active: boolean }>;

export type ResearchWorkItemReference = Readonly<{
  id: string;
  projectId: string;
  workstreamId: string | null;
  title: string;
  description: string;
  status: import("@evaluation/contracts").WorkItemStatus;
  version: number;
  sourceReference: string;
  contentIdentitySha256: string;
  contentIdentityReference: string;
}>;

export interface ConfirmedTaskCreator {
  createConfirmedTask(
    transaction: DatabaseTransaction,
    input: Readonly<{
      actor: Actor;
      correlationId: string;
      workItemId: string;
      input: import("@evaluation/contracts").CreateWorkItemInput;
      reason: string;
    }>,
  ): Promise<ResearchWorkItemReference>;
}

type ExistingConfirmedTaskCommand = Readonly<{
  createConfirmedTask(
    transaction: DatabaseTransaction,
    command: Readonly<{
      actor: Actor;
      correlationId: string;
      workItemId: string;
      input: import("@evaluation/contracts").CreateWorkItemInput;
      reason: string;
    }>,
  ): Promise<import("@evaluation/contracts").WorkItemDetail>;
}>;

export class ResearchWorkItemReader {
  private readonly database: DatabaseClient;

  constructor(database: DatabaseClient) {
    this.database = database;
  }

  async listAuthorizedProjectItems(
    input: Readonly<{
      actor: Actor;
      projectId: string;
      at: Date;
    }>,
  ): Promise<readonly ResearchWorkItemReference[]> {
    const at = validInstant(input.at);
    return this.database.$transaction(async (transaction) => {
      await assertActiveDatabaseUser(transaction, input.actor);
      const access = await authorizeResearchProject(transaction, input.actor, input.projectId, at);
      const rows = await transaction.workItem.findMany({
        where: {
          projectId: input.projectId,
          status: { not: "cancelled" },
          ...(access.allProjectItems ? {} : { workstreamId: { in: [...access.workstreamIds] } }),
        },
        orderBy: [{ id: "asc" }],
        select: {
          id: true,
          projectId: true,
          workstreamId: true,
          title: true,
          description: true,
          status: true,
          version: true,
        },
      });
      return rows.map(serializeReference);
    });
  }

  async authorizeProjectItem(
    input: Readonly<{
      actor: Actor;
      projectId: string;
      workItemId: string;
      at: Date;
    }>,
  ): Promise<ResearchWorkItemReference> {
    const at = validInstant(input.at);
    return this.database.$transaction(async (transaction) => {
      await assertActiveDatabaseUser(transaction, input.actor);
      const access = await authorizeResearchProject(transaction, input.actor, input.projectId, at);
      const row = await transaction.workItem.findFirst({
        where: {
          id: input.workItemId,
          projectId: input.projectId,
          status: { not: "cancelled" },
        },
        select: {
          id: true,
          projectId: true,
          workstreamId: true,
          title: true,
          description: true,
          status: true,
          version: true,
        },
      });
      if (
        row === null ||
        (!access.allProjectItems &&
          (row.workstreamId === null || !access.workstreamIds.includes(row.workstreamId)))
      ) {
        throw forbidden();
      }
      return serializeReference(row);
    });
  }
}

export class ConfirmedTaskCreatorAdapter implements ConfirmedTaskCreator {
  private readonly command: ExistingConfirmedTaskCommand;

  constructor(command: ExistingConfirmedTaskCommand) {
    this.command = command;
  }

  async createConfirmedTask(
    transaction: DatabaseTransaction,
    input: Readonly<{
      actor: Actor;
      correlationId: string;
      workItemId: string;
      input: import("@evaluation/contracts").CreateWorkItemInput;
      reason: string;
    }>,
  ): Promise<ResearchWorkItemReference> {
    const created = await this.command.createConfirmedTask(transaction, input);
    return serializeReference(created);
  }
}

async function assertActiveDatabaseUser(
  transaction: DatabaseTransaction,
  actor: Actor,
): Promise<void> {
  if (!actor.active) throw forbidden();
  const user = await transaction.user.findUnique({
    where: { id: actor.userId },
    select: { active: true },
  });
  if (user?.active !== true) throw forbidden();
}

async function authorizeResearchProject(
  transaction: DatabaseTransaction,
  actor: Actor,
  projectId: string,
  at: Date,
): Promise<Readonly<{ allProjectItems: boolean; workstreamIds: readonly string[] }>> {
  const project = await transaction.project.findUnique({
    where: { id: projectId },
    select: {
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
    },
  });
  if (project === null || !["active", "paused"].includes(project.status)) throw forbidden();
  const manager = await transaction.roleAssignment.findFirst({
    where: {
      userId: actor.userId,
      role: "manager",
      scopeType: "department",
      scope: { departmentId: project.departmentId },
    },
    select: { id: true },
  });
  const projectResponsibilities = await transaction.responsibilityWindow.findMany({
    where: {
      employeeId: actor.userId,
      projectId,
      startsAt: { lte: at },
      OR: [{ endsAt: null }, { endsAt: { gt: at } }],
    },
    select: { id: true },
  });
  if (project.members.length > 0 || projectResponsibilities.length > 0 || manager !== null) {
    return { allProjectItems: true, workstreamIds: [] };
  }
  const memberships = await transaction.workstreamMember.findMany({
    where: {
      employeeId: actor.userId,
      startsAt: { lte: at },
      OR: [{ endsAt: null }, { endsAt: { gt: at } }],
      workstream: { projectId, status: { in: ["active", "paused"] } },
    },
    select: { workstreamId: true },
  });
  const responsibilities = await transaction.responsibilityWindow.findMany({
    where: {
      employeeId: actor.userId,
      workstream: { projectId, status: { in: ["active", "paused"] } },
      startsAt: { lte: at },
      OR: [{ endsAt: null }, { endsAt: { gt: at } }],
    },
    select: { workstreamId: true },
  });
  const workstreamIds = [
    ...new Set(
      [...memberships, ...responsibilities].flatMap(({ workstreamId }) =>
        workstreamId === null ? [] : [workstreamId],
      ),
    ),
  ].sort();
  if (workstreamIds.length === 0) throw forbidden();
  return { allProjectItems: false, workstreamIds };
}

function serializeReference(
  row: Readonly<{
    id: string;
    projectId: string;
    workstreamId: string | null;
    title: string;
    description: string;
    status: import("@evaluation/contracts").WorkItemStatus;
    version: number;
  }>,
): ResearchWorkItemReference {
  const contentIdentitySha256 = createHash("sha256")
    .update(
      JSON.stringify({
        kind: "work-item",
        id: row.id,
        projectId: row.projectId,
        workstreamId: row.workstreamId,
        title: row.title,
        description: row.description,
        status: row.status,
        version: row.version,
      }),
      "utf8",
    )
    .digest("hex");
  return {
    id: row.id,
    projectId: row.projectId,
    workstreamId: row.workstreamId,
    title: row.title,
    description: row.description,
    status: row.status,
    version: row.version,
    sourceReference: AnalysisSourceReferenceSchema.parse(`work-item:${row.id}`),
    contentIdentitySha256,
    contentIdentityReference: AnalysisSourceReferenceSchema.parse(
      `work-item-version:${contentIdentitySha256}`,
    ),
  };
}

function validInstant(at: Date): Date {
  if (!Number.isFinite(at.getTime())) throw forbidden();
  return at;
}

function forbidden(): AppError {
  return new AppError("RESEARCH_SCOPE_FORBIDDEN", "errors.research.scopeForbidden", 403);
}
