import { describe, expect, it, vi } from "vitest";

import { PrivateModeIsolation } from "@evaluation/manager-evaluation";

describe("future manager-feedback privacy isolation", () => {
  it("fails closed for an unknown or disabled policy", async () => {
    const isolation = new PrivateModeIsolation({ auditBeforeRead: vi.fn() });
    await expect(
      isolation.read({ policy: null, mode: "MANAGER_BLINDED", identityLink: null, topics: [] }),
    ).resolves.toEqual({ allowed: false });
  });

  it("separates identity, suppresses unique topics, and audits before a sensitive read", async () => {
    const order: string[] = [];
    const isolation = new PrivateModeIsolation({
      auditBeforeRead: vi.fn(async () => order.push("audit")),
      readSealedIdentity: vi.fn(async () => {
        order.push("read");
        return "employee-opaque-reference";
      }),
    });
    const result = await isolation.read({
      policy: {
        enabled: true,
        mode: "MANAGER_BLINDED",
        managerCanReadIdentity: false,
        managerCanReadOriginals: false,
        minimumTopicSupport: 2,
      },
      mode: "MANAGER_BLINDED",
      identityLink: "sealed:v1:reference",
      topics: [
        { key: "clear-direction", support: 3 },
        { key: "unique-client-detail", support: 1 },
      ],
      sensitiveAccess: { authorized: true, reason: "Governance investigation" },
    });

    expect(order).toEqual(["audit", "read"]);
    expect(result).toEqual({
      allowed: true,
      identity: "employee-opaque-reference",
      managerProjection: { identity: null, originals: null, topics: ["clear-direction"] },
    });
  });
});
