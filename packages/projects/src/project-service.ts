import { databaseAuditWriter } from "@evaluation/audit";
import {
  AddMemberSchema,
  AppError,
  CreateProjectSchema,
  EndMembershipSchema,
  ProjectSchema,
  UpdateStatusSchema,
} from "@evaluation/contracts";
import { decide } from "@evaluation/permissions";
import { z } from "zod";

import { assertLifecycleTransition } from "./invariants.js";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type Transaction = import("@evaluation/database").DatabaseTransaction;
type AuditWriter = import("@evaluation/contracts").AuditWriter<Transaction>;

const CommandSchema = z
  .object({
    actor: z.object({ userId: z.string().uuid(), active: z.boolean() }).strict(),
    correlationId: z.string().uuid(),
    input: CreateProjectSchema,
  })
  .strict();

const ProjectCommandBase = z.object({
  actor: z.object({ userId: z.string().uuid(), active: z.boolean() }).strict(),
  correlationId: z.string().uuid(),
  projectId: z.string().uuid(),
});

const AddMemberCommandSchema = ProjectCommandBase.extend({ input: AddMemberSchema }).strict();
const EndMemberCommandSchema = ProjectCommandBase.extend({
  userId: z.string().uuid(),
  input: EndMembershipSchema,
}).strict();
const TransitionProjectCommandSchema = ProjectCommandBase.extend({
  input: UpdateStatusSchema,
}).strict();
const ListProjectsCommandSchema = z
  .object({ actor: z.object({ userId: z.string().uuid(), active: z.boolean() }).strict() })
  .strict();
const GetProjectCommandSchema = ListProjectsCommandSchema.extend({
  projectId: z.string().uuid(),
}).strict();

export class ProjectService {
  private readonly client: DatabaseClient;
  private readonly auditWriter: AuditWriter;
  private readonly clock: () => Date;

  constructor(client: DatabaseClient, auditWriter: AuditWriter, clock: () => Date) {
    this.client = client;
    this.auditWriter = auditWriter;
    this.clock = clock;
  }

  async createProject(command: unknown): Promise<import("@evaluation/contracts").Project> {
    const parsed = CommandSchema.parse(command);
    const effectiveAt = this.clock();
    if (!Number.isFinite(effectiveAt.getTime())) {
      throw new AppError("PROJECT_CLOCK_INVALID", "errors.projects.clockInvalid", 500);
    }
    const startsAt = new Date(parsed.input.startsAt);
    if (startsAt.getTime() > effectiveAt.getTime()) {
      throw new AppError("PROJECT_STARTS_AT_INVALID", "errors.projects.startsAtInvalid", 400);
    }

    return serializable(
      this.client,
      async (transaction) => {
        const { department, departmentScope } = await authorizeProjectCreation(
          transaction,
          parsed.actor,
          parsed.input.departmentId,
          effectiveAt,
        );
        const owner = await transaction.user.findFirst({
          where: {
            id: parsed.input.primaryOwnerId,
            active: true,
            roleAssignments: {
              some: {
                role: "employee",
                scopeType: "department",
                scopeId: departmentScope.id,
              },
            },
          },
          select: { id: true },
        });
        if (owner === null) {
          throw new AppError("PROJECT_OWNER_INVALID", "errors.projects.ownerInvalid", 400);
        }

        const projectId = crypto.randomUUID();
        await transaction.authorizationScope.create({
          data: {
            id: projectId,
            key: `project:${projectId}`,
            scopeType: "project",
            departmentId: department.id,
          },
        });
        const project = await transaction.project.create({
          data: {
            id: projectId,
            organizationId: department.organizationId,
            departmentId: department.id,
            authorizationScopeId: projectId,
            authorizationScopeType: "project",
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
            role: "project_owner",
            scopeType: "project",
            scopeId: projectId,
          },
        });
        await transaction.projectMember.create({
          data: {
            projectId,
            employeeId: owner.id,
            startsAt,
            reason: parsed.input.reason,
            createdById: parsed.actor.userId,
          },
        });
        await transaction.responsibilityWindow.create({
          data: {
            employeeId: owner.id,
            projectId,
            responsibilityType: "original",
            startsAt,
            reason: parsed.input.reason,
            managerDecisionById: parsed.actor.userId,
            managerDecisionAt: effectiveAt,
            managerDecisionReason: parsed.input.reason,
            createdById: parsed.actor.userId,
          },
        });
        await this.auditWriter.append(transaction, {
          eventType: "project.created",
          actor: { kind: "human", id: parsed.actor.userId },
          effectiveSubjectId: owner.id,
          scopeType: "project",
          scopeId: projectId,
          targetType: "project",
          targetId: projectId,
          reason: parsed.input.reason,
          safeDiff: {
            departmentId: department.id,
            primaryOwnerId: owner.id,
            status: "active",
            version: 1,
          },
          correlationId: parsed.correlationId,
          source: "api",
        });

        return ProjectSchema.parse({
          id: project.id,
          departmentId: project.departmentId,
          name: project.name,
          description: project.description,
          status: project.status,
          version: project.version,
          primaryOwnerId: owner.id,
        });
      },
      { isolationLevel: "Serializable" },
    );
  }

