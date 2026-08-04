import { AppError } from "@evaluation/contracts";
import { decide } from "@evaluation/permissions";
import { Inject, Injectable } from "@nestjs/common";

export const DOCUMENTS_POLICY_DATABASE = Symbol("DOCUMENTS_POLICY_DATABASE");

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type Request = Readonly<{
  principal?: import("@evaluation/auth").AuthenticatedPrincipal;
  body?: Record<string, unknown>;
  params?: Record<string, unknown>;
}>;

export class DocumentTemplatePolicyGuard {
  private readonly database: DatabaseClient;

  constructor(database: DatabaseClient) {
    this.database = database;
  }

  async canActivate(context: import("@nestjs/common").ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const principal = request.principal;
    if (principal === undefined) throw denied("UNAUTHENTICATED");
    if (!principal.active) throw denied("INACTIVE");
    const roles = await this.database.roleAssignment.findMany({
      where: { userId: principal.userId },
      select: { role: true, scopeType: true, scopeId: true },
    });
    const resource =
      request.params?.templateId === undefined
        ? await this.fromCreateBody(request.body)
        : await this.fromTemplateId(String(request.params.templateId));
    const decision = decide(
      { subjectId: principal.userId, active: true, roles },
      "document.template.manage",
      resource,
      { now: new Date().toISOString() },
    );
    if (!decision.allowed) throw denied(decision.reasonCode);
    return true;
  }

  private async fromCreateBody(body: Record<string, unknown> | undefined) {
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    if (body?.scopeType === "organization") {
      return { kind: "organizationTemplate", organizationId } as const;
    }
    const departmentId = typeof body?.departmentId === "string" ? body.departmentId : "";
    const scope = await this.database.authorizationScope.findFirst({
      where: { departmentId, scopeType: "department" },
      select: { id: true },
    });
    if (scope === null) throw denied("SCOPE_MISMATCH");
    return { kind: "departmentTemplate", organizationId, departmentId: scope.id } as const;
  }

  private async fromTemplateId(templateId: string) {
    const template = await this.database.documentTemplate.findUnique({
      where: { id: templateId },
      select: { organizationId: true, scopeType: true, departmentId: true },
    });
    if (template === null) throw denied("SCOPE_MISMATCH");
    if (template.scopeType === "organization") {
      return { kind: "organizationTemplate", organizationId: template.organizationId } as const;
    }
    const scope = await this.database.authorizationScope.findFirst({
      where: { departmentId: template.departmentId!, scopeType: "department" },
      select: { id: true },
    });
    if (scope === null) throw denied("SCOPE_MISMATCH");
    return {
      kind: "departmentTemplate",
      organizationId: template.organizationId,
      departmentId: scope.id,
    } as const;
  }
}

function denied(reason: import("@evaluation/permissions").DenialReason) {
  return new AppError(
    `AUTHZ_${reason}`,
    "errors.authorization.denied",
    reason === "UNAUTHENTICATED" ? 401 : 403,
  );
}

Injectable()(DocumentTemplatePolicyGuard);
Inject(DOCUMENTS_POLICY_DATABASE)(DocumentTemplatePolicyGuard, undefined, 0);
