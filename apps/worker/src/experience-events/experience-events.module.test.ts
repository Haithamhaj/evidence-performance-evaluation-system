import { describe, expect, it } from "vitest";

import { createQueueRuntimeConfiguration } from "../queue/queue.module.js";
import { createExperienceWorkerConfiguration } from "./experience-events.module.js";

describe("experience delivery worker configuration", () => {
  it("selects the dedicated runtime without starting the generic queue consumer", () => {
    const environment = {
      DATABASE_URL: "postgresql://local.invalid/evaluation",
      REDIS_URL: "redis://127.0.0.1:6379/0",
      WORKER_JOB_TYPE: "experience.deliver",
    };

    expect(createExperienceWorkerConfiguration(environment)).toEqual({
      databaseUrl: environment.DATABASE_URL,
      redisUrl: environment.REDIS_URL,
    });
    expect(createQueueRuntimeConfiguration(environment)).toBeUndefined();
  });
});
