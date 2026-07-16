import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";

import { AppModule } from "./app.module.js";
import { WorkerHealthController } from "./health/health.controller.js";
import {
  QUEUE_RUNTIME_CONFIGURATION,
  QUEUE_RUNTIME_FACTORY,
  QueueRuntimeLifecycle,
} from "./queue/queue.module.js";

describe("worker AppModule composition", () => {
  it("starts the configured queue runtime and closes the same runtime through Nest shutdown", async () => {
    const start = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const runtime = { start, close };
    const create = vi.fn().mockReturnValue(runtime);
    const configuration = {
      databaseUrl: "postgresql://unit.invalid/worker",
      redisUrl: "redis://unit.invalid:6379",
      jobType: "system.test",
      jobVersion: 1,
    };
    const application = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(QUEUE_RUNTIME_CONFIGURATION)
      .useValue(configuration)
      .overrideProvider(QUEUE_RUNTIME_FACTORY)
      .useValue(create)
      .compile();

    await application.init();

    expect(application.get(WorkerHealthController).live()).toEqual({ status: "live" });
    expect(application.get(QueueRuntimeLifecycle)).toBeDefined();
    expect(create).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith(configuration);
    expect(start).toHaveBeenCalledOnce();

    await application.close();
    expect(close).toHaveBeenCalledOnce();
  });
});
