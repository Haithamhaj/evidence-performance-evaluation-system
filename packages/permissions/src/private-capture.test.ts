import { describe, expect, it } from "vitest";

import { canUsePrivateCapture } from "./private-capture.js";

describe("private capture authorization", () => {
  it.each([["manager"], ["system_administrator"], ["manager", "system_administrator"]])(
    "denies active non-employee roles %j",
    (...roles) => {
      expect(canUsePrivateCapture({ active: true, roles })).toBe(false);
    },
  );

  it.each([["employee"], ["contributor"], ["manager", "employee"]])(
    "allows active employee or contributor context %j",
    (...roles) => {
      expect(canUsePrivateCapture({ active: true, roles })).toBe(true);
    },
  );

  it("denies inactive employees", () => {
    expect(canUsePrivateCapture({ active: false, roles: ["employee"] })).toBe(false);
  });
});
