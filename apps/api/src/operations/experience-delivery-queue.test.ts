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
});
