import { describe, expect, it, vi } from "vitest";

import { ExperienceDeliveryQueueProducer } from "./experience-delivery-queue.js";

describe("ExperienceDeliveryQueueProducer", () => {
  it("enqueues a bounded idempotent wake-up without domain content", async () => {
    const add = vi.fn(async () => ({ id: "job" }));
    const producer = new ExperienceDeliveryQueueProducer({ add, close: vi.fn() } as never);
    const receiptId = "70000000-0000-4000-8000-000000000001";
    const correlationId = "70000000-0000-4000-8000-000000000002";

    await producer.enqueue({ receiptId, correlationId });

    expect(add).toHaveBeenCalledWith(
      "experience.deliver",
      { schemaVersion: 1, jobType: "experience.deliver", receiptId, correlationId },
      expect.objectContaining({ jobId: receiptId, attempts: 3 }),
    );
  });

  it("revives the stable completed or failed job before a queued receipt retry", async () => {
    const retry = vi.fn(async () => undefined);
    const remove = vi.fn(async () => undefined);
    const getJob = vi
      .fn()
      .mockResolvedValueOnce({ getState: async () => "failed", retry })
      .mockResolvedValueOnce({ getState: async () => "completed", remove });
    const add = vi.fn(async () => ({ id: "job" }));
    const producer = new ExperienceDeliveryQueueProducer({ add, close: vi.fn(), getJob } as never);
    const input = {
      receiptId: "70000000-0000-4000-8000-000000000001",
      correlationId: "70000000-0000-4000-8000-000000000002",
    };

    await producer.enqueue(input);
    await producer.enqueue(input);

    expect(retry).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(add).toHaveBeenCalledOnce();
  });
});
