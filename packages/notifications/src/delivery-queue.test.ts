import { describe, expect, it, vi } from "vitest";

import { BullNotificationDeliveryQueue } from "./delivery-queue.js";

describe("BullNotificationDeliveryQueue", () => {
  it("schedules delivery at deliverAfter instead of making future intent immediately visible", async () => {
    const add = vi.fn().mockResolvedValue({ id: "job" });
    const queue = new BullNotificationDeliveryQueue({ add, close: async () => undefined });
    const deliverAfter = new Date(Date.now() + 30_000);
    await queue.enqueue(
      {
        intentId: "10000000-0000-4000-8000-000000000001",
        correlationId: "10000000-0000-4000-8000-000000000002",
      },
      { deliverAfter },
    );
    expect(add.mock.calls[0]?.[2]).toMatchObject({ delay: expect.any(Number) });
    expect((add.mock.calls[0]?.[2] as { delay: number }).delay).toBeGreaterThan(0);
  });
});
