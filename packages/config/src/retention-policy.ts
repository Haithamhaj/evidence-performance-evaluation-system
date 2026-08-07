import {
  RetentionHoldSchema,
  RetentionPolicySchema,
  type RetentionDataType,
  type RetentionHold,
  type RetentionPolicy,
} from "@evaluation/contracts";

export type RetentionDecision =
  | { readonly allowed: false }
  | {
      readonly allowed: true;
      readonly policyVersion: number;
      readonly disposition: "ARCHIVE_OR_HIDE_ONLY" | "PRESERVE";
      readonly held: boolean;
    };

export function resolveRetentionPolicy(
  policies: readonly RetentionPolicy[],
  holds: readonly RetentionHold[],
  dataType: RetentionDataType,
): RetentionDecision {
  const active = policies
    .map((policy) => RetentionPolicySchema.parse(policy))
    .filter((policy) => policy.dataType === dataType && policy.status === "ACTIVE")
    .sort((left, right) => right.policyVersion - left.policyVersion)[0];
  if (!active) return { allowed: false };

  const held = holds
    .map((hold) => RetentionHoldSchema.parse(hold))
    .some((hold) => hold.dataType === dataType && hold.status === "ACTIVE");
  return {
    allowed: true,
    policyVersion: active.policyVersion,
    disposition: held ? "PRESERVE" : "ARCHIVE_OR_HIDE_ONLY",
    held,
  };
}
