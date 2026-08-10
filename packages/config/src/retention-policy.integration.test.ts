import { describe, expect, it } from "vitest";

import { resolveRetentionPolicy } from "./retention-policy.js";

describe("retention policy resolution", () => {
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
  const request = {
    organizationId: policy.organizationId,
    dataType: policy.dataType,
    asOf: "2026-08-08T00:00:00.000Z",
    resource: {
      type: "employee_evaluation_cycle",
      id: "00000000-0000-4000-8000-000000007013",
    },
  } as const;

  it("fails closed when no active effective version exists", () => {
    expect(resolveRetentionPolicy([], [], request)).toEqual({ allowed: false });
  });

  it("selects the latest effective policy for the requested organization", () => {
    expect(
      resolveRetentionPolicy(
        [
          policy,
          { ...policy, policyVersion: 3, effectiveAt: "2026-08-09T00:00:00.000Z" },
          {
            ...policy,
            organizationId: "00000000-0000-4000-8000-000000007099",
            policyVersion: 99,
          },
        ],
        [],
        request,
      ),
    ).toMatchObject({
      allowed: true,
      policyVersion: 2,
      disposition: "ARCHIVE_OR_HIDE_ONLY",
      held: false,
    });
  });

  it("applies a hold only to its organization, resource and effective interval", () => {
    const hold = {
      schemaVersion: 1 as const,
      organizationId: policy.organizationId,
      dataType: policy.dataType,
      resourceType: request.resource.type,
      resourceId: request.resource.id,
      status: "ACTIVE" as const,
      reason: "Operational hold",
      placedById: policy.createdById,
      placedAt: policy.effectiveAt,
    };

    expect(
      resolveRetentionPolicy(
        [policy],
        [
          hold,
          { ...hold, organizationId: "00000000-0000-4000-8000-000000007099" },
          { ...hold, resourceId: "00000000-0000-4000-8000-000000007088" },
        ],
        request,
      ),
    ).toMatchObject({ allowed: true, held: true, disposition: "PRESERVE" });

    expect(
      resolveRetentionPolicy(
        [policy],
        [{ ...hold, placedAt: "2026-08-09T00:00:00.000Z" }],
        request,
      ),
    ).toMatchObject({ allowed: true, held: false });
  });

  it("resolves a released hold according to the requested historical instant", () => {
    const releasedHold = {
      schemaVersion: 1 as const,
      organizationId: policy.organizationId,
      dataType: policy.dataType,
      resourceType: request.resource.type,
      resourceId: request.resource.id,
      status: "RELEASED" as const,
      reason: "Operational hold",
      placedById: policy.createdById,
      placedAt: "2026-08-07T00:00:00.000Z",
      releasedById: policy.createdById,
      releasedAt: "2026-08-10T00:00:00.000Z",
      releaseReason: "Matter resolved",
    };

    expect(resolveRetentionPolicy([policy], [releasedHold], request)).toMatchObject({
      allowed: true,
      held: true,
    });
    expect(
      resolveRetentionPolicy([policy], [releasedHold], {
        ...request,
        asOf: "2026-08-11T00:00:00.000Z",
      }),
    ).toMatchObject({ allowed: true, held: false });
  });
});
