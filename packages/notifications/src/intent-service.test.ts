import { describe, expect, it, vi } from "vitest";

import { NotificationIntentService } from "./intent-service.js";

const actorId = "11111111-1111-4111-8111-111111111111";
const intentId = "22222222-2222-4222-8222-222222222222";

describe("NotificationIntentService inbox lifecycle", () => {
  it("resolves only the recipient's delivered notification and records it read", async () => {
    const update = vi.fn(async () => ({ id: intentId }));
    const service = new NotificationIntentService(
      {
        notificationIntent: {
          findUnique: vi.fn(async () => ({
            id: intentId,
            recipientId: actorId,
            inAppState: "READY",
            deliverAfter: new Date("2026-08-15T07:00:00.000Z"),
            readAt: null,
            resolvedAt: null,
          })),
          update,
        },
      } as never,
      () => new Date("2026-08-15T08:00:00.000Z"),
    );

    await expect(service.resolve(intentId, actorId)).resolves.toEqual({ resolved: true });
    expect(update).toHaveBeenCalledWith({
      where: { id: intentId },
      data: {
        readAt: new Date("2026-08-15T08:00:00.000Z"),
        resolvedAt: new Date("2026-08-15T08:00:00.000Z"),
      },
    });
  });

  it("does not resolve another recipient's notification", async () => {
    const update = vi.fn();
    const service = new NotificationIntentService({
      notificationIntent: {
        findUnique: vi.fn(async () => ({
          id: intentId,
          recipientId: "33333333-3333-4333-8333-333333333333",
          inAppState: "READY",
          deliverAfter: new Date("2026-08-15T07:00:00.000Z"),
        })),
        update,
      },
    } as never);

    await expect(service.resolve(intentId, actorId)).resolves.toEqual({ resolved: false });
    expect(update).not.toHaveBeenCalled();
  });
});
