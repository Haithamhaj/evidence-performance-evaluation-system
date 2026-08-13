import { describe, expect, it } from "vitest";

import {
  finalCaptureEnabled,
  finalHomeEnabled,
  finalProjectEnabled,
  finalReviewEnabled,
  finalWorkEnabled,
} from "./final-experience-flags.js";

describe("final employee experience rollback flags", () => {
  it("keeps every approved surface enabled by default", () => {
    expect(finalHomeEnabled({})).toBe(true);
    expect(finalProjectEnabled({})).toBe(true);
    expect(finalWorkEnabled({})).toBe(true);
    expect(finalCaptureEnabled({})).toBe(true);
    expect(finalReviewEnabled({})).toBe(true);
  });

  it("restores each retained surface independently with an explicit false value", () => {
    expect(finalHomeEnabled({ AI_NATIVE_FINAL_HOME_ENABLED: "false" })).toBe(false);
    expect(finalProjectEnabled({ AI_NATIVE_FINAL_PROJECT_ENABLED: " FALSE " })).toBe(false);
    expect(finalWorkEnabled({ AI_NATIVE_FINAL_WORK_ENABLED: "false" })).toBe(false);
    expect(finalCaptureEnabled({ AI_NATIVE_FINAL_CAPTURE_ENABLED: "False" })).toBe(false);
    expect(finalReviewEnabled({ AI_NATIVE_FINAL_REVIEW_ENABLED: " false " })).toBe(false);
  });

  it("does not disable a surface for an unknown configuration value", () => {
    expect(finalHomeEnabled({ AI_NATIVE_FINAL_HOME_ENABLED: "off" })).toBe(true);
  });
});
