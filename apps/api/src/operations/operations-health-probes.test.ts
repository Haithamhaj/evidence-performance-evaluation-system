import { describe, expect, it, vi } from "vitest";

import { AdminHealthComposition } from "@evaluation/administration";

import { createOperationsHealthProbes } from "./operations-health-probes.js";

describe("operations health probes", () => {
  it("fails closed for missing external gates without constructing their clients", async () => {
    const database = {
      $queryRawUnsafe: async () => [{ health: 1 }],
      aiRouteConfig: { count: async () => 0 },
      connectedWorkAccount: { count: async () => 0 },
    };
    const health = await new AdminHealthComposition(
      createOperationsHealthProbes({
        database: database as never,
        storage: {} as never,
        environment: { DATABASE_URL: "postgresql://configured" },
        fetch: vi.fn(),
      }),
    ).read();
    expect(health.state).toBe("ACTION_REQUIRED");
    expect(health.dependencies.find(({ dependency }) => dependency === "QUEUE")?.state).toBe(
      "ACTION_REQUIRED",
    );
    expect(
      health.dependencies.find(({ dependency }) => dependency === "OBJECT_STORAGE")?.state,
    ).toBe("ACTION_REQUIRED");
    expect(health.dependencies.find(({ dependency }) => dependency === "OIDC")?.state).toBe(
      "ACTION_REQUIRED",
    );
    expect(health.alerts.some(({ signalKind }) => signalKind === "REDIS")).toBe(true);
  });

  it("calls representative owner adapters instead of treating configuration presence as health", async () => {
    const storageProbe = vi.fn().mockResolvedValue(true);
    const redisProbe = vi.fn().mockResolvedValue(false);
    const database = {
      $queryRawUnsafe: async () => [{ health: 1 }],
      aiRouteConfig: { count: async () => 1 },
      connectedWorkAccount: { count: async () => 1 },
    };
    const health = await new AdminHealthComposition(
      createOperationsHealthProbes({
        database: database as never,
        storage: { probe: storageProbe } as never,
        environment: { DATABASE_URL: "postgresql://configured", REDIS_URL: "redis://configured" },
        fetch: vi.fn().mockResolvedValue({ ok: true }),
        redisProbe,
      }),
    ).read();
    expect(storageProbe).toHaveBeenCalledOnce();
    expect(redisProbe).toHaveBeenCalledOnce();
    expect(health.dependencies.find(({ dependency }) => dependency === "QUEUE")?.state).toBe(
      "ACTION_REQUIRED",
    );
  });
});
