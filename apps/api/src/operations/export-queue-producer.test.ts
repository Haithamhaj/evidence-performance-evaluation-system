import { describe, expect, it, vi } from "vitest";

import { ExportQueueProducer, reportingQueuePhysicalName } from "./export-queue-producer.js";

describe("ExportQueueProducer", () => {
  it("queues one versioned idempotent background job without report content", async () => {
    const add = vi.fn().mockResolvedValue({ id: "job-1" });
    const producer = new ExportQueueProducer({ add, close: async () => undefined });
    await expect(
      producer.enqueue({
        requestId: "10000000-0000-4000-8000-000000000001",
        requesterId: "10000000-0000-4000-8000-000000000002",
        correlationId: "10000000-0000-4000-8000-000000000003",
      }),
    ).resolves.toEqual({ jobId: "job-1" });
    expect(add).toHaveBeenCalledWith(
      "reporting.generate",
      expect.objectContaining({ schemaVersion: 1, jobType: "reporting.generate" }),
      expect.objectContaining({ jobId: "10000000-0000-4000-8000-000000000001", attempts: 3 }),
    );
    expect(JSON.stringify(add.mock.calls)).not.toContain("report body");
    expect(reportingQueuePhysicalName()).toBe("reporting--v1");
  });
});
