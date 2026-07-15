import { describe, expect, it } from "vitest";

import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
  it("keeps liveness limited to process availability", () => {
    const controller = new HealthController({
      configuration: async () => false,
      postgres: async () => false,
      redis: async () => false,
    });

    expect(controller.live()).toEqual({ status: "live" });
  });

  it("reports readiness components without credentials or URLs", async () => {
    const controller = new HealthController({
      configuration: async () => true,
      postgres: async () => true,
      redis: async () => false,
    });

    const result = await controller.ready();
    expect(result).toEqual({
      status: "not_ready",
      checks: { configuration: "up", postgres: "up", redis: "down" },
    });
    expect(JSON.stringify(result)).not.toMatch(/password|postgresql:\/\/|redis:\/\//iu);
  });
});
