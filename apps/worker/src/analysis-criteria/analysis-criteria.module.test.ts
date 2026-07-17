import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";

import {
  ANALYSIS_CRITERIA_WORKER_CONFIGURATION,
  ANALYSIS_CRITERIA_WORKER_FACTORY,
  AnalysisCriteriaWorkerLifecycle,
  AnalysisCriteriaWorkerModule,
} from "./analysis-criteria.module.js";
import { createQueueRuntimeConfiguration } from "../queue/queue.module.js";

describe("AnalysisCriteriaWorkerModule", () => {
  it("prevents the generic transactional runtime from binding the dedicated queue", () => {
    expect(
      createQueueRuntimeConfiguration({
        DATABASE_URL: "postgresql://unit.invalid/analysis",
        REDIS_URL: "redis://unit.invalid:6379",
        WORKER_JOB_TYPE: "analysis-criteria.process",
      }),
    ).toBeUndefined();
  });

  it("starts and closes the same dedicated composition", async () => {
    const start = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    const create = vi.fn(async () => ({ start, close }));
    const configuration = {
      databaseUrl: "postgresql://unit.invalid/analysis",
      redisUrl: "redis://unit.invalid:6379",
      environment: {},
    };
    const application = await Test.createTestingModule({
      imports: [AnalysisCriteriaWorkerModule],
    })
      .overrideProvider(ANALYSIS_CRITERIA_WORKER_CONFIGURATION)
      .useValue(configuration)
      .overrideProvider(ANALYSIS_CRITERIA_WORKER_FACTORY)
      .useValue(create)
      .compile();
    await application.init();
    expect(application.get(AnalysisCriteriaWorkerLifecycle)).toBeDefined();
    expect(create).toHaveBeenCalledWith(configuration);
    expect(start).toHaveBeenCalledOnce();
    await application.close();
    expect(close).toHaveBeenCalledOnce();
  });
});
