import { describe, expect, it, vi } from "vitest";

import { processReportingQueueJob } from "./reporting-queue-runtime.js";

const valid = {
  schemaVersion: 1 as const,
  jobType: "reporting.generate" as const,
  requestId: "10000000-0000-4000-8000-000000000001",
  requesterId: "10000000-0000-4000-8000-000000000002",
  correlationId: "10000000-0000-4000-8000-000000000003",
};

describe("reporting queue runtime", () => {
  it("executes the bounded request-only job", async () => {
    const process = vi.fn().mockResolvedValue({ artifactId: "artifact" });
    await expect(
      processReportingQueueJob(
        { process },
        { name: "reporting.generate", data: valid, discard() {} },
      ),
    ).resolves.toEqual({ artifactId: "artifact" });
    expect(process).toHaveBeenCalledWith(valid);
  });

  it("discards malformed jobs", async () => {
    const discard = vi.fn();
    await expect(
      processReportingQueueJob(
        { process: vi.fn() },
        { name: "reporting.generate", data: {}, discard },
      ),
    ).rejects.toThrow("REPORT_JOB_INVALID");
    expect(discard).toHaveBeenCalledOnce();
  });
});
