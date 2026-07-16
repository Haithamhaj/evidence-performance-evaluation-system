import { Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { decide } from "@evaluation/permissions";
import { AppError } from "@evaluation/contracts";

import { POLICY_REQUIREMENT } from "./policy.metadata.js";

function authorizationError(reasonCode: import("@evaluation/permissions").DenialReason): AppError {
  return new AppError(
    `AUTHZ_${reasonCode}`,
    "errors.authorization.denied",
    reasonCode === "UNAUTHENTICATED" ? 401 : 403,
  );
}

export class PolicyGuard {
  private readonly reflector: Reflector;

  constructor(reflector: Reflector) {
    this.reflector = reflector;
  }

  async canActivate(context: import("@nestjs/common").ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.get<
      import("./policy.metadata.js").PolicyRequirement | undefined
    >(POLICY_REQUIREMENT, context.getHandler());
    if (requirement === undefined) throw authorizationError("ROLE_REQUIRED");

    const request = context
      .switchToHttp()
      .getRequest<import("./policy.metadata.js").PolicyRequest>();
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
Inject(Reflector)(PolicyGuard, undefined, 0);
