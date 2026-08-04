import { AppError } from "@evaluation/contracts";
import { decide } from "@evaluation/permissions";
import { Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { z } from "zod";

export const PROJECTS_POLICY_DATABASE = Symbol("PROJECTS_POLICY_DATABASE");
export const PROJECT_POLICY_ACTION = Symbol("PROJECT_POLICY_ACTION");

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type ProjectPolicyAction =
  | "project.create"
  | "project.manage"
  | "workstream.create"
  | "workstream.manage"
  | "responsibility.transfer"
  | "resource.read";

type ProjectPolicyRequest = Readonly<{
  principal?: import("@evaluation/auth").AuthenticatedPrincipal;
  body?: Record<string, unknown>;
  params?: Record<string, unknown>;
}>;

export class ProjectPolicyGuard {
  private readonly reflector: Reflector;
  private readonly database: DatabaseClient;

  constructor(reflector: Reflector, database: DatabaseClient) {
    this.reflector = reflector;
    this.database = database;
  }

  async canActivate(context: import("@nestjs/common").ExecutionContext): Promise<boolean> {
    const action = this.reflector.get<ProjectPolicyAction | undefined>(
      PROJECT_POLICY_ACTION,
      context.getHandler(),
    );
    if (action === undefined) throw authorizationError("ROLE_REQUIRED");
    const request = context.switchToHttp().getRequest<ProjectPolicyRequest>();
    const principal = request.principal;
    if (principal === undefined) throw authorizationError("UNAUTHENTICATED");
    if (!principal.active) throw authorizationError("INACTIVE");

    const departmentId =
      action === "project.create" ? parseResourceId(request.body?.departmentId) : null;
    const projectId =
      action === "project.create" ? null : parseResourceId(request.params?.projectId);
    const workstreamId =
      request.params?.workstreamId === undefined
        ? null
        : parseResourceId(request.params.workstreamId);

    const roles = await this.database.roleAssignment.findMany({
      where: { userId: principal.userId },
      select: { role: true, scopeType: true, scopeId: true },
    });
    if (action === "project.create") {
      const scope = await this.database.authorizationScope.findFirst({
        where: { departmentId: departmentId!, scopeType: "department" },
        select: { id: true },
      });
      if (scope === null) throw authorizationError("RESOURCE_STATE");
      enforce(
        decide(
          { subjectId: principal.userId, active: principal.active, roles },
          action,
          { kind: "department", departmentId: scope.id },
          { now: new Date().toISOString() },
        ),
      );
      return true;
    }

    if (workstreamId !== null && action !== "workstream.create") {
      return this.authorizeWorkstream(action, principal, roles, projectId!, workstreamId);
    }
    const project = await this.database.project.findUnique({
      where: { id: projectId! },
      select: { departmentId: true },
    });
    if (project === null) throw authorizationError("SCOPE_MISMATCH");
    const scope = await this.database.authorizationScope.findFirst({
      where: { departmentId: project.departmentId, scopeType: "department" },
      select: { id: true },
    });
    if (scope === null) throw authorizationError("RESOURCE_STATE");
    const windows = await this.database.responsibilityWindow.findMany({
      where: {
        employeeId: principal.userId,
        OR: [{ projectId: projectId! }, { workstream: { projectId: projectId! } }],
      },
      select: {
        projectId: true,
        workstreamId: true,
        workstream: { select: { projectId: true } },
        responsibilityType: true,
        startsAt: true,
        endsAt: true,
      },
    });
    enforce(
      decide(
        { subjectId: principal.userId, active: principal.active, roles },
        action,
        { kind: "project", projectId: projectId!, departmentId: scope.id },
        {
          now: new Date().toISOString(),
          responsibilityWindows: windows.map((window) => {
            const period = {
              subjectId: principal.userId,
              responsibilityType: window.responsibilityType,
              startsAt: window.startsAt.toISOString(),
              endsAt: window.endsAt?.toISOString() ?? null,
            };
            if (typeof window.workstreamId === "string") {
              return {
                ...period,
                scopeType: "workstream" as const,
                scopeId: window.workstreamId,
                projectId: window.workstream?.projectId ?? projectId!,
              };
            }
            return { ...period, scopeType: "project" as const, scopeId: projectId! };
          }),
        },
      ),
    );
    return true;
  }

  private async authorizeWorkstream(
    action: ProjectPolicyAction,
    principal: import("@evaluation/auth").AuthenticatedPrincipal,
    roles: ReadonlyArray<{
      role: import("@evaluation/permissions").Role;
      scopeType: import("@evaluation/permissions").ScopeType;
      scopeId: string;
    }>,
    projectId: string,
    workstreamId: string,
  ): Promise<boolean> {
    const workstream = await this.database.workstream.findFirst({
      where: { id: workstreamId, projectId },
      select: { projectId: true, project: { select: { departmentId: true } } },
    });
    if (workstream === null) throw authorizationError("SCOPE_MISMATCH");
    const scope = await this.database.authorizationScope.findFirst({
      where: { departmentId: workstream.project.departmentId, scopeType: "department" },
      select: { id: true },
    });
    if (scope === null) throw authorizationError("RESOURCE_STATE");
    const windows = await this.database.responsibilityWindow.findMany({
      where: {
        employeeId: principal.userId,
        OR: [{ projectId }, { workstreamId }],
      },
      select: {
        projectId: true,
        workstreamId: true,
        responsibilityType: true,
        startsAt: true,
        endsAt: true,
      },
    });
    enforce(
      decide(
        { subjectId: principal.userId, active: principal.active, roles },
        action,
        { kind: "workstream", workstreamId, projectId, departmentId: scope.id },
        {
          now: new Date().toISOString(),
          responsibilityWindows: windows.map((window) => {
            const workstreamScoped = window.workstreamId === workstreamId;
            return {
              subjectId: principal.userId,
              scopeType: workstreamScoped ? ("workstream" as const) : ("project" as const),
              scopeId: workstreamScoped ? workstreamId : projectId,
              projectId,
              responsibilityType: window.responsibilityType,
              startsAt: window.startsAt.toISOString(),
              endsAt: window.endsAt?.toISOString() ?? null,
            };
          }),
        },
      ),
    );
    return true;
  }
}

const ResourceIdSchema = z.string().uuid();

function parseResourceId(value: unknown): string {
  const result = ResourceIdSchema.safeParse(value);
  if (!result.success) {
    throw new AppError("PROJECT_INPUT_INVALID", "errors.projects.inputInvalid", 400);
  }
  return result.data;
}

function enforce(decision: import("@evaluation/permissions").Decision): void {
  if (!decision.allowed) throw authorizationError(decision.reasonCode);
}

function authorizationError(reasonCode: import("@evaluation/permissions").DenialReason): AppError {
  return new AppError(
    `AUTHZ_${reasonCode}`,
    "errors.authorization.denied",
    reasonCode === "UNAUTHENTICATED" ? 401 : 403,
  );
}

Injectable()(ProjectPolicyGuard);
Inject(Reflector)(ProjectPolicyGuard, undefined, 0);
Inject(PROJECTS_POLICY_DATABASE)(ProjectPolicyGuard, undefined, 1);
