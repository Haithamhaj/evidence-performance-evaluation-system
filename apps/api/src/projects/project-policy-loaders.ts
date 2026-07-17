import { AppError } from "@evaluation/contracts";
import { decide } from "@evaluation/permissions";
import { Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { z } from "zod";

export const PROJECTS_POLICY_DATABASE = Symbol("PROJECTS_POLICY_DATABASE");
export const PROJECT_POLICY_ACTION = Symbol("PROJECT_POLICY_ACTION");

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type ProjectPolicyAction = "project.create" | "project.manage" | "resource.read";

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

    const resourceId =
      action === "project.create"
        ? parseResourceId(request.body?.departmentId)
        : parseResourceId(request.params?.projectId);

    const roles = await this.database.roleAssignment.findMany({
      where: { userId: principal.userId },
      select: { role: true, scopeType: true, scopeId: true },
    });
    if (action === "project.create") {
      const scope = await this.database.authorizationScope.findFirst({
        where: { departmentId: resourceId, scopeType: "department" },
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

    const projectId = resourceId;
    const project = await this.database.project.findUnique({
      where: { id: projectId },
      select: { departmentId: true },
    });
    if (project === null) throw authorizationError("SCOPE_MISMATCH");
    const scope = await this.database.authorizationScope.findFirst({
      where: { departmentId: project.departmentId, scopeType: "department" },
      select: { id: true },
    });
    if (scope === null) throw authorizationError("RESOURCE_STATE");
    const windows = await this.database.responsibilityWindow.findMany({
      where: { employeeId: principal.userId, projectId },
      select: { responsibilityType: true, startsAt: true, endsAt: true },
    });
    enforce(
      decide(
        { subjectId: principal.userId, active: principal.active, roles },
        action,
        { kind: "project", projectId, departmentId: scope.id },
        {
          now: new Date().toISOString(),
          responsibilityWindows: windows.map((window) => ({
            subjectId: principal.userId,
            scopeType: "project" as const,
            scopeId: projectId,
            responsibilityType: window.responsibilityType,
            startsAt: window.startsAt.toISOString(),
            endsAt: window.endsAt?.toISOString() ?? null,
          })),
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
