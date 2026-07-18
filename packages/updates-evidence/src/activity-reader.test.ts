import { describe, expect, it, vi } from "vitest";

import { ActivityReader } from "./activity-reader.js";

const actorId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const workstreamId = "33333333-3333-4333-8333-333333333333";

describe("ActivityReader", () => {
  it("includes workstream events in the Project timeline and paginates stably", async () => {
    const firstPage = [
      timelineItem("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "update", "2026-07-18T12:00:00.000Z"),
      timelineItem(
        "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        "evidence",
        "2026-07-18T11:00:00.000Z",
      ),
    ];
    const secondPage = [
      timelineItem("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "update", "2026-07-18T10:00:00.000Z"),
    ];
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage);
    const reader = new ActivityReader(
      {
        project: { findFirst: vi.fn(async () => ({ id: projectId })) },
        $queryRaw: queryRaw,
      } as never,
    );

    const first = await reader.timeline({
      actorId,
      projectId,
      workstreamId: null,
      limit: 2,
      cursor: null,
    });

    expect(first.items.map((item) => item.kind)).toEqual(["update", "evidence"]);
    expect(first.items[0]).toMatchObject({ workstreamId });
    expect(first.nextCursor).not.toBeNull();

    const second = await reader.timeline({
      actorId,
      projectId,
      workstreamId: null,
      limit: 2,
      cursor: first.nextCursor,
    });
    expect(second.items).toHaveLength(1);
    expect(second.items[0]).toMatchObject({ id: secondPage[0]!.id });
    expect(second.nextCursor).toBeNull();
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it("rejects a Project timeline outside the viewer's authorized scope", async () => {
    const reader = new ActivityReader({
      project: { findFirst: vi.fn(async () => null) },
      $queryRaw: vi.fn(),
    } as never);

    await expect(
      reader.timeline({ actorId, projectId, workstreamId: null, limit: 20, cursor: null }),
    ).rejects.toMatchObject({ code: "SCOPE_MISMATCH", status: 403 });
  });
});

function timelineItem(
  id: string,
  kind: "update" | "evidence",
  occurredAt: string,
) {
  return {
    id,
    kind,
    projectId,
    workstreamId,
    workItemId: null,
    employeeId: actorId,
    occurredAt,
    title: kind === "update" ? "تحديث" : "دليل",
    detail: kind === "update" ? "نتيجة التحديث" : "سياق المساهمة",
    sourceReferences: [`${kind === "update" ? "update-source" : "evidence"}:${id}`],
  };
}
