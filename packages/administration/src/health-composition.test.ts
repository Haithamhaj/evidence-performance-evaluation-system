import { describe, expect, it } from "vitest";

import { AdminHealthComposition } from "./health-composition.js";

describe("AdminHealthComposition", () => {
  it("composes the worst bounded state without leaking probe details", async () => {
    const health = await new AdminHealthComposition([
      {
        dependency: "DATABASE",
        check: async () => ({
          state: "HEALTHY",
          nextActionKey: null,
          databaseUrl: "postgres://secret",
        }),
      },
      {
        dependency: "CONNECTOR",
        check: async () => ({
          state: "DEGRADED",
          nextActionKey: "admin.health.reconnectConnector",
          accessToken: "secret",
          rawLog: "private",
        }),
      },
    ]).read();

    expect(health.state).toBe("DEGRADED");
    expect(JSON.stringify(health)).not.toMatch(/postgres|secret|rawLog|accessToken/u);
    expect(health.dependencies).toHaveLength(2);
  });

  it("bounds pagination and marks probe errors as action required", async () => {
    const probes = Array.from({ length: 15 }, (_, index) => ({
      dependency: "API" as const,
      check: async () => {
        if (index === 0) throw new Error("token=secret");
        return { state: "HEALTHY" as const, nextActionKey: null };
      },
    }));
    const health = await new AdminHealthComposition(probes).read({ limit: 10 });
    expect(health.state).toBe("ACTION_REQUIRED");
    expect(health.dependencies).toHaveLength(10);
  });
});
