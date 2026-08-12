import { describe, expect, it } from "vitest";

import { workWorkspaceEnabled } from "./work-workspace-flag.js";

describe("workWorkspaceEnabled", () => {
  it("uses the new Work list by default and retains an explicit legacy rollback", () => {
    expect(workWorkspaceEnabled({})).toBe(true);
    expect(workWorkspaceEnabled({ AI_NATIVE_WORK_WORKSPACE_ENABLED: "false" })).toBe(false);
  });
});
