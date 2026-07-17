import { Inject, Injectable } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard.js";

export class AnalysisCriteriaAuthenticationGuard {
  private readonly authGuard: AuthGuard;

  constructor(authGuard: AuthGuard) {
    this.authGuard = authGuard;
  }

  canActivate(context: import("@nestjs/common").ExecutionContext): Promise<boolean> {
    return this.authGuard.canActivate(context);
  }
}

Injectable()(AnalysisCriteriaAuthenticationGuard);
Inject(AuthGuard)(AnalysisCriteriaAuthenticationGuard, undefined, 0);
