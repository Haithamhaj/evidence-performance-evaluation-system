import { describe, expect, it } from "vitest";

import { continuityWorkspaceEnabled } from "./continuity-workspace-flag.js";

describe("continuityWorkspaceEnabled", () => {
  it("is default-on and can restore the retained technical route", () => {
    expect(continuityWorkspaceEnabled({})).toBe(true);
    expect(continuityWorkspaceEnabled({ AI_NATIVE_CONTINUITY_WORKSPACE_ENABLED: "false" })).toBe(
      false,
    );
  });
});
