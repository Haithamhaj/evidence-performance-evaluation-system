import { describe, expect, it } from "vitest";

import { buildWorkGroupModel, buildWorkListModel } from "./work-list-model.js";

describe("buildWorkListModel", () => {
  it("keeps the authorized reader order and resolves Project display names", () => {
    const first = { id: crypto.randomUUID(), projectId: crypto.randomUUID(), title: "First" };
    const second = { id: crypto.randomUUID(), projectId: crypto.randomUUID(), title: "Second" };

    expect(
      buildWorkListModel({
        items: [first, second],
        projects: [{ id: first.projectId, name: "Atlas" }],
        unknownProjectLabel: "Project unavailable",
      }),
    ).toEqual([
      { item: first, projectName: "Atlas" },
      { item: second, projectName: "Project unavailable" },
    ]);
  });

  it("builds the approved daily hierarchy without duplicating a Task", () => {
    const projectId = crypto.randomUUID();
    const task = (title: string, status = "ready") => ({
      id: crypto.randomUUID(),
      projectId,
      status,
      title,
    });
    const decision = task("Decision");
    const today = task("Today");
    const overdue = task("Overdue");
    const blocked = task("Waiting", "blocked");
    const upcoming = task("Upcoming", "planned");
    const groups = buildWorkGroupModel({
      items: [decision, today, overdue, blocked, upcoming],
      projects: [{ id: projectId, name: "Atlas" }],
      snapshot: {
        needsMyAction: [decision],
        today: [decision, today],
        overdue: [overdue],
        upcoming: [upcoming],
      },
      unknownProjectLabel: "Unknown",
    });
    expect(groups.map(({ key }) => key)).toEqual([
      "needs_my_action",
      "today",
      "overdue",
      "waiting_blocked",
      "upcoming",
    ]);
    expect(groups.slice(0, 3).every(({ collapsed }) => !collapsed)).toBe(true);
    expect(groups.slice(3).every(({ collapsed }) => collapsed)).toBe(true);
    expect(groups.flatMap(({ items }) => items.map(({ item }) => item.id))).toHaveLength(5);
  });
});
