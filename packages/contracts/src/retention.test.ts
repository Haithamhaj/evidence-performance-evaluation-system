import { describe, expect, it } from "vitest";

import { RetentionHoldSchema, RetentionPolicySchema } from "./retention.js";

const validPolicy = {
  schemaVersion: 1 as const,
  organizationId: "00000000-0000-4000-8000-000000007001",
  dataType: "EVALUATION_HISTORY" as const,
  policyVersion: 1,
  status: "ACTIVE" as const,
  archiveAfterDays: 365,
  hideAfterDays: 730,
  autoDeleteProtectedHistory: false as const,
  effectiveAt: "2026-08-07T00:00:00.000Z",
  createdById: "00000000-0000-4000-8000-000000007002",
  reason: "Pilot archive policy",
};

describe("retention contracts", () => {
  it("prohibits automatic deletion of protected history", () => {
    expect(RetentionPolicySchema.parse(validPolicy)).toEqual(validPolicy);
    expect(() =>
      RetentionPolicySchema.parse({ ...validPolicy, autoDeleteProtectedHistory: true }),
    ).toThrow();
  });

  it("requires an explicit scoped reason for a hold", () => {
    expect(
      RetentionHoldSchema.parse({
        schemaVersion: 1,
        organizationId: validPolicy.organizationId,
        dataType: "EVALUATION_HISTORY",
        resourceType: "employee_evaluation_cycle",
        resourceId: "00000000-0000-4000-8000-000000007003",
        status: "ACTIVE",
        reason: "Preserve calibration evidence",
        placedById: validPolicy.createdById,
        placedAt: validPolicy.effectiveAt,
      }),
    ).toMatchObject({ status: "ACTIVE" });
    expect(() =>
      RetentionHoldSchema.parse({
        schemaVersion: 1,
        organizationId: validPolicy.organizationId,
        dataType: "EVALUATION_HISTORY",
        resourceType: "employee_evaluation_cycle",
        resourceId: "00000000-0000-4000-8000-000000007003",
        status: "ACTIVE",
        reason: "",
        placedById: validPolicy.createdById,
        placedAt: validPolicy.effectiveAt,
      }),
    ).toThrow();
  });
});
