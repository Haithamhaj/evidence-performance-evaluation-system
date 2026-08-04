import { describe, expect, it, vi } from "vitest";

import { AnalysisQueueProducer, analysisQueuePhysicalName } from "./analysis-queue-producer.js";

const envelope = {
  jobType: "analysis-criteria.process",
  jobVersion: 1,
  operationId: "50000000-0000-4000-8000-000000000001",
  correlationId: "50000000-0000-4000-8000-000000000002",
  scope: { organizationId: "50000000-0000-4000-8000-000000000003" },
  idempotencyKey: "analysis:producer",
  payload: {
    requestId: "50000000-0000-4000-8000-000000000001",
    payloadHash: "a".repeat(64),
    domainIdempotencyKey: "producer",
  },
} as const;

describe("AnalysisQueueProducer", () => {
  it("binds the versioned analysis job contract to its BullMQ-safe physical queue", () => {
    expect(analysisQueuePhysicalName()).toBe("analysis-criteria--v1");
  });

  it("adds to the dedicated queue contract without waiting for job completion", async () => {
    const waitUntilFinished = vi.fn();
    const queue = {
      add: vi.fn(async () => ({ id: envelope.operationId, waitUntilFinished })),
      close: vi.fn(async () => undefined),
    };
    const producer = new AnalysisQueueProducer(queue);

    await expect(producer.enqueue(envelope)).resolves.toBe(envelope.operationId);
    expect(queue.add).toHaveBeenCalledWith("analysis-criteria.process", envelope, {
      jobId: envelope.operationId,
      attempts: 3,
      backoff: { type: "bounded-exponential", delay: 25 },
      removeOnComplete: false,
      removeOnFail: false,
    });
    expect(waitUntilFinished).not.toHaveBeenCalled();
  });

  it("surfaces Redis delivery failure for retry while retaining operation identity", async () => {
    const queue = {
      add: vi.fn().mockRejectedValueOnce(new Error("redis unavailable")),
      close: vi.fn(async () => undefined),
    };
    const producer = new AnalysisQueueProducer(queue as never);

    await expect(producer.enqueue(envelope)).rejects.toThrow("redis unavailable");
    expect(queue.add).toHaveBeenCalledOnce();
  });
});
