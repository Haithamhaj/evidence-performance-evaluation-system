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
    const markError = vi.fn();
    await expect(
      processExperienceQueueJob(
        { process, markError },
        { name: "experience.deliver", data: job, discard() {} },
      ),
    ).resolves.toEqual({ state: "delivered", replay: false });
    expect(process).toHaveBeenCalledWith(job);
  });

  it("discards malformed or cross-zone jobs before the processor", async () => {
    const process = vi.fn();
    const markError = vi.fn();
    const malformedDiscard = vi.fn();
    const telemetryDiscard = vi.fn();
    await expect(
      processExperienceQueueJob(
        { process, markError },
        { name: "experience.deliver", data: {}, discard: malformedDiscard },
      ),
    ).rejects.toThrow("EXPERIENCE_JOB_INVALID");
    await expect(
      processExperienceQueueJob(
        { process, markError },
        { name: "telemetry.deliver", data: job, discard: telemetryDiscard },
      ),
    ).rejects.toThrow("EXPERIENCE_JOB_TYPE_MISMATCH");
    expect(malformedDiscard).toHaveBeenCalledOnce();
    expect(telemetryDiscard).toHaveBeenCalledOnce();
    expect(process).not.toHaveBeenCalled();
  });

  it("persists a safe error when delivery exhausts and rethrows for BullMQ retry", async () => {
    const process = vi.fn(async () => {
      throw new Error("database details that must not persist");
    });
    const markError = vi.fn(async () => undefined);

    await expect(
      processExperienceQueueJob(
        { process, markError },
        { name: "experience.deliver", data: job, discard() {} },
      ),
    ).rejects.toThrow("database details that must not persist");
    expect(markError).toHaveBeenCalledWith(job, "delivery_failed");
  });
});
