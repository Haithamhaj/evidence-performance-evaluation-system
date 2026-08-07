import { describe, expect, it } from "vitest";

import { resolveRetentionPolicy } from "./retention-policy.js";

describe("retention policy resolution", () => {
  it("fails closed when no active version exists and honors active holds", () => {
    expect(resolveRetentionPolicy([], [], "EVALUATION_HISTORY")).toEqual({ allowed: false });

    const policy = {
      schemaVersion: 1 as const,
      organizationId: "00000000-0000-4000-8000-000000007011",
      dataType: "EVALUATION_HISTORY" as const,
      policyVersion: 2,
      status: "ACTIVE" as const,
      archiveAfterDays: 365,
      hideAfterDays: 730,
      autoDeleteProtectedHistory: false as const,
      effectiveAt: "2026-08-07T00:00:00.000Z",
      createdById: "00000000-0000-4000-8000-000000007012",
      reason: "Approved pilot policy",
    };
    expect(resolveRetentionPolicy([policy], [], policy.dataType)).toMatchObject({
      allowed: true,
      policyVersion: 2,
      disposition: "ARCHIVE_OR_HIDE_ONLY",
      held: false,
    });
    expect(
      resolveRetentionPolicy(
        [policy],
        [
          {
            schemaVersion: 1 as const,
            organizationId: policy.organizationId,
            dataType: policy.dataType,
            resourceType: "employee_evaluation_cycle",
            resourceId: "00000000-0000-4000-8000-000000007013",
            status: "ACTIVE" as const,
            reason: "Operational hold",
            placedById: policy.createdById,
            placedAt: policy.effectiveAt,
          },
        ],
        policy.dataType,
      ),
    ).toMatchObject({ allowed: true, held: true, disposition: "PRESERVE" });
  });
});
