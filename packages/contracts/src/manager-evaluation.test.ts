import { describe, expect, it } from "vitest";

import {
  IdentifiedManagerEvaluationReportProjectionSchema,
  IdentifiedManagerResponseSchema,
  ManagerCriterionResponseSchema,
  ManagerEvaluationCompletionProjectionSchema,
  ManagerEvaluationSensitiveAccessRequestSchema,
  ManagerEvaluationSensitiveAccessResultSchema,
  ManagerEvaluationSummaryRevisionSchema,
  ManagerEvaluationVisibilityPolicySchema,
  ManagerEvaluationVisibilitySchema,
  ManagerEvaluatorStateSchema,
  ManagerThemeSchema,
  OpenManagerEvaluationCycleInputSchema,
  PilotManagerEvaluationProjectionPolicySchema,
  RecordManagerEvaluationEligibilityDecisionInputSchema,
  SubmitManagerEvaluationInputSchema,
  SubmitManagerEvaluationReceiptSchema,
  createPilotManagerEvaluationProjectionPolicy,
} from "./manager-evaluation.js";

const cycleId = "10000000-0000-4000-8000-000000000001";
const employeeCycleId = "10000000-0000-4000-8000-000000000002";
const managerId = "10000000-0000-4000-8000-000000000003";
const departmentId = "10000000-0000-4000-8000-000000000004";
const rubricVersionId = "10000000-0000-4000-8000-000000000005";
const actorId = "10000000-0000-4000-8000-000000000006";
const evaluatorId = "10000000-0000-4000-8000-000000000007";
const responseId = "10000000-0000-4000-8000-000000000008";
const idempotencyKey = "10000000-0000-4000-8000-000000000009";
const auditEventId = "10000000-0000-4000-8000-000000000010";
const aiRunId = "10000000-0000-4000-8000-000000000011";
const criterionIds = [
  "20000000-0000-4000-8000-000000000001",
  "20000000-0000-4000-8000-000000000002",
  "20000000-0000-4000-8000-000000000003",
  "20000000-0000-4000-8000-000000000004",
  "20000000-0000-4000-8000-000000000005",
] as const;
const responseIds = [responseId, "30000000-0000-4000-8000-000000000002"] as const;
const period = {
  startsAt: "2026-07-01T00:00:00Z",
  endsAt: "2026-10-01T00:00:00Z",
} as const;
const criterionResponses = criterionIds.map((criterionId, index) => ({
  criterionId,
  rating: ((index % 5) + 1) as 1 | 2 | 3 | 4 | 5,
  comment: `Work-related feedback for criterion ${index + 1}.`,
}));

