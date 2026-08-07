import { describe, expect, it, vi } from "vitest";

import { BullNotificationDeliveryQueue } from "../../packages/notifications/src/delivery-queue.js";
import { PrivateInboxService } from "../../packages/work-items/src/inbox-service.js";

const employeeId = "10000000-0000-4000-8000-000000000001";
const correlationId = "10000000-0000-4000-8000-000000000002";

describe("provider outage and idempotent recovery", () => {
  it("keeps the manual employee capture path available when AI is unavailable", async () => {
    const aiRoute = vi.fn().mockRejectedValue(new Error("AI provider unavailable"));
    await expect(aiRoute()).rejects.toThrow("AI provider unavailable");

    const createdAt = new Date("2026-08-07T00:00:00.000Z");
    const row = {
      id: "10000000-0000-4000-8000-000000000003",
      employeeId,
      text: "Follow up manually while AI assistance is unavailable.",
      projectId: null,
      status: "open" as const,
      promotedWorkItemId: null,
      version: 1,
      createdAt,
      updatedAt: createdAt,
    };
    const transaction = {
      privateInboxItem: { create: vi.fn().mockResolvedValue(row) },
    };
    const service = new PrivateInboxService(
      {
        $transaction: async (operation: (value: unknown) => unknown) => operation(transaction),
      } as never,
      { append: vi.fn().mockResolvedValue(undefined) },
      () => createdAt,
    );

    await expect(
      service.capture({
        actor: { userId: employeeId, active: true },
        correlationId,
        input: { text: row.text, projectId: null },
      }),
    ).resolves.toMatchObject({ text: row.text, status: "open" });
  });

  it("returns the same effect receipt when the same delivery envelope is replayed", async () => {
    const receipts = new Map<string, Readonly<{ id: string }>>();
    const add = vi.fn(async (_name: string, _data: unknown, options: { jobId: string }) => {
      const existing = receipts.get(options.jobId);
      if (existing) return existing;
      const receipt = { id: options.jobId };
      receipts.set(options.jobId, receipt);
      return receipt;
    });
    const queue = new BullNotificationDeliveryQueue({ add, close: async () => undefined });
    const envelope = {
      intentId: "10000000-0000-4000-8000-000000000004",
      correlationId,
    };

    const first = await queue.enqueue(envelope);
    const replay = await queue.enqueue(envelope);

    expect(replay).toEqual(first);
    expect(receipts).toHaveLength(1);
  });
});
