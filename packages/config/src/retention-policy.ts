import { RetentionHoldSchema, RetentionPolicySchema } from "@evaluation/contracts";

export type RetentionResolutionRequest = {
  readonly organizationId: string;
  readonly dataType: import("@evaluation/contracts").RetentionDataType;
  readonly asOf: string;
  readonly resource: {
    readonly type: string;
    readonly id: string;
  };
};

export type RetentionDecision =
  | { readonly allowed: false }
  | {
      readonly allowed: true;
      readonly policyVersion: number;
      readonly disposition: "ARCHIVE_OR_HIDE_ONLY" | "PRESERVE";
      readonly held: boolean;
    };

export function resolveRetentionPolicy(
  policies: readonly import("@evaluation/contracts").RetentionPolicy[],
  holds: readonly import("@evaluation/contracts").RetentionHold[],
  request: RetentionResolutionRequest,
): RetentionDecision {
  const asOf = new Date(request.asOf);
  if (
    !Number.isFinite(asOf.getTime()) ||
    !request.asOf.endsWith("Z") ||
    !request.organizationId ||
    !request.resource.type ||
    !request.resource.id
  ) {
    return { allowed: false };
  }

  const active = policies
    .map((policy) => RetentionPolicySchema.parse(policy))
    .filter(
      (policy) =>
        policy.organizationId === request.organizationId &&
        policy.dataType === request.dataType &&
        policy.status === "ACTIVE" &&
        new Date(policy.effectiveAt) <= asOf,
    )
    .sort((left, right) => {
      const effectiveDifference =
        new Date(right.effectiveAt).getTime() - new Date(left.effectiveAt).getTime();
      return effectiveDifference || right.policyVersion - left.policyVersion;
    })[0];
  if (!active) return { allowed: false };

  const held = holds
    .map((hold) => RetentionHoldSchema.parse(hold))
    .some(
      (hold) =>
        hold.organizationId === request.organizationId &&
        hold.dataType === request.dataType &&
        hold.resourceType === request.resource.type &&
        hold.resourceId === request.resource.id &&
        new Date(hold.placedAt) <= asOf &&
        (hold.status === "ACTIVE" ||
          (hold.releasedAt !== undefined && new Date(hold.releasedAt) > asOf)),
    );
  return {
    allowed: true,
    policyVersion: active.policyVersion,
    disposition: held ? "PRESERVE" : "ARCHIVE_OR_HIDE_ONLY",
    held,
  };
}
