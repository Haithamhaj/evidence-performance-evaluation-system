import { describe, expect, it } from "vitest";

import {
  CoachingInsightDecisionSchema,
  CoachingInsightSchema,
  DevelopmentActionSchema,
  FormalPlanStateSchema,
} from "./coaching-development.js";

const employeeId = "10000000-0000-4000-8000-000000000001";
const insightId = "10000000-0000-4000-8000-000000000002";

describe("coaching and development contracts", () => {
  it("models employee decisions and formal-plan states without rating semantics", () => {
    expect(CoachingInsightDecisionSchema.parse("EDIT_AND_ACCEPT")).toBe("EDIT_AND_ACCEPT");
    expect(FormalPlanStateSchema.parse("MANAGER_AGREED")).toBe("MANAGER_AGREED");
  });

  it("rejects rating-shaped insight output", () => {
    const validInsight = {
      schemaVersion: 1,
      id: insightId,
      employeeId,
      state: "DRAFT",
      pattern: "Two source-supported blockers were recorded during the period.",
      period: { startsAt: "2026-07-01T00:00:00Z", endsAt: "2026-08-01T00:00:00Z" },
      sources: [{ sourceId: "20000000-0000-4000-8000-000000000001", kind: "EVIDENCE" }],
      confidence: "REVIEW_REQUIRED",
      confidenceBasis: "Sources disagree about the cause.",
      limitations: ["Cannot infer performance rating."],
      cannotConclude: "Cannot infer performance rating.",
      version: 1,
      createdAt: "2026-08-01T00:00:00Z",
    } as const;
    expect(CoachingInsightSchema.parse(validInsight)).toEqual(validInsight);
    expect(() => CoachingInsightSchema.parse({ ...validInsight, predictedRating: 4 })).toThrow();
  });

  it("keeps private action data separate from manager fields", () => {
    const validAction = {
      schemaVersion: 1,
      id: "30000000-0000-4000-8000-000000000001",
      employeeId,
      title: "Document one blocker-resolution approach",
      objective: "Make the next blocker response easier to review.",
      expectedBenefit: "A repeatable development practice.",
      activity: "Record the decision and result after the next relevant blocker.",
      completionEvidenceDefinition: "A confirmed evidence link chosen by the employee.",
      targetDate: "2026-09-01T00:00:00Z",
      privacy: "PRIVATE",
      state: "DRAFT",
      version: 1,
    } as const;
    expect(DevelopmentActionSchema.parse(validAction)).toEqual(validAction);
    expect(() => DevelopmentActionSchema.parse({ ...validAction, managerNotes: "x" })).toThrow();
  });
});
