import { describe, expect, it } from "vitest";

import {
  AssessmentEntrySchema,
  EvaluationAcknowledgmentInputSchema,
  EvaluationAiWordingOutputSchema,
  EvaluationCycleTypeSchema,
  DepartmentEvaluationReportProjectionSchema,
  EmployeeEvaluationReportProjectionSchema,
  FinalEvaluationSnapshotSchema,
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

  it("requires the version 2 final snapshot to pin the complete immutable report context", () => {
    const entry = {
      criterionId,
      rating: 4 as const,
      justification: "A source-grounded human judgment.",
      sourceReferences: [sourceId],
      directObservationBasis: null,
    };
    const snapshot = {
      schemaVersion: 2 as const,
      id: "10000000-0000-4000-8000-000000000006",
      assignmentId,
      cycleId: "10000000-0000-4000-8000-000000000007",
      employeeId: "10000000-0000-4000-8000-000000000008",
      managerId: "10000000-0000-4000-8000-000000000009",
      templateVersionId: "10000000-0000-4000-8000-000000000010",
      cycleType: "CALIBRATION_NON_BASELINE" as const,
      period: { startsAt: "2026-07-01T00:00:00Z", endsAt: "2026-10-01T00:00:00Z" },
      responsibilityWindows: [],
      workFacts: [],
      researchFacts: [],
      sourceCoverageNotes: [],
      selfAssessment: { submittedAt: "2026-08-01T00:00:00Z", entries: [entry] },
      managerInitialAssessment: {
        submittedAt: "2026-08-02T00:00:00Z",
        entries: [{ ...entry, rating: 3 as const, directObservationBasis: "Observed." }],
      },
      comparison: {
        schemaVersion: 2 as const,
        assignmentId,
        entries: [
          {
            criterionId,
            selfRating: 4 as const,
            managerRating: 3 as const,
            gap: 1,
            effectiveWeight: 25,
            highWeightGap: true,
            selfSourceReferences: [sourceId],
            managerSourceReferences: [sourceId],
            sourceDifference: { selfOnly: [], managerOnly: [] },
            missingRationale: { self: false, manager: false },
            responsibilityDurationInterpretation: [],
            disputedAttributionSourceIds: [],
            discussionRequired: true,
          },
        ],
        discussionEntries: [],
        generatedAt: "2026-08-06T10:00:00Z",
      },
      developmentPlanReference: null,
      entries: [
        {
          criterionId,
          rating: 4 as const,
          justification: "The manager's final human judgment.",
          sourceReferences: [sourceId],
          managerInitialChangeReason: "Discussion clarified the result.",
        },
      ],
      finalComment: null,
      finalizedAt: "2026-08-06T10:00:00Z",
      closedAt: null,
      version: 1,
    };

    expect(FinalEvaluationSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(
      EmployeeEvaluationReportProjectionSchema.parse({
        schemaVersion: 2,
        assignmentId,
        employeeId: snapshot.employeeId,
        cycleId: snapshot.cycleId,
        cycleType: snapshot.cycleType,
        state: "CLOSED",
        period: snapshot.period,
        finalSnapshot: snapshot,
        acknowledgment: null,
      }),
    ).toMatchObject({ schemaVersion: 2, period: snapshot.period });
  });

  it("permits anonymous rating distributions and trends but rejects employee identifiers", () => {
    const distribution = {
      criterionStableId: "PPB-01",
      buckets: [
        { rating: 1 as const, count: 0 },
        { rating: 2 as const, count: 0 },
        { rating: 3 as const, count: 1 },
        { rating: 4 as const, count: 2 },
        { rating: 5 as const, count: 0 },
      ],
    };
    const report = {
      schemaVersion: 2 as const,
      departmentId: "10000000-0000-4000-8000-000000000011",
      cycleId: "10000000-0000-4000-8000-000000000007",
      cycleType: "STANDARD" as const,
      state: "CLOSED" as const,
      period: { startsAt: "2026-10-01T00:00:00Z", endsAt: "2027-01-01T00:00:00Z" },
      ratingDistributions: [distribution],
      trends: [
        {
          sequence: 2,
          cycleType: "STANDARD" as const,
          period: { startsAt: "2026-10-01T00:00:00Z", endsAt: "2027-01-01T00:00:00Z" },
          ratingDistributions: [distribution],
        },
      ],
    };

    expect(DepartmentEvaluationReportProjectionSchema.parse(report)).toEqual(report);
    expect(
      DepartmentEvaluationReportProjectionSchema.safeParse({
        ...report,
        employeeId: "10000000-0000-4000-8000-000000000008",
      }).success,
    ).toBe(false);
  });
});
