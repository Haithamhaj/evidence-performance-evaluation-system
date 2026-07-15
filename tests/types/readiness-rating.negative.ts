import {
  DocumentationReadinessSchema,
  PerformanceRatingSchema,
} from "../../packages/contracts/src/index.js";

const readiness = DocumentationReadinessSchema.parse({
  state: "ready",
  percentage: 100,
});

const rating = PerformanceRatingSchema.parse({
  criterionId: "PPB-01",
  rating: 3,
  evidenceReferences: ["evidence:example"],
});

const acceptsPerformanceRating = (
  _rating: import("../../packages/contracts/src/index.js").PerformanceRating,
): void => undefined;

acceptsPerformanceRating(rating);
// @ts-expect-error Documentation Readiness is deliberately not a Performance Rating.
acceptsPerformanceRating(readiness);
