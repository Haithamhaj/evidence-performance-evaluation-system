import { describe, expect, it, vi } from "vitest";

import { ExperienceStreamSession } from "./experience-stream-session.js";

const actorId = "10000000-0000-4000-8000-000000000001";

describe("ExperienceStreamSession", () => {
  it("replays authorized receipt cursors in order and never emits them twice", async () => {
    const listWhatChanged = vi
      .fn()
      .mockResolvedValueOnce({
        items: [receipt("2"), receipt("3")],
        nextCursor: "3",
      })
      .mockResolvedValueOnce({ items: [], nextCursor: "3" });
    const session = new ExperienceStreamSession({ listWhatChanged }, actorId, "1");

    await expect(session.read()).resolves.toEqual([
      { cursor: "2", data: { cursor: "2" }, event: "experience.changed" },
      { cursor: "3", data: { cursor: "3" }, event: "experience.changed" },
    ]);
    await expect(session.read()).resolves.toEqual([]);
    expect(listWhatChanged).toHaveBeenNthCalledWith(1, { actorId, afterCursor: "1" });
    expect(listWhatChanged).toHaveBeenNthCalledWith(2, { actorId, afterCursor: "3" });
  });

  it("keeps the authenticated actor boundary on every reconnect read", async () => {
    const listWhatChanged = vi.fn(async () => ({ items: [], nextCursor: null }));
    const session = new ExperienceStreamSession({ listWhatChanged }, actorId, null);

    await session.read();

    expect(listWhatChanged).toHaveBeenCalledWith({ actorId, afterCursor: null });
  });
});

function receipt(cursor: string) {
  return {
    receiptId: `20000000-0000-4000-8000-${cursor.padStart(12, "0")}`,
    cursor,
    type: "user.capture_submitted",
    source: "work_items",
    entityRefs: [],
    occurredAt: "2026-08-12T09:00:00.000Z",
    freshness: {},
    state: "delivered" as const,
  };
}
