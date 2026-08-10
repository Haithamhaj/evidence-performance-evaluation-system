import { AppError } from "@evaluation/contracts";
import { Inject, Injectable } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard.js";

export const OPERATIONS_POLICY_DATABASE = Symbol("OPERATIONS_POLICY_DATABASE");

export type OperationsRequest = {
  principal?: import("@evaluation/auth").AuthenticatedPrincipal;
  headers: Readonly<Record<string, string | undefined>>;
  params: Record<string, string | undefined>;
  query?: Record<string, string | undefined>;
  body?: unknown;
  correlationId?: string;
};

export class OperationsPolicyGuard {
  private readonly auth: AuthGuard;
  private readonly database: import("@evaluation/database").DatabaseClient;

  constructor(auth: AuthGuard, database: import("@evaluation/database").DatabaseClient) {
    this.auth = auth;
    this.database = database;
  }

  async canActivate(context: import("@nestjs/common").ExecutionContext) {
    await this.auth.canActivate(context);
    const request = context.switchToHttp().getRequest<OperationsRequest>();
    if (request.principal?.active !== true) throw forbidden();
    if (context.getClass().name === "AdministrationController") {
      const allowed = await this.database.roleAssignment.findFirst({
        where: {
          userId: request.principal.userId,
          role: "system_administrator",
          scopeType: "system",
        },
        select: { id: true },
      });
      if (!allowed) throw forbidden();
    }
    return true;
  }
}

function forbidden() {
  return new AppError("OPERATIONS_FORBIDDEN", "errors.authorization.denied", 403);
}

Injectable()(OperationsPolicyGuard);
Inject(AuthGuard)(OperationsPolicyGuard, undefined, 0);
Inject(OPERATIONS_POLICY_DATABASE)(OperationsPolicyGuard, undefined, 1);
