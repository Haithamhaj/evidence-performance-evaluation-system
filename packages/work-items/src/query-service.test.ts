import { describe, expect, it, vi } from "vitest";

import { WorkItemQueryService } from "./query-service.js";

function item(input: Readonly<{ dueAt: Date; id: string }>) {
  return {
    id: input.id,
    projectId: crypto.randomUUID(),
    workstreamId: null,
    title: input.id,
    description: "Description",
    status: "in_progress" as const,
    priority: "normal" as const,
    assigneeId: crypto.randomUUID(),
    dueAt: input.dueAt,
    requirements: [],
    acceptanceConditions: [],
    blocker: null,
    nextAction: null,
    version: 1,
    createdAt: new Date("2026-07-18T10:00:00.000Z"),
    updatedAt: new Date("2026-07-18T10:00:00.000Z"),
  };
}

describe("WorkItemQueryService", () => {
  it("returns authorized Work Item choices without making one mandatory", async () => {
    const row = item({
      id: crypto.randomUUID(),
      dueAt: new Date("2026-07-20T10:00:00.000Z"),
    });
    const database = {
      workItem: {
        findMany: vi.fn(async () => [row]),
      },
    };
    const service = new WorkItemQueryService(database as never);

    await expect(service.listUpdatable({ actorId: row.assigneeId })).resolves.toEqual([
      {
        id: row.id,
        projectId: row.projectId,
        workstreamId: null,
        title: row.title,
      },
    ]);
  });

  it("groups Today in the pilot timezone rather than by the UTC calendar date", async () => {
    const rows = [
      item({
        id: crypto.randomUUID(),
        dueAt: new Date("2026-07-18T22:00:00.000Z"),
      }),
    ];
    const database = {
      workItem: {
        findMany: vi.fn(async () => rows),
      },
    };
    const service = new WorkItemQueryService(
      database as never,
      () => new Date("2026-07-18T20:30:00.000Z"),
    );

    const result = await service.listMyWork({ actorId: crypto.randomUUID() });

    expect(result.groups.find(({ key }) => key === "today")?.items).toEqual([]);
    expect(result.groups.find(({ key }) => key === "this_week")?.items).toHaveLength(1);
  });
});