describe("identified manager evaluation contracts", () => {
  it("models Identified as the only enabled pilot projection and keeps private modes disabled", () => {
    expect(ManagerEvaluationVisibilitySchema.parse("IDENTIFIED")).toBe("IDENTIFIED");
    expect(ManagerEvaluationVisibilitySchema.parse("MANAGER_BLINDED")).toBe("MANAGER_BLINDED");
    expect(ManagerEvaluationVisibilitySchema.parse("ANONYMOUS_AGGREGATED")).toBe(
      "ANONYMOUS_AGGREGATED",
    );
    expect(
      PilotManagerEvaluationProjectionPolicySchema.parse({
        schemaVersion: 1,
        policyVersion: 1,
        mode: "IDENTIFIED",
      }),
    ).toMatchObject({ mode: "IDENTIFIED" });
    expect(
      PilotManagerEvaluationProjectionPolicySchema.safeParse({
        schemaVersion: 1,
        policyVersion: 1,
        mode: "MANAGER_BLINDED",
      }).success,
    ).toBe(false);

    expect(createPilotManagerEvaluationProjectionPolicy("IDENTIFIED", 1)).toEqual({
      schemaVersion: 1,
      policyVersion: 1,
      mode: "IDENTIFIED",
    });
    expect(() => createPilotManagerEvaluationProjectionPolicy("MANAGER_BLINDED", 1)).toThrowError(
      expect.objectContaining({ code: "MANAGER_EVALUATION_VISIBILITY_DISABLED", status: 403 }),
    );

    for (const mode of ["MANAGER_BLINDED", "ANONYMOUS_AGGREGATED"] as const) {
      expect(
        ManagerEvaluationVisibilityPolicySchema.parse({
          schemaVersion: 1,
          policyVersion: 1,
          mode,
          enabled: false,
          managerCanReadIdentity: false,
          managerCanReadOriginals: false,
          immediateVisibility: false,
        }),
      ).toMatchObject({ mode, enabled: false });
    }
  });

  it("opens only an Identified pilot cycle with a frozen policy and valid UTC period", () => {
    const valid = {
      schemaVersion: 1,
      employeeEvaluationCycleId: employeeCycleId,
      departmentId,
      managerId,
      rubricVersionId,
      visibilityPolicyVersion: 1,
      visibilityMode: "IDENTIFIED",
      startsAt: period.startsAt,
      endsAt: period.endsAt,
      actorId,
      expectedVersion: 1,
      idempotencyKey,
      reason: "Open the quarterly identified manager evaluation cycle.",
    } as const;

    expect(OpenManagerEvaluationCycleInputSchema.parse(valid)).toEqual(valid);
    expect(
      OpenManagerEvaluationCycleInputSchema.safeParse({
        ...valid,
        visibilityMode: "MANAGER_BLINDED",
      }).success,
    ).toBe(false);
    expect(
      OpenManagerEvaluationCycleInputSchema.safeParse({
        ...valid,
        endsAt: valid.startsAt,
      }).success,
    ).toBe(false);
  });

  it("limits eligibility decisions to authorized append-only non-submission states", () => {
    expect(ManagerEvaluatorStateSchema.parse("ELIGIBLE_PENDING")).toBe("ELIGIBLE_PENDING");
    expect(ManagerEvaluatorStateSchema.parse("SUBMITTED")).toBe("SUBMITTED");
    expect(ManagerEvaluatorStateSchema.parse("APPROVED_LEAVE")).toBe("APPROVED_LEAVE");
    expect(ManagerEvaluatorStateSchema.parse("POSTPONED")).toBe("POSTPONED");
    expect(ManagerEvaluatorStateSchema.parse("EXCLUDED_BY_AUTHORIZED_MANAGER")).toBe(
      "EXCLUDED_BY_AUTHORIZED_MANAGER",
    );

    const valid = {
      schemaVersion: 1,
      cycleId,
      evaluatorId,
      actorId,
      state: "APPROVED_LEAVE",
      effectiveAt: "2026-08-06T10:00:00Z",
      expectedVersion: 1,
      idempotencyKey,
      reason: "Approved leave overlaps the evaluation window.",
    } as const;

    expect(RecordManagerEvaluationEligibilityDecisionInputSchema.parse(valid)).toEqual(valid);
    expect(
      RecordManagerEvaluationEligibilityDecisionInputSchema.safeParse({
        ...valid,
        state: "SUBMITTED",
      }).success,
    ).toBe(false);
  });

  it("requires exactly five unique criterion ratings and explicit Identified confirmation", () => {
    expect(ManagerCriterionResponseSchema.parse(criterionResponses[0])).toEqual(
      criterionResponses[0],
    );

    const valid = {
      schemaVersion: 1,
      cycleId,
      evaluatorId,
      expectedVersion: 1,
      idempotencyKey,
      identifiedNoticeConfirmed: true,
      confirmedAt: "2026-08-06T10:00:00Z",
      responses: criterionResponses,
    } as const;

    expect(SubmitManagerEvaluationInputSchema.parse(valid)).toEqual(valid);
    expect(
      SubmitManagerEvaluationInputSchema.safeParse({
        ...valid,
        identifiedNoticeConfirmed: false,
      }).success,
    ).toBe(false);
    expect(
      SubmitManagerEvaluationInputSchema.safeParse({
        ...valid,
        responses: criterionResponses.slice(0, 4),
      }).success,
    ).toBe(false);
    expect(
      SubmitManagerEvaluationInputSchema.safeParse({
        ...valid,
        responses: [...criterionResponses.slice(0, 4), criterionResponses[0]],
      }).success,
    ).toBe(false);
  });

  it("returns an immutable submission receipt and requires full identity in manager originals", () => {
    const receipt = {
      schemaVersion: 1,
      responseId,
      cycleId,
      evaluatorId,
      state: "SUBMITTED",
      submittedAt: "2026-08-06T10:00:01Z",
    } as const;
    expect(SubmitManagerEvaluationReceiptSchema.parse(receipt)).toEqual(receipt);

    const identified = {
      schemaVersion: 1,
      responseId,
      cycleId,
      managerId,
      submitterId: evaluatorId,
      submitterDisplayName: "Codex Employee",
      visibilityMode: "IDENTIFIED",
      state: "SUBMITTED",
      responses: criterionResponses,
      submittedAt: receipt.submittedAt,
    } as const;

    expect(IdentifiedManagerResponseSchema.parse(identified)).toEqual(identified);
    expect(
      IdentifiedManagerResponseSchema.safeParse({ ...identified, submitterId: undefined }).success,
    ).toBe(false);
    expect(
      IdentifiedManagerResponseSchema.safeParse({
        ...identified,
        visibilityMode: "MANAGER_BLINDED",
      }).success,
    ).toBe(false);
  });

  it("represents named frozen eligibility and leave-aware completion without a publication gate", () => {
    const completion = {
      schemaVersion: 1,
      cycleId,
      managerId,
      visibilityMode: "IDENTIFIED",
      eligible: 3,
      submitted: 1,
      pending: 1,
      approvedLeave: 1,
      postponed: 0,
      excluded: 0,
      entries: [
        {
          evaluatorId,
          evaluatorDisplayName: "Codex Employee",
          state: "SUBMITTED",
          responseId,
          submittedAt: "2026-08-06T10:00:01Z",
        },
        {
          evaluatorId: "40000000-0000-4000-8000-000000000002",
          evaluatorDisplayName: "Pending Employee",
          state: "ELIGIBLE_PENDING",
          responseId: null,
          submittedAt: null,
        },
        {
          evaluatorId: "40000000-0000-4000-8000-000000000003",
          evaluatorDisplayName: "Employee on leave",
          state: "APPROVED_LEAVE",
          responseId: null,
          submittedAt: null,
        },
      ],
      generatedAt: "2026-08-06T10:01:00Z",
    } as const;

    expect(ManagerEvaluationCompletionProjectionSchema.parse(completion)).toEqual(completion);
    expect(
      ManagerEvaluationCompletionProjectionSchema.safeParse({ ...completion, submitted: 2 })
        .success,
    ).toBe(false);
  });

  it("requires source-grounded repeated themes and rejects AI ratings or judgments", () => {
    const validTheme = {
      themeId: "50000000-0000-4000-8000-000000000001",
      kind: "STRENGTH",
      title: "Clear project direction",
      summary: "Two responses describe useful and repeated priority clarification.",
      criterionIds: [criterionIds[0]],
      sourceResponseIds: [...responseIds],
      supportCount: 2,
      period,
      limitations: ["The theme reflects submitted responses only."],
    } as const;

    expect(ManagerThemeSchema.parse(validTheme)).toEqual(validTheme);
    expect(
      ManagerThemeSchema.safeParse({
        ...validTheme,
        sourceResponseIds: [responseId],
        supportCount: 1,
      }).success,
    ).toBe(false);

    for (const key of [
      ["recommended", "Manager", "Rating"].join(""),
      ["predicted", "Rating"].join(""),
      ["manager", "Judgment"].join(""),
    ]) {
      expect(ManagerThemeSchema.safeParse({ ...validTheme, [key]: 5 }).success).toBe(false);
    }
  });

  it("keeps summary revisions source-linked and the pilot report fully identified", () => {
    const distribution = {
      criterionId: criterionIds[0],
      buckets: [
        { rating: 1 as const, count: 0 },
        { rating: 2 as const, count: 0 },
        { rating: 3 as const, count: 1 },
        { rating: 4 as const, count: 1 },
        { rating: 5 as const, count: 0 },
      ],
      totalResponses: 2,
    };
    const theme = {
      themeId: "50000000-0000-4000-8000-000000000001",
      kind: "STRENGTH" as const,
      title: "Clear project direction",
      summary: "Two responses describe useful and repeated priority clarification.",
      criterionIds: [criterionIds[0]],
      sourceResponseIds: [...responseIds],
      supportCount: 2,
      period,
      limitations: ["The theme reflects submitted responses only."],
    };
    const summary = {
      schemaVersion: "manager-evaluation-summary.v1",
      id: "50000000-0000-4000-8000-000000000002",
      cycleId,
      revision: 1,
      visibilityMode: "IDENTIFIED",
      period,
      sourceResponseIds: [...responseIds],
      distributions: [distribution],
      themes: [theme],
      limitations: ["Original identified responses remain authoritative."],
      promptVersion: "manager-evaluation-summary.v1",
      outputSchemaVersion: "manager-evaluation-summary.v1",
      aiRunId,
      createdAt: "2026-08-06T10:02:00Z",
    } as const;
    expect(ManagerEvaluationSummaryRevisionSchema.parse(summary)).toEqual(summary);

    const identifiedResponse = {
      schemaVersion: 1 as const,
      responseId,
      cycleId,
      managerId,
      submitterId: evaluatorId,
      submitterDisplayName: "Codex Employee",
      visibilityMode: "IDENTIFIED" as const,
      state: "SUBMITTED" as const,
      responses: criterionResponses,
      submittedAt: "2026-08-06T10:00:01Z",
    };
    const completion = {
      schemaVersion: 1 as const,
      cycleId,
      managerId,
      visibilityMode: "IDENTIFIED" as const,
      eligible: 1,
      submitted: 1,
      pending: 0,
      approvedLeave: 0,
      postponed: 0,
      excluded: 0,
      entries: [
        {
          evaluatorId,
          evaluatorDisplayName: "Codex Employee",
          state: "SUBMITTED" as const,
          responseId,
          submittedAt: "2026-08-06T10:00:01Z",
        },
      ],
      generatedAt: "2026-08-06T10:01:00Z",
    };
    const report = {
      schemaVersion: 1,
      cycleId,
      managerId,
      visibilityMode: "IDENTIFIED",
      period,
      completion,
      responses: [identifiedResponse],
      summaryRevision: summary,
      generatedAt: "2026-08-06T10:03:00Z",
    } as const;

    expect(IdentifiedManagerEvaluationReportProjectionSchema.parse(report)).toEqual(report);
    expect(
      IdentifiedManagerEvaluationReportProjectionSchema.safeParse({
        ...report,
        anonymous: true,
      }).success,
    ).toBe(false);
  });

  it("requires audited reasons for future-mode access and returns only a fail-closed denial", () => {
    const request = {
      schemaVersion: 1,
      cycleId,
      responseId,
      actorId,
      mode: "MANAGER_BLINDED",
      reason: "Investigate an explicitly approved future privacy incident.",
      correlationId: "60000000-0000-4000-8000-000000000001",
      requestedAt: "2026-08-06T10:04:00Z",
    } as const;
    expect(ManagerEvaluationSensitiveAccessRequestSchema.parse(request)).toEqual(request);
    expect(
      ManagerEvaluationSensitiveAccessRequestSchema.safeParse({
        ...request,
        mode: "IDENTIFIED",
      }).success,
    ).toBe(false);
    expect(
      ManagerEvaluationSensitiveAccessRequestSchema.safeParse({ ...request, reason: "" }).success,
    ).toBe(false);

    const denied = {
      schemaVersion: 1,
      decision: "DENIED_UNSUPPORTED_MODE",
      auditEventId,
      decidedAt: "2026-08-06T10:04:01Z",
    } as const;
    expect(ManagerEvaluationSensitiveAccessResultSchema.parse(denied)).toEqual(denied);
    expect(
      ManagerEvaluationSensitiveAccessResultSchema.safeParse({
        ...denied,
        decision: "AUTHORIZED",
      }).success,
    ).toBe(false);
  });
});
