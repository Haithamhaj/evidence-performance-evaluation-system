import { describe, expect, it } from "vitest";

import { buildWorkListModel } from "./work-list-model.js";

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
});
