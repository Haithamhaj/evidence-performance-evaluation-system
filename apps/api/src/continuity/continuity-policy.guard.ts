/* eslint-disable no-unused-vars */
import { AppError } from "@evaluation/contracts";
import { Inject, Injectable } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard.js";

export type ContinuityRequest = {
  principal?: import("@evaluation/auth").AuthenticatedPrincipal;
  headers: Readonly<Record<string, string | undefined>>;
  params: Record<string, string | undefined>;
  body?: unknown;
  correlationId?: string;
};

export class ContinuityPolicyGuard {
  constructor(private readonly auth: AuthGuard) {}
  async canActivate(context: import("@nestjs/common").ExecutionContext) {
    await this.auth.canActivate(context);
    const request = context.switchToHttp().getRequest<ContinuityRequest>();
    if (request.principal?.active !== true) {
      throw new AppError("CONTINUITY_FORBIDDEN", "errors.authorization.denied", 403);
    }
    return true;
  }
}
Injectable()(ContinuityPolicyGuard);
Inject(AuthGuard)(ContinuityPolicyGuard, undefined, 0);
