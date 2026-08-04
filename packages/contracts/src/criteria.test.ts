import { describe, expect, it } from "vitest";

import {
  ActivateCriteriaSchema,
  CriteriaGenerationOutputSchema,
  OwnerReviewCriteriaSchema,
  RespondToCriteriaSchema,
  ResolveCriteriaObjectionsSchema,
  ReviseCriteriaSchema,
} from "./criteria.js";

const criterion = {
  name: "Integrated result",
  selectionReason: "Matches the documented success definition",
  successLink: "Definition of success",
  expectedBehaviorOrResult: "The integrated output meets the agreed acceptance condition",
  evaluationMethod: "Review the documented acceptance result",
  suggestedEvidence: ["Acceptance record"],
  sourceReferences: ["document-version:00000000-0000-4000-8000-000000000001"],
};

describe("dynamic criteria contracts", () => {
  it("allows only the seven approved criterion fields", () => {
    expect(CriteriaGenerationOutputSchema.parse({ criteria: [criterion] })).toEqual({
      criteria: [criterion],
    });
    for (const forbidden of [
      "suggestedRating",
      "predictedRating",
      "recommendedRating",
      "employeeRank",
      "productivityScore",
      "performanceScore",
      "average",
    ]) {
      expect(() =>
        CriteriaGenerationOutputSchema.parse({
          criteria: [{ ...criterion, [forbidden]: 5 }],
        }),
      ).toThrow();
    }
    expect(() =>
      CriteriaGenerationOutputSchema.parse({
        criteria: [{ ...criterion, name: `${criterion.name} ` }],
      }),
    ).toThrow();
    expect(
      CriteriaGenerationOutputSchema.parse({
        criteria: [
          {
            ...criterion,
            name: "تكامل API الداخلي",
            expectedBehaviorOrResult: "يعمل المسار /repo/src مع توثيق English واضح",
          },
        ],
      }),
    ).toMatchObject({ criteria: [{ name: "تكامل API الداخلي" }] });
  });

  it("enforces the shared one-to-three output envelope", () => {
    expect(() => CriteriaGenerationOutputSchema.parse({ criteria: [] })).toThrow();
    expect(() =>
      CriteriaGenerationOutputSchema.parse({
        criteria: [criterion, criterion, criterion, criterion],
      }),
    ).toThrow();
  });

  it("keeps owner feedback separate from stored criterion content", () => {
    expect(
      OwnerReviewCriteriaSchema.parse({
        action: "request_correction",
        reason: "The source relationship needs correction.",
        feedback: "Use the cited success section.",
      }),
    ).toMatchObject({ action: "request_correction" });
    expect(() =>
      OwnerReviewCriteriaSchema.parse({
        action: "approve",
        reason: "Approved as written.",
        feedback: "Mutate the stored item.",
      }),
    ).toThrow();
    expect(() =>
      OwnerReviewCriteriaSchema.parse({
        action: "approve",
        reason: "Approved as written.",
        criteria: [criterion],
      }),
    ).toThrow();
  });

  it("requires an objection reason and makes acknowledgment content-free", () => {
    expect(RespondToCriteriaSchema.parse({ action: "acknowledge" })).toEqual({
      action: "acknowledge",
    });
    expect(() => RespondToCriteriaSchema.parse({ action: "object" })).toThrow();
    expect(
      RespondToCriteriaSchema.parse({
        action: "object",
        reason: "The dependency is outside the workstream boundary.",
      }),
    ).toMatchObject({ action: "object" });
  });

  it("limits manager resolution to the two approved choices with no content path", () => {
    expect(
      ResolveCriteriaObjectionsSchema.parse({
        decision: "accept_with_objections",
        reason: "Proceed while retaining the objections.",
      }),
    ).toMatchObject({ decision: "accept_with_objections" });
    expect(() =>
      ResolveCriteriaObjectionsSchema.parse({
        decision: "accept_with_objections",
        reason: "Proceed while retaining the objections.",
        criteria: [criterion],
      }),
    ).toThrow();
    expect(() =>
      ResolveCriteriaObjectionsSchema.parse({
        decision: "approve_and_edit",
        reason: "Not an approved decision.",
      }),
    ).toThrow();
  });

  it("accepts only prospective activation and reviewed-comparison revision inputs", () => {
    expect(
      ActivateCriteriaSchema.parse({
        expectedProposalVersion: 2,
        effectiveFrom: "2026-07-18T00:00:00.000Z",
        reason: "Activate after final approval.",
      }),
    ).toMatchObject({ expectedProposalVersion: 2 });
    expect(
      ReviseCriteriaSchema.parse({
        comparisonReviewId: "00000000-0000-4000-8000-000000000002",
        reason: "The material scope change was confirmed.",
      }),
    ).toMatchObject({
      comparisonReviewId: "00000000-0000-4000-8000-000000000002",
    });
    expect(() =>
      ActivateCriteriaSchema.parse({
        expectedProposalVersion: 2,
        effectiveFrom: "2026-07-18T00:00:00.000Z",
        reason: "Activate after final approval.",
        rating: 5,
      }),
    ).toThrow();
  });
});
