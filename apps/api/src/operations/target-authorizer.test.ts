import { describe, expect, it } from "vitest";

import { OperationsTargetAuthorizer } from "./target-authorizer.js";

describe("OperationsTargetAuthorizer", () => {
  it("authorizes every produced action from current owner-domain access", async () => {
    const database = {
      workstreamMember: { findFirst: async () => ({ id: "member" }) },
      reassignmentRequiredCase: {
        findFirst: async () => ({ id: "case", queueItem: { departmentId: "department" } }),
      },
      exportArtifact: {
        findFirst: async () => ({
          id: "artifact",
          expiresAt: new Date("2026-08-08T00:00:00.000Z"),
          revocations: [],
          manifest: {
            requesterId: "10000000-0000-4000-8000-000000000001",
            reportType: "PROJECT_OPERATIONAL",
            audience: "EMPLOYEE_SELF",
            cycleId: null,
          },
        }),
      },
      roleAssignment: { findFirst: async () => ({ id: "role" }) },
    };
    const registry = { authorizeCurrent: async () => true };
    const authorizer = new OperationsTargetAuthorizer(
      database as never,
      registry as never,
      () => new Date("2026-08-07T00:00:00.000Z"),
    );
    const actorId = "10000000-0000-4000-8000-000000000001";
    await expect(
      authorizer.authorize(actorId, { kind: "CHECK_IN", resourceId: "workstream" }),
    ).resolves.toBe(true);
    await expect(
      authorizer.authorize(actorId, { kind: "OPEN_CONTINUITY", resourceId: "case" }),
    ).resolves.toBe(true);
    await expect(
      authorizer.authorize(actorId, { kind: "DOWNLOAD_EXPORT", resourceId: "artifact" }),
    ).resolves.toBe(true);
    await expect(
      authorizer.authorize(actorId, { kind: "OPEN_ADMIN_HEALTH", resourceId: "QUEUE" }),
    ).resolves.toBe(true);
  });

  it("denies a signed export target after its source authorization is removed", async () => {
    const database = {
      exportArtifact: {
        findFirst: async () => ({
          id: "artifact",
          expiresAt: new Date("2026-08-08T00:00:00.000Z"),
          revocations: [],
          manifest: {
            requesterId: "10000000-0000-4000-8000-000000000001",
            reportType: "PROJECT_OPERATIONAL",
            audience: "EMPLOYEE_SELF",
            cycleId: null,
          },
        }),
      },
    };
    const authorizer = new OperationsTargetAuthorizer(
      database as never,
      { authorizeCurrent: async () => false } as never,
      () => new Date("2026-08-07T00:00:00.000Z"),
    );
    await expect(
      authorizer.authorize("10000000-0000-4000-8000-000000000001", {
        kind: "DOWNLOAD_EXPORT",
        resourceId: "artifact",
      }),
    ).resolves.toBe(false);
  });
});
