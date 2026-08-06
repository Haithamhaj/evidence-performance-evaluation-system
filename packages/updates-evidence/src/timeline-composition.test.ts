import { describe, expect, it, vi } from "vitest";

import { ActivityReader } from "./activity-reader.js";

const actorId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";

describe("research timeline composition", () => {
  it("merges meaningful rows once with a stable final cursor", async () => {
    const existing = [
      item("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "update", "2026-08-05T10:00:00.000Z"),
    ];
    const research = [
      item("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "research", "2026-08-05T11:00:00.000Z"),
      item("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "experiment", "2026-08-05T09:00:00.000Z"),
    ];
    const reader = new ActivityReader(
      {
        project: { findFirst: vi.fn(async () => ({ id: projectId })) },
        $queryRaw: vi.fn(async () => existing),
      } as never,
      { readTimeline: vi.fn(async () => research) },
    );

    const page = await reader.timeline({
      actorId,
      projectId,
      workstreamId: null,
      limit: 2,
      cursor: null,
    });

    expect(page.items.map(({ id }) => id)).toEqual([research[0]!.id, existing[0]!.id]);
    expect(page.nextCursor).not.toBeNull();
    expect(JSON.stringify(page)).not.toMatch(/ai_draft|autosave/iu);
  });
});

function item(id: string, kind: "update" | "research" | "experiment", occurredAt: string) {
  return {
    id,
    kind,
    projectId,
    workstreamId: null,
    workItemId: null,
    employeeId: actorId,
    occurredAt,
    title: "Meaningful event",
    detail: "Human-confirmed source",
    sourceReferences: [`${kind}:${id}`],
    sourceProvenance: "human_decision" as const,
    reviewState: "human_decision" as const,
    project: { id: projectId, name: "Atlas" },
    workstream: null,
    workItem: null,
    relatedKpiComponents: [],
    relatedCriteria: [],
    verificationState: null,
    decisionOutcome: null,
  };
}
