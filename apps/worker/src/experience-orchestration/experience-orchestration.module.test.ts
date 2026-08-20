import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";

import { createQueueRuntimeConfiguration } from "../queue/queue.module.js";
import {
  EXPERIENCE_ORCHESTRATION_WORKER_CONFIGURATION,
  EXPERIENCE_ORCHESTRATION_WORKER_FACTORY,
  ExperienceOrchestrationWorkerLifecycle,
  ExperienceOrchestrationWorkerModule,
  createExperienceOrchestrationWorkerConfiguration,
} from "./experience-orchestration.module.js";

describe("ExperienceOrchestrationWorkerModule", () => {
  it("activates only for the closed experience.prepare-next job type", () => {
    const environment = {
      DATABASE_URL: "postgresql://unit.invalid/experience",
      REDIS_URL: "redis://unit.invalid:6379",
    };

    expect(
      createExperienceOrchestrationWorkerConfiguration({
        ...environment,
        WORKER_JOB_TYPE: "system.test",
      }),
    ).toBeUndefined();
    expect(
      createExperienceOrchestrationWorkerConfiguration({
        ...environment,
        WORKER_JOB_TYPE: "experience.prepare-next",
      }),
    ).toEqual({
      databaseUrl: environment.DATABASE_URL,
      redisUrl: environment.REDIS_URL,
    });
  });

  it("prevents the generic test processor from binding the dedicated job type", () => {
    expect(
      createQueueRuntimeConfiguration({
        DATABASE_URL: "postgresql://unit.invalid/experience",
        REDIS_URL: "redis://unit.invalid:6379",
        WORKER_JOB_TYPE: "experience.prepare-next",
      }),
    ).toBeUndefined();
  });

  it("starts and closes the same dedicated runtime composition once", async () => {
    const start = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    const create = vi.fn(async () => ({ start, close }));
    const configuration = {
      databaseUrl: "postgresql://unit.invalid/experience",
      redisUrl: "redis://unit.invalid:6379",
    };
    const application = await Test.createTestingModule({
      imports: [ExperienceOrchestrationWorkerModule],
    })
      .overrideProvider(EXPERIENCE_ORCHESTRATION_WORKER_CONFIGURATION)
      .useValue(configuration)
      .overrideProvider(EXPERIENCE_ORCHESTRATION_WORKER_FACTORY)
      .useValue(create)
      .compile();

    await application.init();
    expect(application.get(ExperienceOrchestrationWorkerLifecycle)).toBeDefined();
    expect(create).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith(configuration);
    expect(start).toHaveBeenCalledOnce();

    await application.close();
    expect(close).toHaveBeenCalledOnce();
  });
});
