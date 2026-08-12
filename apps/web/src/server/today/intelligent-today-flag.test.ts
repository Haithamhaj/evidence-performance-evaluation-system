import { describe, expect, it } from "vitest";

import {
  intelligentTodayEnabled,
  intelligentTodayEnabledForRoles,
} from "./intelligent-today-flag.js";

describe("Intelligent Today rollback flag", () => {
  it("keeps the new route enabled by default and restores the retained My Work view when disabled", () => {
    expect(intelligentTodayEnabled({})).toBe(true);
    expect(intelligentTodayEnabled({ AI_NATIVE_INTELLIGENT_TODAY_ENABLED: "false" })).toBe(false);
  });

  it("keeps the employee daily assistant out of manager and administrator workspaces", () => {
    expect(intelligentTodayEnabledForRoles([], {})).toBe(true);
    expect(intelligentTodayEnabledForRoles(["manager"], {})).toBe(false);
    expect(intelligentTodayEnabledForRoles(["system_administrator"], {})).toBe(false);
  });
});
