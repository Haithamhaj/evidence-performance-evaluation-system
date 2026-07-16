import { applyDecorators, SetMetadata, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard.js";
import { POLICY_REQUIREMENT } from "./policy.metadata.js";
import { PolicyGuard } from "./policy.guard.js";

export type {
  LoadedPolicyResource,
  PolicyRequest,
  PolicyRequirement,
  PolicyResourceLoader,
} from "./policy.metadata.js";

export function RequirePolicy(
  action: import("@evaluation/permissions").PolicyAction,
  loadResource: import("./policy.metadata.js").PolicyResourceLoader,
): MethodDecorator {
  return applyDecorators(
    SetMetadata(POLICY_REQUIREMENT, Object.freeze({ action, loadResource })),
    UseGuards(AuthGuard, PolicyGuard),
  );
}
