import { firstValueFrom } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import { ExperienceStreamController } from "./experience-stream.controller.js";

const actorId = "10000000-0000-4000-8000-000000000001";

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
