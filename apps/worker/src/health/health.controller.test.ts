import { describe, expect, it, vi } from "vitest";

import { WorkerHealthController } from "./health.controller.js";

describe("WorkerHealthController", () => {
  it("keeps liveness independent from dependencies", () => {
    const controller = new WorkerHealthController({
      configuration: () => false,
      postgres: () => false,
      redis: () => false,
    });
    expect(controller.live()).toEqual({ status: "live" });
  });

  it("returns sanitized readiness and the corresponding status", async () => {
    const controller = new WorkerHealthController({
      configuration: () => true,
      postgres: () => true,
      redis: () => false,
    });
    const response = { status: vi.fn() };
    await expect(controller.ready(response)).resolves.toEqual({
      status: "not_ready",
      checks: { configuration: "up", postgres: "up", redis: "down" },
    });
    expect(response.status).toHaveBeenCalledWith(503);
  });
});
