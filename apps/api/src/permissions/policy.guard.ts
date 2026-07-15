import { Injectable } from "@nestjs/common";

import { decide } from "@evaluation/permissions";
import { AppError } from "@evaluation/contracts";

import { getPolicyRequirement, type PolicyRequest } from "./require-policy.decorator.js";

function authorizationError(reasonCode: import("@evaluation/permissions").DenialReason): AppError {
  return new AppError(
    `AUTHZ_${reasonCode}`,
    "errors.authorization.denied",
    reasonCode === "UNAUTHENTICATED" ? 401 : 403,
  );
}

export class PolicyGuard {
  async canActivate(context: import("@nestjs/common").ExecutionContext): Promise<boolean> {
    const requirement = getPolicyRequirement(context.getHandler());
    if (requirement === undefined) throw authorizationError("ROLE_REQUIRED");

    const request = context.switchToHttp().getRequest<PolicyRequest>();
    const principal = request.principal;
    if (principal === undefined) throw authorizationError("UNAUTHENTICATED");
    if (!principal.active) throw authorizationError("INACTIVE");

    const loaded = await requirement.loadResource(request, principal);
    const decision = decide(
      {
        subjectId: principal.userId,
        active: principal.active,
        roles: loaded.roleAssignments,
      },
      requirement.action,
      loaded.resource,
      loaded.context,
    );
    if (!decision.allowed) throw authorizationError(decision.reasonCode);
    return true;
  }
}

Injectable()(PolicyGuard);
