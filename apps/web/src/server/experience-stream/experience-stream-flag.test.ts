import { describe, expect, it } from "vitest";

import { experienceStreamEnabled } from "./experience-stream-flag.js";

describe("experienceStreamEnabled", () => {
  it("keeps live receipts on by default with an explicit-refresh rollback", () => {
    expect(experienceStreamEnabled({})).toBe(true);
    expect(experienceStreamEnabled({ AI_NATIVE_EXPERIENCE_STREAM_ENABLED: "false" })).toBe(false);
  });
});
