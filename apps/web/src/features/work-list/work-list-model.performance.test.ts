import { describe, expect, it } from "vitest";

import { buildWorkListModel } from "./work-list-model.js";

describe("buildWorkListModel representative fixtures", () => {
  it.each([50, 200, 1_000])("composes %i Tasks without changing their identity", (count) => {
    const items = Array.from({ length: count }, (_, index) => ({
      acceptanceConditions: [],
      allowedActions: [],
      allowedTransitions: [],
      assigneeId: "11111111-1111-4111-8111-111111111111",
      blocker: null,
      checklist: [],
      collaboratorIds: [],
      createdAt: "2026-08-13T08:00:00.000Z",
      description: `Description ${index}`,
      dueAt: null,
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      nextAction: null,
      priority: "normal" as const,
      projectId: "22222222-2222-4222-8222-222222222222",
      requirements: [],
      status: "ready" as const,
      title: `Task ${index + 1}`,
      updatedAt: "2026-08-13T08:00:00.000Z",
      version: 1,
      workstreamId: null,
    }));

    const started = performance.now();
    const result = buildWorkListModel({
      items,
      projects: [{ id: "22222222-2222-4222-8222-222222222222", name: "Codex Project" }],
      unknownProjectLabel: "Unknown Project",
    });
    const elapsed = performance.now() - started;

    expect(result).toHaveLength(count);
    expect(result.at(-1)?.item.id).toBe(items.at(-1)?.id);
    expect(elapsed).toBeLessThan(100);
  });
});
