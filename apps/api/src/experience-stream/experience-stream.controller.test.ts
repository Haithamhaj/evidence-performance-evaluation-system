import { firstValueFrom } from "rxjs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExperienceStreamController } from "./experience-stream.controller.js";

const actorId = "10000000-0000-4000-8000-000000000001";

afterEach(() => vi.useRealTimers());

describe("ExperienceStreamController", () => {
  it("emits a content-free wake-up for the authenticated recipient cursor", async () => {
    const listWhatChanged = vi.fn(async () => ({
      items: [
        {
          cursor: "8",
          receiptId: "20000000-0000-4000-8000-000000000008",
          type: "user.capture_submitted",
          source: "work_items",
          entityRefs: [],
          occurredAt: "2026-08-12T09:00:00.000Z",
          freshness: {},
          state: "delivered" as const,
        },
      ],
      nextCursor: "8",
    }));
    const controller = new ExperienceStreamController({ listWhatChanged } as never);

    await expect(
      firstValueFrom(controller.stream(activeRequest(), { afterCursor: "7" })),
    ).resolves.toEqual({
      data: { cursor: "8" },
      id: "8",
      type: "experience.changed",
    });
    expect(listWhatChanged).toHaveBeenCalledWith({ actorId, afterCursor: "7" });
  });

  it("rejects an inactive authenticated principal before opening the stream", () => {
    const controller = new ExperienceStreamController({ listWhatChanged: vi.fn() } as never);

    expect(() =>
      controller.stream({ principal: { ...activeRequest().principal, active: false } }, {}),
    ).toThrowError(expect.objectContaining({ code: "AUTH_INACTIVE_USER", status: 403 }));
  });

  it("ends a live connection so the next request revalidates token and active-user state", async () => {
    vi.useFakeTimers();
    const controller = new ExperienceStreamController({
      listWhatChanged: vi.fn(async () => ({ items: [], nextCursor: null })),
    } as never);
    const completed = vi.fn();

    controller.stream(activeRequest(), {}).subscribe({ complete: completed });
    await vi.advanceTimersByTimeAsync(30_000);

    expect(completed).toHaveBeenCalledOnce();
  });

  it("drops polling ticks while the durable reader is still in flight", async () => {
    vi.useFakeTimers();
    let resolveRead!: (value: { items: never[]; nextCursor: null }) => void;
    const listWhatChanged = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveRead = resolve as typeof resolveRead)),
      )
      .mockResolvedValue({ items: [], nextCursor: null });
    const controller = new ExperienceStreamController({ listWhatChanged } as never);
    const subscription = controller.stream(activeRequest(), {}).subscribe();

    await vi.advanceTimersByTimeAsync(6_000);
    expect(listWhatChanged).toHaveBeenCalledOnce();

    resolveRead({ items: [], nextCursor: null });
    await Promise.resolve();
    expect(listWhatChanged).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1_500);
    expect(listWhatChanged).toHaveBeenCalledTimes(2);
    subscription.unsubscribe();
  });
});

function activeRequest() {
  return {
    principal: {
      active: true,
      email: "employee@example.test",
      oidcSubject: "employee-subject",
      roles: ["employee"],
      userId: actorId,
    },
  };
}
