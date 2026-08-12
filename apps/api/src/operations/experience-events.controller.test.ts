import { describe, expect, it, vi } from "vitest";

import { ExperienceEventsController } from "./experience-events.controller.js";

const actorId = "60000000-0000-4000-8000-000000000001";
const receiptId = "60000000-0000-4000-8000-000000000002";

describe("ExperienceEventsController", () => {
  it("derives the What Changed recipient from the authenticated principal", async () => {
    const listWhatChanged = vi.fn(async () => ({ items: [], nextCursor: null }));
    const controller = new ExperienceEventsController({ listWhatChanged } as never);

    await controller.list({ principal: { userId: actorId, active: true } } as never, {
      afterCursor: "7",
      recipientId: "60000000-0000-4000-8000-000000000099",
    });

    expect(listWhatChanged).toHaveBeenCalledWith({ actorId, afterCursor: "7" });
  });

  it("denies inactive sessions and preserves server ownership on acknowledgement", async () => {
    const acknowledge = vi.fn(async () => ({ receiptId, state: "acknowledged" }));
    const controller = new ExperienceEventsController({ acknowledge } as never);

    expect(() =>
      controller.acknowledge({ principal: { userId: actorId, active: false } } as never, receiptId),
    ).toThrowError("AUTH_INACTIVE_USER");
    expect(acknowledge).not.toHaveBeenCalled();

    await controller.acknowledge(
      { principal: { userId: actorId, active: true } } as never,
      receiptId,
    );
    expect(acknowledge).toHaveBeenCalledWith({ actorId, receiptId });
  });
});
