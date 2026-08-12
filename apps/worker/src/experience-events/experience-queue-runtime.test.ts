import { describe, expect, it, vi } from "vitest";

import { processExperienceQueueJob } from "./experience-queue-runtime.js";

const job = {
  schemaVersion: 1,
  jobType: "experience.deliver",
  receiptId: "60000000-0000-4000-8000-000000000001",
  correlationId: "60000000-0000-4000-8000-000000000002",
} as const;

describe("experience queue runtime", () => {
  it("transports only the closed experience delivery job", async () => {
    const process = vi.fn(async () => ({ state: "delivered" as const, replay: false }));
    await expect(
      processExperienceQueueJob(
        { process },
        { name: "experience.deliver", data: job, discard() {} },
      ),
    ).resolves.toEqual({ state: "delivered", replay: false });
    expect(process).toHaveBeenCalledWith(job);
  });

  it("discards malformed or cross-zone jobs before the processor", async () => {
    const process = vi.fn();
    const malformedDiscard = vi.fn();
    const telemetryDiscard = vi.fn();
    await expect(
      processExperienceQueueJob(
        { process },
        { name: "experience.deliver", data: {}, discard: malformedDiscard },
      ),
    ).rejects.toThrow("EXPERIENCE_JOB_INVALID");
    await expect(
      processExperienceQueueJob(
        { process },
        { name: "telemetry.deliver", data: job, discard: telemetryDiscard },
      ),
    ).rejects.toThrow("EXPERIENCE_JOB_TYPE_MISMATCH");
    expect(malformedDiscard).toHaveBeenCalledOnce();
    expect(telemetryDiscard).toHaveBeenCalledOnce();
    expect(process).not.toHaveBeenCalled();
  });
});
