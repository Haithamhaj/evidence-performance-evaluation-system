import { databaseAuditWriter } from "@evaluation/audit";
import {
  AddMemberSchema,
  AppError,
  CreateWorkstreamSchema,
  EndMembershipSchema,
  UpdateStatusSchema,
  WorkstreamWorkspaceSchema,
  WorkstreamSchema,
} from "@evaluation/contracts";
import { decide } from "@evaluation/permissions";
import { z } from "zod";

import { assertLifecycleTransition } from "./invariants.js";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type Transaction = import("@evaluation/database").DatabaseTransaction;
type AuditWriter = import("@evaluation/contracts").AuditWriter<Transaction>;

const ActorSchema = z.object({ userId: z.string().uuid(), active: z.boolean() }).strict();
const WorkstreamCommandBase = z.object({
  actor: ActorSchema,
  correlationId: z.string().uuid(),
  projectId: z.string().uuid(),
});
const CreateCommandSchema = WorkstreamCommandBase.extend({
  input: CreateWorkstreamSchema,
}).strict();
const WorkstreamResourceCommandSchema = WorkstreamCommandBase.extend({
  workstreamId: z.string().uuid(),
}).strict();
const AddContributorCommandSchema = WorkstreamResourceCommandSchema.extend({
  input: AddMemberSchema,
}).strict();
const EndContributorCommandSchema = WorkstreamResourceCommandSchema.extend({
  userId: z.string().uuid(),
  input: EndMembershipSchema,
}).strict();
const TransitionCommandSchema = WorkstreamResourceCommandSchema.extend({
  input: UpdateStatusSchema,
}).strict();
const ListCommandSchema = z.object({ actor: ActorSchema, projectId: z.string().uuid() }).strict();
const GetCommandSchema = ListCommandSchema.extend({ workstreamId: z.string().uuid() }).strict();

export class WorkstreamService {
  private readonly client: DatabaseClient;
  private readonly auditWriter: AuditWriter;
  private readonly clock: () => Date;

  constructor(client: DatabaseClient, auditWriter: AuditWriter, clock: () => Date) {
    this.client = client;
    this.auditWriter = auditWriter;
    this.clock = clock;
  }

