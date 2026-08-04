import { describe, expect, it, vi } from "vitest";

import {
  createWorkerEnvironmentReadinessProbes,
  WorkerHealthController,
} from "./health.controller.js";

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

  it("marks readiness down after the dedicated consumer loop fails", async () => {
    const probes = createWorkerEnvironmentReadinessProbes(
      { isHealthy: () => false },
      {
        DATABASE_URL: "postgresql://unit.invalid/worker",
        REDIS_URL: "redis://unit.invalid:6379",
      },
    );

    expect(await probes.configuration()).toBe(false);
  });
});
