import { describe, expect, it } from "vitest";

import {
  assertWorkItemScope,
  assertWorkItemTransition,
  getAllowedWorkItemTransitions,
} from "./invariants.js";

describe("work item invariants", () => {
  it("publishes the same authoritative next states used by transition validation", () => {
    expect(getAllowedWorkItemTransitions("planned")).toEqual(["ready", "cancelled"]);
    expect(getAllowedWorkItemTransitions("done")).toEqual([]);
  });

  it("requires a Project and a Workstream from the same Project", () => {
    expect(() =>
      assertWorkItemScope({
        projectId: "project-1",
        workstream: { id: "workstream-1", projectId: "project-2" },
      }),
    ).toThrowError("WORK_ITEM_SCOPE_MISMATCH");
    expect(() =>
      assertWorkItemScope({
        projectId: "project-1",
        workstream: { id: "workstream-1", projectId: "project-1" },
      }),
    ).not.toThrow();
  });

  it.each([
    ["planned", "ready"],
    ["ready", "in_progress"],
    ["in_progress", "blocked"],
    ["blocked", "in_progress"],
    ["in_progress", "in_review"],
    ["in_review", "done"],
  ] as const)("allows %s → %s", (from, to) => {
    expect(() => assertWorkItemTransition(from, to)).not.toThrow();
  });

  it.each([
    ["planned", "done"],
    ["done", "in_progress"],
    ["cancelled", "ready"],
    ["blocked", "done"],
  ] as const)("rejects %s → %s", (from, to) => {
    expect(() => assertWorkItemTransition(from, to)).toThrowError("WORK_ITEM_STATE_INVALID");
  });
});
