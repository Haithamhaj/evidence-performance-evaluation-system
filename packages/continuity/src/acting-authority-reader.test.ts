import { describe, expect, it } from "vitest";

import { ActingAuthorityReader } from "./acting-authority-reader.js";

const projectId = "20000000-0000-4000-8000-000000000001";
const actorId = "20000000-0000-4000-8000-000000000002";

describe("ActingAuthorityReader", () => {
  const reader = new ActingAuthorityReader({
    findActiveCandidates: async () => [
      {
        delegationId: "20000000-0000-4000-8000-000000000003",
        actorId,
        scopeType: "project",
        scopeId: projectId,
        action: "project.update",
        startsAt: "2026-08-10T08:00:00.000Z",
        endsAt: "2026-08-10T10:00:00.000Z",
      },
    ],
  });

  it("allows only the exact action and scope inside a half-open interval", async () => {
    expect(
      await reader.readAt({
        actorId,
        action: "project.update",
        resourceId: projectId,
        occurredAt: "2026-08-10T08:00:00.000Z",
      }),
    ).not.toBeNull();
    expect(
      await reader.readAt({
        actorId,
        action: "project.document.update",
        resourceId: projectId,
        occurredAt: "2026-08-10T09:00:00.000Z",
      }),
    ).toBeNull();
    expect(
      await reader.readAt({
        actorId,
        action: "project.update",
        resourceId: "20000000-0000-4000-8000-000000000009",
        occurredAt: "2026-08-10T09:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("fails closed at the exact end time even for a stale session", async () => {
    expect(
      await reader.readAt({
        actorId,
        action: "project.update",
        resourceId: projectId,
        occurredAt: "2026-08-10T10:00:00.000Z",
      }),
    ).toBeNull();
  });
});
