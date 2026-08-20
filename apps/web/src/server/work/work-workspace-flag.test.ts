import { describe, expect, it } from "vitest";

import { workWorkspaceEnabled } from "./work-workspace-flag.js";
import { buildTasksPageState } from "./tasks-page-state.js";

describe("workWorkspaceEnabled", () => {
  it("uses the new Work list by default and retains an explicit legacy rollback", () => {
    expect(workWorkspaceEnabled({})).toBe(true);
    expect(workWorkspaceEnabled({ AI_NATIVE_WORK_WORKSPACE_ENABLED: "false" })).toBe(false);
  });
});

describe("tasks page state", () => {
  it("keeps validated search, Project, status, and sort state in the URL", () => {
    expect(
      buildTasksPageState("en", {
        layout: "list",
        project: "22222222-2222-4222-8222-222222222222",
        q: " API fallback ",
        sort: "updated_desc",
        status: "blocked",
        view: "my",
      }),
    ).toMatchObject({
      projectId: "22222222-2222-4222-8222-222222222222",
      search: "API fallback",
      sort: "updated_desc",
      status: "blocked",
    });
  });
});
