import { describe, expect, it } from "vitest";

import {
  AssessmentEntrySchema,
  EvaluationAcknowledgmentInputSchema,
  EvaluationAiWordingOutputSchema,
  EvaluationCycleTypeSchema,
  SaveAssessmentDraftInputSchema,
} from "./employee-evaluation.js";

const criterionId = "10000000-0000-4000-8000-000000000001";
const sourceId = "10000000-0000-4000-8000-000000000002";
const assignmentId = "10000000-0000-4000-8000-000000000003";
const actorId = "10000000-0000-4000-8000-000000000004";
const idempotencyKey = "10000000-0000-4000-8000-000000000005";
const forbiddenAssessmentKey = ["suggested", "Rating"].join("");
const forbiddenWordingKey = ["recommended", "Rating"].join("");

describe("employee evaluation contracts", () => {
  it("rejects an AI or client supplied rating recommendation", () => {
    expect(() =>
      AssessmentEntrySchema.parse({
        criterionId,
        rating: 4,
        justification: "The selected sources support the employee's explanation.",
        sourceReferences: [sourceId],
        directObservationBasis: null,
        [forbiddenAssessmentKey]: 5,
      }),
    ).toThrow();

    expect(() =>
      EvaluationAiWordingOutputSchema.parse({
        schemaVersion: "evaluation-justification.v1",
        draft: "A clearer source-grounded explanation.",
        sourceReferences: [sourceId],
        limitations: [],
        [forbiddenWordingKey]: 5,
      }),
    ).toThrow();
  });

  it("keeps Cycle 1 explicitly calibration and non-baseline", () => {
    expect(EvaluationCycleTypeSchema.parse("CALIBRATION_NON_BASELINE")).toBe(
      "CALIBRATION_NON_BASELINE",
    );
    expect(EvaluationCycleTypeSchema.safeParse("BASELINE").success).toBe(false);
  });

  it("requires optimistic versioning and idempotency for draft saves", () => {
    const valid = {
      schemaVersion: 1,
      assignmentId,
      actorId,
      kind: "SELF",
      expectedVersion: 1,
      idempotencyKey,
      entries: [
        {
          criterionId,
          rating: 4,
          justification: "A source-grounded explanation.",
          sourceReferences: [sourceId],
          directObservationBasis: null,
        },
      ],
    } as const;

    expect(SaveAssessmentDraftInputSchema.parse(valid)).toEqual(valid);
    expect(SaveAssessmentDraftInputSchema.safeParse({ ...valid, expectedVersion: 0 }).success).toBe(
      false,
    );
    const withoutIdempotency: Record<string, unknown> = { ...valid };
    delete withoutIdempotency.idempotencyKey;
    expect(SaveAssessmentDraftInputSchema.safeParse(withoutIdempotency).success).toBe(false);
  });

  it("preserves an employee reservation without changing the final decision", () => {
    const result = EvaluationAcknowledgmentInputSchema.safeParse({
      schemaVersion: 1,
      assignmentId,
      actorId,
      expectedVersion: 3,
      idempotencyKey,
      kind: "ACKNOWLEDGED_WITH_RESERVATION",
      reservation: "I acknowledge receipt and want this context retained with the snapshot.",
    });

    expect(result.success).toBe(true);
  });
});
