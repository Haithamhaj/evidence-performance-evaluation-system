/* eslint-disable no-unused-vars */
import { AppError } from "@evaluation/contracts";
import { Inject, Injectable } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard.js";

export const COACHING_DEVELOPMENT_POLICY_DATABASE = Symbol("COACHING_DEVELOPMENT_POLICY_DATABASE");
export type CoachingRequest = Readonly<{
  principal?: import("@evaluation/auth").AuthenticatedPrincipal;
  params: Record<string, string | undefined>;
  body?: unknown;
  correlationId?: string;
}>;
export class CoachingPolicyGuard {
  constructor(private readonly auth: AuthGuard) {}
  async canActivate(context: import("@nestjs/common").ExecutionContext) {
    await this.auth.canActivate(context);
    const request = context.switchToHttp().getRequest<CoachingRequest>();
    if (request.principal?.active !== true)
      throw new AppError("COACHING_FORBIDDEN", "errors.coaching.forbidden", 403);
    return true;
  }
}
Injectable()(CoachingPolicyGuard);
Inject(AuthGuard)(CoachingPolicyGuard, undefined, 0);
