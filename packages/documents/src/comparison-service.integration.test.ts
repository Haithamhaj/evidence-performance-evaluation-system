import { describe, expect, it } from "vitest";

import { effectiveClassification } from "./comparison-service.js";

describe("ComparisonService human review", () => {
  it("confirms or corrects only the approved material classification", () => {
    expect(
      effectiveClassification("editorial", { action: "confirm", reason: "Reviewed source diff" }),
    ).toBe("editorial");
    expect(
      effectiveClassification("editorial", {
        action: "correct",
        classification: "material_scope_or_goal_change",
        reason: "Scope changed",
      }),
    ).toBe("material_scope_or_goal_change");
  });
});
