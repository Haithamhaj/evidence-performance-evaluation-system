import { describe, expect, it } from "vitest";

import { COACHING_INSIGHT_TRUSTED_PROMPT, CoachingInsightAiOutputSchema } from "@evaluation/coaching-development";

describe("coaching insight AI contract", () => {
  it("requires citations and a non-rating limitation in its governed output", () => {
    expect(COACHING_INSIGHT_TRUSTED_PROMPT).toContain("do not produce a score, rank");
    expect(() => CoachingInsightAiOutputSchema.parse({ schemaVersion: "coaching-insight.v1", pattern: "A pattern", sourceIds: [], confidence: "SUPPORTED", confidenceBasis: "x", limitations: ["Cannot infer performance rating."], conflicts: [], cannotConclude: "Cannot infer performance rating.", actionDraft: null })).toThrow();
  });
});
