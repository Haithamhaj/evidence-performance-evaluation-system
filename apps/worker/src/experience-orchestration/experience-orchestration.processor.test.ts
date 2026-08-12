import { describe, expect, it, vi } from "vitest";

import {
  ExperienceOrchestrationProcessor,
  processExperienceOrchestrationJob,
} from "./experience-orchestration.processor.js";

const job = {
  schemaVersion: 1 as const,
  jobType: "experience.prepare-next" as const,
  employeeId: "93000000-0000-4000-8000-000000000001",
  correlationId: "93000000-0000-4000-8000-000000000002",
  idempotencyKey: "93000000-0000-4000-8000-000000000003",
};

describe("ExperienceOrchestrationProcessor", () => {
  it("delivers one idempotent composition and reuses the stored result on replay", async () => {
    const result = { state: "idle" as const, items: [] };
    const compose = vi.fn(async () => result);
    const processor = new ExperienceOrchestrationProcessor({
      compose,
    });

    const first = await processor.process(job);
    const replay = await processor.process(job);
    expect(first).toEqual(result);
    expect(replay).toEqual(first);
    expect(compose).toHaveBeenCalledTimes(2);
    expect(compose).toHaveBeenNthCalledWith(1, {
      employeeId: job.employeeId,
      correlationId: job.correlationId,
      idempotencyKey: job.idempotencyKey,
    });
  });

  it("rejects malformed and cross-user results before saving", async () => {
    const processor = new ExperienceOrchestrationProcessor({
      compose: async () => ({
        state: "prepared",
        items: [{ employeeId: "93000000-0000-4000-8000-000000000099" }],
      }),
    });
    await expect(processor.process(job)).rejects.toThrow();
  });

  it("registers only the closed prepare-next job name", async () => {
    const process = vi.fn(async () => ({ state: "idle" as const, items: [] }));
    await expect(
      processExperienceOrchestrationJob(
        { process },
        { name: "experience.prepare-next", data: job, discard() {} },
      ),
    ).resolves.toEqual({ state: "idle", items: [] });
    const discard = vi.fn();
    await expect(
      processExperienceOrchestrationJob(
        { process },
        { name: "telemetry.prepare-next", data: job, discard },
      ),
    ).rejects.toThrow("EXPERIENCE_ORCHESTRATION_JOB_TYPE_MISMATCH");
    expect(discard).toHaveBeenCalledOnce();
  });
});
