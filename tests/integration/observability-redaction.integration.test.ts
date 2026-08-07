import { describe, expect, it, vi } from "vitest";

import { AdminHealthComposition } from "@evaluation/administration";

import { HealthController } from "../../apps/api/src/platform/health.controller.js";

describe("observability privacy boundary", () => {
  it("keeps public readiness status-only while admin diagnostics remain bounded", async () => {
    const publicController = new HealthController({
      configuration: () => true,
      postgres: () => true,
      redis: () => true,
    });
    const response = { status: vi.fn() };
    await expect(publicController.ready(response)).resolves.toEqual({ status: "ready" });

    const admin = await new AdminHealthComposition([
      {
        dependency: "DATABASE",
        check: async () => ({
          state: "DEGRADED",
          nextActionKey: "admin.health.configureDatabase",
          rawError: "postgres://user:password@private/database",
        }),
      },
    ]).read();
    expect(admin.dependencies[0]).not.toHaveProperty("rawError");
    expect(JSON.stringify(admin)).not.toMatch(/password|postgres:\/\//u);
  });
});
