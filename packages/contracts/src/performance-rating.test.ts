import { describe, expect, it } from "vitest";

import { PERFORMANCE_RATING_CRITERION_IDS, PerformanceRatingSchema } from "./performance-rating.js";

describe("PerformanceRatingSchema", () => {
  it("accepts only the exact Version 1 stable criterion IDs", () => {
    expect(PERFORMANCE_RATING_CRITERION_IDS).toHaveLength(18);
    for (const criterionId of PERFORMANCE_RATING_CRITERION_IDS) {
      expect(
        PerformanceRatingSchema.safeParse({
          criterionId,
          rating: 3,
          evidenceReferences: ["evidence:example"],
        }).success,
      ).toBe(true);
    }

    for (const criterionId of ["PPB-99", "MGR-99"]) {
      expect(
        PerformanceRatingSchema.safeParse({
          criterionId,
          rating: 3,
          evidenceReferences: ["evidence:example"],
        }).success,
      ).toBe(false);
    }
  });
});