  async listProjects(command: unknown): Promise<import("@evaluation/contracts").Project[]> {
    const parsed = ListProjectsCommandSchema.parse(command);
    const current = validClock(this.clock());
    return this.client.$transaction(async (transaction) => {
      const scope = await loadProjectReadScope(transaction, parsed.actor, current);
      const rows = await transaction.project.findMany({
        where: authorizedProjectWhere(scope),
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: projectSelection,
      });
      return serializeProjects(transaction, rows, current);
    });
  }

  async getProject(command: unknown): Promise<import("@evaluation/contracts").Project> {
    const parsed = GetProjectCommandSchema.parse(command);
    const current = validClock(this.clock());
    return this.client.$transaction(async (transaction) => {
      const scope = await loadProjectReadScope(transaction, parsed.actor, current);
      const row = await transaction.project.findFirst({
        where: { AND: [{ id: parsed.projectId }, authorizedProjectWhere(scope)] },
        select: projectSelection,
      });
      if (row === null) throw authorizationError("SCOPE_MISMATCH");
      return (await serializeProjects(transaction, [row], current))[0]!;
    });
  }

  async addProjectMember(command: unknown) {
    const parsed = AddMemberCommandSchema.parse(command);
    const current = validClock(this.clock());
    const startsAt = new Date(parsed.input.startsAt);
    if (startsAt.getTime() > current.getTime()) {
      throw resourceError("PROJECT_STARTS_AT_INVALID", 400);
    }

    return serializable(
      this.client,
      async (transaction) => {
        const authorization = await authorizeProjectManagement(
          transaction,
          parsed.actor,
          parsed.projectId,
          current,
        );
        if (
          authorization.project.status === "completed" ||
          authorization.project.status === "archived"
        ) {
          throw resourceError("PROJECT_STATE_INVALID", 409);
        }
        const member = await transaction.user.findFirst({
          where: {
            id: parsed.input.userId,
            active: true,
            roleAssignments: {
              some: {
                role: "employee",
                scopeType: "department",
                scopeId: authorization.departmentScopeId,
              },
            },
          },
          select: { id: true },
        });
        if (member === null) throw resourceError("PROJECT_MEMBER_INVALID", 400);
        const existing = await transaction.projectMember.findFirst({
          where: {
            projectId: parsed.projectId,
            employeeId: member.id,
            startsAt: { lte: startsAt },
            OR: [{ endsAt: null }, { endsAt: { gt: startsAt } }],
          },
        });
        if (existing !== null) throw resourceError("PROJECT_MEMBER_ACTIVE", 409);

        await transaction.roleAssignment.upsert({
          where: {
            userId_role_scopeType_scopeId: {
              userId: member.id,
              role: "contributor",
              scopeType: "project",
              scopeId: parsed.projectId,
            },
          },
          create: {
            userId: member.id,
            role: "contributor",
            scopeType: "project",
            scopeId: parsed.projectId,
          },
          update: {},
        });
        const membership = await transaction.projectMember.create({
          data: {
            projectId: parsed.projectId,
            employeeId: member.id,
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
            employeeId: member.id,
            projectId: parsed.projectId,
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
          eventType: "project.member_added",
          actor: { kind: "human", id: parsed.actor.userId },
          effectiveSubjectId: member.id,
          scopeType: "project",
          scopeId: parsed.projectId,
          targetType: "project_member",
          targetId: membership.id,
          reason: parsed.input.reason,
          safeDiff: { employeeId: member.id, startsAt: startsAt.toISOString() },
          correlationId: parsed.correlationId,
          source: "api",
        });
        return serializeMembership(membership);
      },
      { isolationLevel: "Serializable" },
    );
  }

  async endProjectMember(command: unknown) {
    const parsed = EndMemberCommandSchema.parse(command);
    const current = validClock(this.clock());
    const endsAt = new Date(parsed.input.endsAt);
    if (endsAt.getTime() > current.getTime())
      throw resourceError("PROJECT_MEMBER_END_INVALID", 400);

    return serializable(
      this.client,
      async (transaction) => {
        await authorizeProjectManagement(transaction, parsed.actor, parsed.projectId, current);
        const owner = await transaction.responsibilityWindow.findFirst({
          where: {
            projectId: parsed.projectId,
            employeeId: parsed.userId,
            responsibilityType: { in: ["original", "acting", "permanent"] },
            OR: [{ endsAt: null }, { endsAt: { gt: current } }],
          },
        });
        if (owner !== null) throw resourceError("PROJECT_OWNER_MEMBERSHIP_PROTECTED", 409);
        const membership = await transaction.projectMember.findFirst({
          where: {
            projectId: parsed.projectId,
            employeeId: parsed.userId,
            endsAt: null,
          },
          orderBy: [{ startsAt: "desc" }, { id: "desc" }],
        });
        if (membership === null) throw resourceError("PROJECT_MEMBER_NOT_ACTIVE", 409);
        if (endsAt.getTime() <= membership.startsAt.getTime()) {
          throw resourceError("PROJECT_MEMBER_END_INVALID", 400);
        }
        const contributor = await transaction.responsibilityWindow.findFirst({
          where: {
            projectId: parsed.projectId,
            employeeId: parsed.userId,
            responsibilityType: "contributor",
            endsAt: null,
          },
          orderBy: [{ startsAt: "desc" }, { id: "desc" }],
        });
        if (contributor === null || endsAt.getTime() <= contributor.startsAt.getTime()) {
          throw resourceError("PROJECT_MEMBER_STATE_INVALID", 409);
        }
        const versionUpdate = await transaction.project.updateMany({
          where: { id: parsed.projectId, version: parsed.input.expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (versionUpdate.count !== 1) throw resourceError("VERSION_CONFLICT", 409);
        const closed = await transaction.projectMember.update({
          where: { id: membership.id },
          data: { endsAt },
        });
        await transaction.responsibilityWindow.update({
          where: { id: contributor.id },
          data: { endsAt },
        });
        await this.auditWriter.append(transaction, {
          eventType: "project.member_ended",
          actor: { kind: "human", id: parsed.actor.userId },
          effectiveSubjectId: parsed.userId,
          scopeType: "project",
          scopeId: parsed.projectId,
          targetType: "project_member",
          targetId: membership.id,
          reason: parsed.input.reason,
          safeDiff: { employeeId: parsed.userId, endsAt: endsAt.toISOString() },
          correlationId: parsed.correlationId,
          source: "api",
        });
        return serializeMembership(closed);
      },
      { isolationLevel: "Serializable" },
    );
  }

  async transitionProject(command: unknown): Promise<import("@evaluation/contracts").Project> {
    const parsed = TransitionProjectCommandSchema.parse(command);
    const current = validClock(this.clock());
    return serializable(
      this.client,
      async (transaction) => {
        const { project } = await authorizeProjectManagement(
          transaction,
          parsed.actor,
          parsed.projectId,
          current,
        );
        const activeOwner = await currentProjectOwner(transaction, parsed.projectId, current);
        assertLifecycleTransition(project.status, parsed.input.status, activeOwner !== null);
        const terminal = parsed.input.status === "completed" || parsed.input.status === "archived";
        if (terminal) {
          const activeWorkstreams = await transaction.workstream.count({
            where: { projectId: parsed.projectId, status: { notIn: ["completed", "archived"] } },
          });
          if (activeWorkstreams > 0) throw resourceError("ACTIVE_WORKSTREAMS_REMAIN", 409);
          const scheduledOwnership = await transaction.responsibilityWindow.findFirst({
            where: {
              projectId: parsed.projectId,
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

        const nextVersion = project.version + 1;
        const updated = await transaction.project.updateMany({
          where: { id: parsed.projectId, version: parsed.input.expectedVersion },
          data: { status: parsed.input.status, version: nextVersion },
        });
        if (updated.count !== 1) throw resourceError("VERSION_CONFLICT", 409);
        if (terminal) {
          await transaction.projectMember.updateMany({
            where: { projectId: parsed.projectId, startsAt: { lte: current }, endsAt: null },
            data: { endsAt: current },
          });
          await transaction.responsibilityWindow.updateMany({
            where: { projectId: parsed.projectId, startsAt: { lte: current }, endsAt: null },
            data: { endsAt: current },
          });
        }
        await transaction.projectStatusTransition.create({
          data: {
            projectId: parsed.projectId,
            fromStatus: project.status,
            toStatus: parsed.input.status,
            effectiveAt: current,
            actorId: parsed.actor.userId,
            reason: parsed.input.reason,
            resultingVersion: nextVersion,
          },
        });
        await this.auditWriter.append(transaction, {
          eventType: "project.status_changed",
          actor: { kind: "human", id: parsed.actor.userId },
          effectiveSubjectId: parsed.actor.userId,
          scopeType: "project",
          scopeId: parsed.projectId,
          targetType: "project",
          targetId: parsed.projectId,
          reason: parsed.input.reason,
          safeDiff: {
            previousStatus: project.status,
            nextStatus: parsed.input.status,
            effectiveAt: current.toISOString(),
            version: nextVersion,
          },
          correlationId: parsed.correlationId,
          source: "api",
        });
        return ProjectSchema.parse({
          id: project.id,
          departmentId: project.departmentId,
          name: project.name,
          description: project.description,
          status: parsed.input.status,
          version: nextVersion,
          primaryOwnerId: terminal ? null : (activeOwner?.employeeId ?? null),
        });
      },
      { isolationLevel: "Serializable" },
    );
  }
}

export function createProjectService(
  client: DatabaseClient,
  writer: AuditWriter = databaseAuditWriter as AuditWriter,
  clock: () => Date = () => new Date(),
): ProjectService {
  return new ProjectService(client, writer, clock);
}

async function authorizeProjectCreation(
  transaction: Transaction,
  actor: Readonly<{ userId: string; active: boolean }>,
  departmentId: string,
  now: Date,
) {
  const user = await transaction.user.findUnique({
    where: { id: actor.userId },
    select: { active: true },
  });
  const department = await transaction.department.findUnique({
    where: { id: departmentId },
    select: { id: true, organizationId: true },
  });
  const departmentScope = await transaction.authorizationScope.findFirst({
    where: { departmentId, scopeType: "department" },
    select: { id: true },
  });
  const actorRoles = await transaction.roleAssignment.findMany({
    where: { userId: actor.userId },
    select: { role: true, scopeType: true, scopeId: true },
  });
  if (user === null || !user.active || !actor.active) throw authorizationError("INACTIVE");
  if (department === null || departmentScope === null) {
    throw new AppError("PROJECT_DEPARTMENT_NOT_FOUND", "errors.projects.departmentNotFound", 404);
  }
  const decision = decide(
    { subjectId: actor.userId, active: user.active, roles: actorRoles },
    "project.create",
    { kind: "department", departmentId: departmentScope.id },
    { now: now.toISOString() },
  );
  if (!decision.allowed) throw authorizationError(decision.reasonCode);
  return { department, departmentScope };
}

function authorizationError(reason: import("@evaluation/permissions").DenialReason): AppError {
  return new AppError(`AUTHZ_${reason}`, "errors.authorization.denied", 403);
}

async function authorizeProjectManagement(
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
    select: {
      id: true,
      departmentId: true,
      status: true,
      version: true,
      name: true,
      description: true,
    },
  });
  const roles = await transaction.roleAssignment.findMany({
    where: { userId: actor.userId },
    select: { role: true, scopeType: true, scopeId: true },
  });
  const windows = await transaction.responsibilityWindow.findMany({
    where: { employeeId: actor.userId, projectId },
    select: {
      responsibilityType: true,
      startsAt: true,
      endsAt: true,
    },
  });
  if (user === null || !user.active || !actor.active) throw authorizationError("INACTIVE");
  if (project === null) throw resourceError("PROJECT_NOT_FOUND", 404);
  const departmentScope = await transaction.authorizationScope.findFirst({
    where: { departmentId: project.departmentId, scopeType: "department" },
    select: { id: true },
  });
  if (departmentScope === null) throw resourceError("PROJECT_SCOPE_INVALID", 500);
  const decision = decide(
    { subjectId: actor.userId, active: user.active, roles },
    "project.manage",
    { kind: "project", projectId, departmentId: departmentScope.id },
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
  return { project, roles, departmentScopeId: departmentScope.id };
}

async function currentProjectOwner(transaction: Transaction, projectId: string, at: Date) {
  return transaction.responsibilityWindow.findFirst({
    where: {
      projectId,
      responsibilityType: { in: ["original", "acting", "permanent"] },
      startsAt: { lte: at },
      OR: [{ endsAt: null }, { endsAt: { gt: at } }],
    },
    orderBy: [{ startsAt: "desc" }, { id: "desc" }],
    select: { employeeId: true },
  });
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
  if (!Number.isFinite(value.getTime())) throw resourceError("PROJECT_CLOCK_INVALID", 500);
  return value;
}

function resourceError(code: string, status: number): AppError {
  return new AppError(code, `errors.projects.${code.toLowerCase()}`, status);
}

async function serializable<T>(
  client: DatabaseClient,
  operation: (transaction: Transaction) => Promise<T>,
  _options?: Readonly<{ isolationLevel: "Serializable" }>,
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

const projectSelection = {
  id: true,
  departmentId: true,
  name: true,
  description: true,
  status: true,
  version: true,
} as const;

type ProjectRow = Readonly<{
  id: string;
  departmentId: string;
  name: string;
  description: string;
  status: import("@evaluation/contracts").ProjectStatus;
  version: number;
}>;

type ProjectReadScope = Readonly<{
  departmentIds: readonly string[];
  projectIds: readonly string[];
}>;

async function loadProjectReadScope(
  transaction: Transaction,
  actor: Readonly<{ userId: string; active: boolean }>,
  now: Date,
): Promise<ProjectReadScope> {
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
  const responsibilities = await transaction.responsibilityWindow.findMany({
    where: {
      employeeId: actor.userId,
      projectId: { not: null },
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    select: { projectId: true },
  });
  return {
    departmentIds: departmentScopes.flatMap(({ departmentId }) =>
      departmentId === null ? [] : [departmentId],
    ),
    projectIds: responsibilities.flatMap(({ projectId }) =>
      projectId === null ? [] : [projectId],
    ),
  };
}

function authorizedProjectWhere(scope: ProjectReadScope) {
  if (scope.departmentIds.length === 0 && scope.projectIds.length === 0) {
    return { id: { in: [] as string[] } };
  }
  return {
    OR: [{ departmentId: { in: [...scope.departmentIds] } }, { id: { in: [...scope.projectIds] } }],
  };
}

async function serializeProjects(
  transaction: Transaction,
  rows: readonly ProjectRow[],
  at: Date,
): Promise<import("@evaluation/contracts").Project[]> {
  const owners = await transaction.responsibilityWindow.findMany({
    where: {
      projectId: { in: rows.map(({ id }) => id) },
      responsibilityType: { in: ["original", "acting", "permanent"] },
      startsAt: { lte: at },
      OR: [{ endsAt: null }, { endsAt: { gt: at } }],
    },
    select: { projectId: true, employeeId: true },
  });
  const ownerByProject = new Map(
    owners.flatMap(({ projectId, employeeId }) =>
      projectId === null ? [] : ([[projectId, employeeId]] as const),
    ),
  );
  return rows.map((row) =>
    ProjectSchema.parse({
      ...row,
      primaryOwnerId: ownerByProject.get(row.id) ?? null,
    }),
  );
}
