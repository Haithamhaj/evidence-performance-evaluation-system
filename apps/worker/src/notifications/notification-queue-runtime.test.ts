import { describe, expect, it, vi } from "vitest";

import { processNotificationQueueJob } from "./notification-queue-runtime.js";

describe("notification queue runtime", () => {
  it("executes a bounded intent-only delivery job", async () => {
    const process = vi.fn().mockResolvedValue({ inAppState: "READY", emailState: "SENT" });
    const job = {
      schemaVersion: 1 as const,
      jobType: "notifications.deliver" as const,
      intentId: "10000000-0000-4000-8000-000000000001",
      correlationId: "10000000-0000-4000-8000-000000000002",
    };
    await expect(
      processNotificationQueueJob({ process }, { name: job.jobType, data: job, discard() {} }),
    ).resolves.toMatchObject({ inAppState: "READY" });
    expect(process).toHaveBeenCalledWith(job);
  });

  it("discards malformed jobs", async () => {
    const discard = vi.fn();
    await expect(
      processNotificationQueueJob(
        { process: vi.fn() },
        { name: "notifications.deliver", data: {}, discard },
      ),
    ).rejects.toThrow("NOTIFICATION_JOB_INVALID");
    expect(discard).toHaveBeenCalledOnce();
  });
});
