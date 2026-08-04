import { Inject, Injectable } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard.js";

export class UpdatesEvidencePolicyGuard {
  private readonly authGuard: AuthGuard;

  constructor(authGuard: AuthGuard) {
    this.authGuard = authGuard;
  }

  canActivate(context: import("@nestjs/common").ExecutionContext): Promise<boolean> {
    return this.authGuard.canActivate(context);
  }
}

Injectable()(UpdatesEvidencePolicyGuard);
Inject(AuthGuard)(UpdatesEvidencePolicyGuard, undefined, 0);
