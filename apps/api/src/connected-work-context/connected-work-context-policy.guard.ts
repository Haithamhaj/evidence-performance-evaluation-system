import { AppError } from "@evaluation/contracts";
import { Inject, Injectable } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard.js";

type ProtectedRequest = Readonly<{
  principal?: import("@evaluation/auth").AuthenticatedPrincipal;
}>;

export class ConnectedWorkContextPolicyGuard {
  private readonly authGuard: AuthGuard;

  constructor(authGuard: AuthGuard) {
    this.authGuard = authGuard;
  }

  async canActivate(context: import("@nestjs/common").ExecutionContext): Promise<boolean> {
    await this.authGuard.canActivate(context);
    const request = context.switchToHttp().getRequest<ProtectedRequest>();
    if (request.principal?.active !== true) {
      throw new AppError("CONNECTED_CONTEXT_FORBIDDEN", "errors.connectedContext.forbidden", 403);
    }
    return true;
  }
}

Injectable()(ConnectedWorkContextPolicyGuard);
Inject(AuthGuard)(ConnectedWorkContextPolicyGuard, undefined, 0);
