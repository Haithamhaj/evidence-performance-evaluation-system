import { describe, expect, it } from "vitest";

import { workItems } from "./mock-data";
import { groupMyWork, projectProgress } from "./screen-logic";

describe("daily work screen logic", () => {
  it("groups work without duplicating items across date sections", () => {
    const grouped = groupMyWork(workItems, "2026-07-18");
    const ids = [
      ...grouped.needsAction,
      ...grouped.overdue,
      ...grouped.today,
      ...grouped.thisWeek,
      ...grouped.blocked,
      ...grouped.reviews,
      ...grouped.noDueDate,
    ].map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(grouped.overdue.some((item) => item.id === "wi-108")).toBe(true);
    expect(grouped.today.some((item) => item.id === "wi-104")).toBe(true);
    expect(grouped.blocked.some((item) => item.id === "wi-115")).toBe(true);
  });

  it("reports delivery progress as work completion, never employee performance", () => {
    const progress = projectProgress(workItems, "project-nabd");

    expect(progress.total).toBe(10);
    expect(progress.completed).toBe(1);
    expect(progress.percent).toBe(10);
  });
});
