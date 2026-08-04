import { AppError } from "@evaluation/contracts";
import { Inject, Injectable } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard.js";

export const CONTEXT_INTELLIGENCE_POLICY_DATABASE = Symbol("CONTEXT_INTELLIGENCE_POLICY_DATABASE");

type DatabaseClient = import("@evaluation/database").DatabaseClient;

type ProtectedRequest = Readonly<{
  principal?: import("@evaluation/auth").AuthenticatedPrincipal;
}>;

export class ContextIntelligencePolicyGuard {
  private readonly authGuard: AuthGuard;
  private readonly database: DatabaseClient;

  constructor(authGuard: AuthGuard, database: DatabaseClient) {
    this.authGuard = authGuard;
    this.database = database;
  }

  async canActivate(context: import("@nestjs/common").ExecutionContext): Promise<boolean> {
    await this.authGuard.canActivate(context);
    const request = context.switchToHttp().getRequest<ProtectedRequest>();
    const principal = request.principal;
    if (principal?.active !== true) {
      throw new AppError(
        "CONTEXT_INTELLIGENCE_FORBIDDEN",
        "errors.contextIntelligence.forbidden",
        403,
      );
    }
    const employeePersona = await this.database.roleAssignment.findFirst({
      where: {
        userId: principal.userId,
        role: { in: ["employee", "contributor"] },
      },
      select: { id: true },
    });
    if (employeePersona === null) {
      throw new AppError(
        "CONTEXT_INTELLIGENCE_FORBIDDEN",
        "errors.contextIntelligence.forbidden",
        403,
      );
    }
    return true;
  }
}

Injectable()(ContextIntelligencePolicyGuard);
Inject(AuthGuard)(ContextIntelligencePolicyGuard, undefined, 0);
Inject(CONTEXT_INTELLIGENCE_POLICY_DATABASE)(ContextIntelligencePolicyGuard, undefined, 1);