  async createWorkstream(command: unknown): Promise<import("@evaluation/contracts").Workstream> {
    const parsed = CreateCommandSchema.parse(command);
    const current = validClock(this.clock());
    const startsAt = new Date(parsed.input.startsAt);
    if (startsAt.getTime() > current.getTime()) {
      throw resourceError("WORKSTREAM_STARTS_AT_INVALID", 400);
    }
    return serializable(this.client, async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM "Project" WHERE id = ${parsed.projectId}::uuid FOR UPDATE`;
      const authorization = await authorizeProjectForWorkstreamCreation(
        transaction,
        parsed.actor,
        parsed.projectId,
        current,
      );
      if (authorization.project.status !== "active" && authorization.project.status !== "paused") {
        throw resourceError("PROJECT_STATE_INVALID", 409);
      }
      const owner = await eligibleDepartmentEmployee(
        transaction,
        parsed.input.primaryOwnerId,
        authorization.departmentScopeId,
      );
      if (owner === null) throw resourceError("WORKSTREAM_OWNER_INVALID", 400);

      const workstreamId = crypto.randomUUID();
      await transaction.authorizationScope.create({
        data: {
          id: workstreamId,
          key: `workstream:${workstreamId}`,
          scopeType: "workstream",
          departmentId: authorization.project.departmentId,
        },
      });
      const workstream = await transaction.workstream.create({
        data: {
          id: workstreamId,
          projectId: parsed.projectId,
          authorizationScopeId: workstreamId,
          authorizationScopeType: "workstream",
          name: parsed.input.name,
          description: parsed.input.description,
          status: "active",
          version: 1,
          createdById: parsed.actor.userId,
        },
      });
      await transaction.roleAssignment.create({
        data: {
          userId: owner.id,
          role: "workstream_owner",
          scopeType: "workstream",
          scopeId: workstreamId,
        },
      });
      await transaction.workstreamMember.create({
        data: {
          workstreamId,
          employeeId: owner.id,
          startsAt,
          reason: parsed.input.reason,
          createdById: parsed.actor.userId,
        },
      });
      await transaction.responsibilityWindow.create({
        data: {
          employeeId: owner.id,
          workstreamId,
          responsibilityType: "original",
          startsAt,
          reason: parsed.input.reason,
          managerDecisionById: parsed.actor.userId,
          managerDecisionAt: current,
          managerDecisionReason: parsed.input.reason,
          createdById: parsed.actor.userId,
        },
      });
      await this.auditWriter.append(transaction, {
        eventType: "workstream.created",
        actor: { kind: "human", id: parsed.actor.userId },
        effectiveSubjectId: owner.id,
        scopeType: "workstream",
        scopeId: workstreamId,
        targetType: "workstream",
        targetId: workstreamId,
        reason: parsed.input.reason,
        safeDiff: {
          projectId: parsed.projectId,
          primaryOwnerId: owner.id,
          status: "active",
          version: 1,
        },
        correlationId: parsed.correlationId,
        source: "api",
      });
      return WorkstreamSchema.parse({
        id: workstream.id,
        projectId: workstream.projectId,
        name: workstream.name,
        description: workstream.description,
        status: workstream.status,
        version: workstream.version,
        primaryOwnerId: owner.id,
      });
    });
  }

  async listWorkstreams(command: unknown): Promise<import("@evaluation/contracts").Workstream[]> {
    const parsed = ListCommandSchema.parse(command);
    const current = validClock(this.clock());
    return this.client.$transaction((transaction) =>
      loadAuthorizedWorkstreams(transaction, parsed.actor, parsed.projectId, current),
    );
  }

  async getWorkstream(command: unknown): Promise<import("@evaluation/contracts").Workstream> {
    const parsed = GetCommandSchema.parse(command);
    const current = validClock(this.clock());
    return this.client.$transaction(async (transaction) => {
      const scope = await loadWorkstreamReadScope(transaction, parsed.actor, current);
      const row = await transaction.workstream.findFirst({
        where: {
          AND: [
            { id: parsed.workstreamId, projectId: parsed.projectId },
            authorizedWorkstreamWhere(scope),
          ],
        },
        select: workstreamSelection,
      });
      if (row === null) throw authorizationError("SCOPE_MISMATCH");
      return (await serializeWorkstreams(transaction, [row], current))[0]!;
    });
  }

  async getWorkspace(
    command: unknown,
  ): Promise<import("@evaluation/contracts").WorkstreamWorkspace> {
    const parsed = GetCommandSchema.parse(command);
    const current = validClock(this.clock());
    return this.client.$transaction(async (transaction) => {
      const scope = await loadWorkstreamReadScope(transaction, parsed.actor, current);
      const row = await transaction.workstream.findFirst({
        where: {
          AND: [
            { id: parsed.workstreamId, projectId: parsed.projectId },
            authorizedWorkstreamWhere(scope),
          ],
        },
        select: workstreamSelection,
      });
      if (row === null) throw authorizationError("SCOPE_MISMATCH");
      const [workstream, people] = await Promise.all([
        serializeWorkstreams(transaction, [row], current).then(([value]) => value!),
        loadWorkspacePeople(transaction, row.id, current),
      ]);
      return WorkstreamWorkspaceSchema.parse({ workstream, people });
    });
  }

  async addContributor(command: unknown) {
    const parsed = AddContributorCommandSchema.parse(command);
    const current = validClock(this.clock());
    const startsAt = new Date(parsed.input.startsAt);
    if (startsAt.getTime() > current.getTime()) {
      throw resourceError("WORKSTREAM_STARTS_AT_INVALID", 400);
    }
    return serializable(this.client, async (transaction) => {
      const authorization = await authorizeWorkstreamManagement(
        transaction,
        parsed.actor,
        parsed.projectId,
        parsed.workstreamId,
        current,
        "workstream.participants.manage",
      );
      if (
        authorization.workstream.status === "completed" ||
        authorization.workstream.status === "archived"
      ) {
        throw resourceError("WORKSTREAM_STATE_INVALID", 409);
      }
      const contributor = await eligibleDepartmentEmployee(
        transaction,
        parsed.input.userId,
        authorization.departmentScopeId,
      );
      if (contributor === null) throw resourceError("WORKSTREAM_CONTRIBUTOR_INVALID", 400);
      const existing = await transaction.workstreamMember.findFirst({
        where: {
          workstreamId: parsed.workstreamId,
          employeeId: contributor.id,
          startsAt: { lte: startsAt },
          OR: [{ endsAt: null }, { endsAt: { gt: startsAt } }],
        },
      });
      if (existing !== null) throw resourceError("RESOURCE_STATE_INVALID", 409);

      await transaction.roleAssignment.upsert({
        where: {
          userId_role_scopeType_scopeId: {
            userId: contributor.id,
            role: "contributor",
            scopeType: "workstream",
            scopeId: parsed.workstreamId,
          },
        },
        create: {
          userId: contributor.id,
          role: "contributor",
          scopeType: "workstream",
          scopeId: parsed.workstreamId,
        },
        update: {},
      });
      const membership = await transaction.workstreamMember.create({
        data: {
          workstreamId: parsed.workstreamId,
          employeeId: contributor.id,
          startsAt,
          reason: parsed.input.reason,
          createdById: parsed.actor.userId,
        },
      });
      const managerDirected = authorization.roles.some(
        ({ role, scopeType, scopeId }) =>
          role === "manager" &&
          scopeType === "department" &&
          scopeId === authorization.departmentScopeId,
      );
      await transaction.responsibilityWindow.create({
        data: {
          employeeId: contributor.id,
          workstreamId: parsed.workstreamId,
          responsibilityType: "contributor",
          startsAt,
          reason: parsed.input.reason,
          managerDecisionById: managerDirected ? parsed.actor.userId : null,
          managerDecisionAt: managerDirected ? current : null,
          managerDecisionReason: managerDirected ? parsed.input.reason : null,
          createdById: parsed.actor.userId,
        },
      });
      await this.auditWriter.append(transaction, {
        eventType: "workstream.contributor_added",
        actor: { kind: "human", id: parsed.actor.userId },
        effectiveSubjectId: contributor.id,
        scopeType: "workstream",
        scopeId: parsed.workstreamId,
        targetType: "workstream_member",
        targetId: membership.id,
        reason: parsed.input.reason,
        safeDiff: { employeeId: contributor.id, startsAt: startsAt.toISOString() },
        correlationId: parsed.correlationId,
        source: "api",
      });
      return serializeMembership(membership);
    });
  }

  async endContributor(command: unknown) {
    const parsed = EndContributorCommandSchema.parse(command);
    const current = validClock(this.clock());
    const endsAt = new Date(parsed.input.endsAt);
    if (endsAt.getTime() > current.getTime()) {
      throw resourceError("WORKSTREAM_CONTRIBUTOR_END_INVALID", 400);
    }
    return serializable(this.client, async (transaction) => {
      await authorizeWorkstreamManagement(
        transaction,
        parsed.actor,
        parsed.projectId,
        parsed.workstreamId,
        current,
        "workstream.participants.manage",
      );
      const owner = await transaction.responsibilityWindow.findFirst({
        where: {
          workstreamId: parsed.workstreamId,
          employeeId: parsed.userId,
          responsibilityType: { in: ["original", "acting", "permanent"] },
          OR: [{ endsAt: null }, { endsAt: { gt: current } }],
        },
      });
      if (owner !== null) {
        throw resourceError("WORKSTREAM_OWNER_MEMBERSHIP_PROTECTED", 409);
      }
      const membership = await transaction.workstreamMember.findFirst({
        where: { workstreamId: parsed.workstreamId, employeeId: parsed.userId, endsAt: null },
        orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      });
      if (membership === null) throw resourceError("WORKSTREAM_CONTRIBUTOR_NOT_ACTIVE", 409);
      if (endsAt.getTime() <= membership.startsAt.getTime()) {
        throw resourceError("WORKSTREAM_CONTRIBUTOR_END_INVALID", 400);
      }
      const responsibility = await transaction.responsibilityWindow.findFirst({
        where: {
          workstreamId: parsed.workstreamId,
          employeeId: parsed.userId,
          responsibilityType: "contributor",
          endsAt: null,
        },
        orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      });
      if (responsibility === null || endsAt.getTime() <= responsibility.startsAt.getTime()) {
        throw resourceError("RESOURCE_STATE_INVALID", 409);
      }
      const versionUpdate = await transaction.workstream.updateMany({
        where: { id: parsed.workstreamId, version: parsed.input.expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (versionUpdate.count !== 1) throw resourceError("VERSION_CONFLICT", 409);
      const closed = await transaction.workstreamMember.update({
        where: { id: membership.id },
        data: { endsAt },
      });
      await transaction.responsibilityWindow.update({
        where: { id: responsibility.id },
        data: { endsAt },
      });
      await this.auditWriter.append(transaction, {
        eventType: "workstream.contributor_ended",
        actor: { kind: "human", id: parsed.actor.userId },
        effectiveSubjectId: parsed.userId,
        scopeType: "workstream",
        scopeId: parsed.workstreamId,
        targetType: "workstream_member",
        targetId: membership.id,
        reason: parsed.input.reason,
        safeDiff: { employeeId: parsed.userId, endsAt: endsAt.toISOString() },
        correlationId: parsed.correlationId,
        source: "api",
      });
      return serializeMembership(closed);
    });
  }

  async transitionWorkstream(
    command: unknown,
  ): Promise<import("@evaluation/contracts").Workstream> {
    const parsed = TransitionCommandSchema.parse(command);
    const current = validClock(this.clock());
    return serializable(this.client, async (transaction) => {
      const { workstream } = await authorizeWorkstreamManagement(
        transaction,
        parsed.actor,
        parsed.projectId,
        parsed.workstreamId,
        current,
        "workstream.stage.close",
      );
      const activeOwner = await currentWorkstreamOwner(transaction, parsed.workstreamId, current);
      assertLifecycleTransition(workstream.status, parsed.input.status, activeOwner !== null);
      const terminal = parsed.input.status === "completed" || parsed.input.status === "archived";
      if (terminal) {
        const scheduledOwnership = await transaction.responsibilityWindow.findFirst({
          where: {
            workstreamId: parsed.workstreamId,
            responsibilityType: { in: ["original", "acting", "permanent"] },
            OR: [
              { startsAt: { gt: current } },
              { responsibilityType: "acting", endsAt: { gt: current } },
            ],
          },
        });
        if (scheduledOwnership !== null) {
          throw resourceError("SCHEDULED_OWNERSHIP_REMAINS", 409);
        }
      }
      const nextVersion = workstream.version + 1;
      const updated = await transaction.workstream.updateMany({
        where: { id: parsed.workstreamId, version: parsed.input.expectedVersion },
        data: { status: parsed.input.status, version: nextVersion },
      });
      if (updated.count !== 1) throw resourceError("VERSION_CONFLICT", 409);
      if (terminal) {
        await transaction.workstreamMember.updateMany({
          where: { workstreamId: parsed.workstreamId, startsAt: { lte: current }, endsAt: null },
          data: { endsAt: current },
        });
        await transaction.responsibilityWindow.updateMany({
          where: { workstreamId: parsed.workstreamId, startsAt: { lte: current }, endsAt: null },
          data: { endsAt: current },
        });
      }
      await transaction.workstreamStatusTransition.create({
        data: {
          workstreamId: parsed.workstreamId,
          fromStatus: workstream.status,
          toStatus: parsed.input.status,
          effectiveAt: current,
          actorId: parsed.actor.userId,
          reason: parsed.input.reason,
          resultingVersion: nextVersion,
        },
      });
      await this.auditWriter.append(transaction, {
        eventType: "workstream.status_changed",
        actor: { kind: "human", id: parsed.actor.userId },
        effectiveSubjectId: parsed.actor.userId,
        scopeType: "workstream",
        scopeId: parsed.workstreamId,
        targetType: "workstream",
        targetId: parsed.workstreamId,
        reason: parsed.input.reason,
        safeDiff: {
          previousStatus: workstream.status,
          nextStatus: parsed.input.status,
          effectiveAt: current.toISOString(),
          version: nextVersion,
        },
        correlationId: parsed.correlationId,
        source: "api",
      });
      return WorkstreamSchema.parse({
        id: workstream.id,
        projectId: workstream.projectId,
        name: workstream.name,
        description: workstream.description,
        status: parsed.input.status,
        version: nextVersion,
        primaryOwnerId: terminal ? null : (activeOwner?.employeeId ?? null),
      });
    });
  }
}

export function createWorkstreamService(
  client: DatabaseClient,
  writer: AuditWriter = databaseAuditWriter as AuditWriter,
  clock: () => Date = () => new Date(),
): WorkstreamService {
  return new WorkstreamService(client, writer, clock);
}

async function authorizeProjectForWorkstreamCreation(
  transaction: Transaction,
  actor: Readonly<{ userId: string; active: boolean }>,
  projectId: string,
  now: Date,
) {
  const user = await transaction.user.findUnique({
    where: { id: actor.userId },
    select: { active: true },
  });
  const project = await transaction.project.findUnique({
    where: { id: projectId },
    select: { id: true, departmentId: true, status: true },
  });
  const roles = await transaction.roleAssignment.findMany({
    where: { userId: actor.userId },
    select: { role: true, scopeType: true, scopeId: true },
  });
  const windows = await transaction.responsibilityWindow.findMany({
    where: { employeeId: actor.userId, projectId },
    select: { responsibilityType: true, startsAt: true, endsAt: true },
  });
  if (user === null || !user.active || !actor.active) throw authorizationError("INACTIVE");
  if (project === null) throw resourceError("PROJECT_NOT_FOUND", 404);
  const departmentScopeId = await departmentScopeFor(transaction, project.departmentId);
  const decision = decide(
    { subjectId: actor.userId, active: user.active, roles },
    "workstream.create",
    { kind: "project", projectId, departmentId: departmentScopeId },
    {
      now: now.toISOString(),
      responsibilityWindows: windows.map((window) => ({
        subjectId: actor.userId,
        scopeType: "project" as const,
        scopeId: projectId,
        responsibilityType: window.responsibilityType,
        startsAt: window.startsAt.toISOString(),
        endsAt: window.endsAt?.toISOString() ?? null,
      })),
    },
  );
  if (!decision.allowed) throw authorizationError(decision.reasonCode);
  return { project, roles, departmentScopeId };
}

async function authorizeWorkstreamManagement(
  transaction: Transaction,
  actor: Readonly<{ userId: string; active: boolean }>,
  projectId: string,
  workstreamId: string,
  now: Date,
  action: "workstream.participants.manage" | "workstream.stage.close",
) {
  const user = await transaction.user.findUnique({
    where: { id: actor.userId },
    select: { active: true },
  });
  const workstream = await transaction.workstream.findFirst({
    where: { id: workstreamId, projectId },
    select: {
      id: true,
      projectId: true,
      status: true,
      version: true,
      name: true,
      description: true,
      project: { select: { departmentId: true } },
    },
  });
  const roles = await transaction.roleAssignment.findMany({
    where: { userId: actor.userId },
    select: { role: true, scopeType: true, scopeId: true },
  });
  const [windows, actingAuthorities] = await Promise.all([
    transaction.responsibilityWindow.findMany({
      where: { employeeId: actor.userId, workstreamId },
      select: { responsibilityType: true, startsAt: true, endsAt: true },
    }),
    loadWorkstreamActingAuthorities(transaction, actor.userId, projectId, workstreamId),
  ]);
  if (user === null || !user.active || !actor.active) throw authorizationError("INACTIVE");
  if (workstream === null) throw resourceError("WORKSTREAM_NOT_FOUND", 404);
  const departmentScopeId = await departmentScopeFor(transaction, workstream.project.departmentId);
  const decision = decide(
    { subjectId: actor.userId, active: user.active, roles },
    action,
    { kind: "workstream", workstreamId, projectId, departmentId: departmentScopeId },
    {
      now: now.toISOString(),
      responsibilityWindows: windows.map((window) => ({
        subjectId: actor.userId,
        scopeType: "workstream" as const,
        scopeId: workstreamId,
        projectId,
        responsibilityType: window.responsibilityType,
        startsAt: window.startsAt.toISOString(),
        endsAt: window.endsAt?.toISOString() ?? null,
      })),
      actingAuthorities,
    },
  );
  if (!decision.allowed) throw authorizationError(decision.reasonCode);
  return { workstream, roles, departmentScopeId };
}

async function loadWorkstreamActingAuthorities(
  transaction: Transaction,
  actorId: string,
  projectId: string,
  workstreamId: string,
) {
  const rows = await transaction.delegationScope.findMany({
    where: {
      workstreamId,
      responsibilityWindowId: { not: null },
      delegation: { delegateId: actorId, state: "ACTIVE" },
    },
    include: {
      delegation: { include: { periods: { orderBy: [{ startsAt: "asc" }, { id: "asc" }] } } },
      responsibilityWindow: { select: { startsAt: true, endsAt: true } },
    },
  });
  return rows.flatMap((row) => {
    const period = row.delegation.periods[0];
    const lastPeriod = row.delegation.periods.at(-1);
    const window = row.responsibilityWindow;
    if (!period || !lastPeriod || !window?.endsAt) return [];
    return [
      {
        delegationId: row.delegationId,
        subjectId: actorId,
        scopeType: "workstream" as const,
        scopeId: workstreamId,
        projectId,
        action: row.action,
        startsAt: (period.startsAt > window.startsAt
          ? period.startsAt
          : window.startsAt
        ).toISOString(),
        endsAt: lastPeriod.endsAt.toISOString(),
      },
    ];
  });
}

async function eligibleDepartmentEmployee(
  transaction: Transaction,
  userId: string,
  departmentScopeId: string,
) {
  return transaction.user.findFirst({
    where: {
      id: userId,
      active: true,
      roleAssignments: {
        some: { role: "employee", scopeType: "department", scopeId: departmentScopeId },
      },
    },
    select: { id: true },
  });
}

async function departmentScopeFor(transaction: Transaction, departmentId: string) {
  const scope = await transaction.authorizationScope.findFirst({
    where: { departmentId, scopeType: "department" },
    select: { id: true },
  });
  if (scope === null) throw resourceError("WORKSTREAM_SCOPE_INVALID", 500);
  return scope.id;
}

async function currentWorkstreamOwner(transaction: Transaction, workstreamId: string, at: Date) {
  return transaction.responsibilityWindow.findFirst({
    where: {
      workstreamId,
      responsibilityType: { in: ["original", "acting", "permanent"] },
      startsAt: { lte: at },
      OR: [{ endsAt: null }, { endsAt: { gt: at } }],
    },
    orderBy: [{ startsAt: "desc" }, { id: "desc" }],
    select: { employeeId: true },
  });
}

type WorkstreamReadScope = Readonly<{
  departmentIds: readonly string[];
  projectIds: readonly string[];
  workstreamIds: readonly string[];
}>;

async function loadWorkstreamReadScope(
  transaction: Transaction,
  actor: Readonly<{ userId: string; active: boolean }>,
  now: Date,
): Promise<WorkstreamReadScope> {
  const user = await transaction.user.findUnique({
    where: { id: actor.userId },
    select: { active: true },
  });
  if (user === null || !user.active || !actor.active) throw authorizationError("INACTIVE");
  const managerAssignments = await transaction.roleAssignment.findMany({
    where: { userId: actor.userId, role: "manager", scopeType: "department" },
    select: { scopeId: true },
  });
  const departmentScopes = await transaction.authorizationScope.findMany({
    where: {
      id: { in: managerAssignments.map(({ scopeId }) => scopeId) },
      scopeType: "department",
      departmentId: { not: null },
    },
    select: { departmentId: true },
  });
  const projectResponsibilities = await transaction.responsibilityWindow.findMany({
    where: {
      employeeId: actor.userId,
      projectId: { not: null },
      responsibilityType: { in: ["original", "acting", "permanent"] },
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    select: { projectId: true },
  });
  const workstreamResponsibilities = await transaction.responsibilityWindow.findMany({
    where: {
      employeeId: actor.userId,
      workstreamId: { not: null },
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    select: { workstreamId: true },
  });
  return {
    departmentIds: departmentScopes.flatMap(({ departmentId }) =>
      departmentId === null ? [] : [departmentId],
    ),
    projectIds: projectResponsibilities.flatMap(({ projectId }) =>
      projectId === null ? [] : [projectId],
    ),
    workstreamIds: workstreamResponsibilities.flatMap(({ workstreamId }) =>
      workstreamId === null ? [] : [workstreamId],
    ),
  };
}

export async function loadAuthorizedWorkstreams(
  transaction: Transaction,
  actor: Readonly<{ userId: string; active: boolean }>,
  projectId: string,
  current: Date,
): Promise<import("@evaluation/contracts").Workstream[]> {
  const scope = await loadWorkstreamReadScope(transaction, actor, current);
  const rows = await transaction.workstream.findMany({
    where: { AND: [{ projectId }, authorizedWorkstreamWhere(scope)] },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: workstreamSelection,
  });
  return serializeWorkstreams(transaction, rows, current);
}

function authorizedWorkstreamWhere(scope: WorkstreamReadScope) {
  if (
    scope.departmentIds.length === 0 &&
    scope.projectIds.length === 0 &&
    scope.workstreamIds.length === 0
  ) {
    return { id: { in: [] as string[] } };
  }
  return {
    OR: [
      { project: { departmentId: { in: [...scope.departmentIds] } } },
      { projectId: { in: [...scope.projectIds] } },
      { id: { in: [...scope.workstreamIds] } },
    ],
  };
}

const workstreamSelection = {
  id: true,
  projectId: true,
  name: true,
  description: true,
  status: true,
  version: true,
} as const;

type WorkstreamRow = Readonly<{
  id: string;
  projectId: string;
  name: string;
  description: string;
  status: import("@evaluation/contracts").WorkstreamStatus;
  version: number;
}>;

async function serializeWorkstreams(
  transaction: Transaction,
  rows: readonly WorkstreamRow[],
  at: Date,
): Promise<import("@evaluation/contracts").Workstream[]> {
  const owners = await transaction.responsibilityWindow.findMany({
    where: {
      workstreamId: { in: rows.map(({ id }) => id) },
      responsibilityType: { in: ["original", "acting", "permanent"] },
      startsAt: { lte: at },
      OR: [{ endsAt: null }, { endsAt: { gt: at } }],
    },
    select: { workstreamId: true, employeeId: true },
  });
  const ownerByWorkstream = new Map(
    owners.flatMap(({ workstreamId, employeeId }) =>
      workstreamId === null ? [] : ([[workstreamId, employeeId]] as const),
    ),
  );
  return rows.map((row) =>
    WorkstreamSchema.parse({
      ...row,
      primaryOwnerId: ownerByWorkstream.get(row.id) ?? null,
    }),
  );
}

async function loadWorkspacePeople(
  transaction: Transaction,
  workstreamId: string,
  at: Date,
): Promise<import("@evaluation/contracts").WorkspacePersonPeriod[]> {
  const rows = await transaction.responsibilityWindow.findMany({
    where: {
      workstreamId,
      startsAt: { lte: at },
      OR: [{ endsAt: null }, { endsAt: { gt: at } }],
    },
    select: {
      responsibilityType: true,
      startsAt: true,
      endsAt: true,
      employee: { select: { id: true, displayName: true } },
    },
  });
  const order = { original: 0, acting: 0, permanent: 0, contributor: 1 } as const;
  return rows
    .sort(
      (left, right) =>
        order[left.responsibilityType] - order[right.responsibilityType] ||
        left.employee.displayName.localeCompare(right.employee.displayName) ||
        left.employee.id.localeCompare(right.employee.id),
    )
    .map((row) => ({
      person: row.employee,
      responsibilityType: row.responsibilityType,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt?.toISOString() ?? null,
    }));
}

function serializeMembership(member: {
  id: string;
  employeeId: string;
  startsAt: Date;
  endsAt: Date | null;
}) {
  return {
    id: member.id,
    employeeId: member.employeeId,
    startsAt: member.startsAt.toISOString(),
    endsAt: member.endsAt?.toISOString() ?? null,
  };
}

function validClock(value: Date): Date {
  if (!Number.isFinite(value.getTime())) throw resourceError("WORKSTREAM_CLOCK_INVALID", 500);
  return value;
}

function authorizationError(reason: import("@evaluation/permissions").DenialReason): AppError {
  return new AppError(`AUTHZ_${reason}`, "errors.authorization.denied", 403);
}

function resourceError(code: string, status: number): AppError {
  return new AppError(code, `errors.workstreams.${code.toLowerCase()}`, status);
}

async function serializable<T>(
  client: DatabaseClient,
  operation: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  try {
    return await client.$transaction(operation, { isolationLevel: "Serializable" });
  } catch (error) {
    if (hasErrorCode(error, "P2034")) throw resourceError("VERSION_CONFLICT", 409);
    throw error;
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
