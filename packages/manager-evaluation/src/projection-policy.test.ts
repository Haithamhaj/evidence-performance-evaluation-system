import { describe, expect, it } from "vitest";

import { createProjectionPolicy } from "./projection-policy.js";

describe("manager evaluation projection policy", () => {
  it("enables only the truthful IDENTIFIED pilot projection", () => {
    expect(createProjectionPolicy("IDENTIFIED")).toMatchObject({ mode: "IDENTIFIED" });
    expect(() => createProjectionPolicy("MANAGER_BLINDED")).toThrowError(
      expect.objectContaining({ code: "MANAGER_EVALUATION_VISIBILITY_DISABLED" }),
    );
    expect(() => createProjectionPolicy("ANONYMOUS_AGGREGATED")).toThrowError(
      expect.objectContaining({ code: "MANAGER_EVALUATION_VISIBILITY_DISABLED" }),
    );
  });
});
