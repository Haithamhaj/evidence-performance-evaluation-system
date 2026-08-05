import { describe, expect, it } from "vitest";

import { EvaluationFactViewSchema } from "./evaluation-fact-view.js";

const ids = {
  cycle: crypto.randomUUID(),
  rubricVersion: crypto.randomUUID(),
  employee: crypto.randomUUID(),
  project: crypto.randomUUID(),
  workstream: crypto.randomUUID(),
  responsibilityWindow: crypto.randomUUID(),
  event: crypto.randomUUID(),
  evidence: crypto.randomUUID(),
  checkIn: crypto.randomUUID(),
  criterionVersion: crypto.randomUUID(),
  interpretation: crypto.randomUUID(),
};

const sourceReference = {
  sourceType: "timeline_event",
  sourceId: ids.event,
  sourceVersion: 1,
  occurredAt: "2026-07-23T09:00:00.000Z",
  url: null,
} as const;

const validFactView = {
  schemaVersion: 1,
  cycle: {
    id: ids.cycle,
    startsAt: "2026-07-01T00:00:00.000Z",
    endsAt: "2026-09-30T23:59:59.999Z",
    rubricVersionId: ids.rubricVersion,
  },
  subjectEmployeeId: ids.employee,
  generatedAt: "2026-10-01T08:00:00.000Z",
  responsibilityWindows: [
    {
      kind: "source_fact",
      sourceType: "responsibility_window",
      sourceId: ids.responsibilityWindow,
      sourceOccurredAt: "2026-07-01T00:00:00.000Z",
      projectId: ids.project,
      workstreamId: ids.workstream,
      responsibilityType: "contributor",
      startedAt: "2026-07-01T00:00:00.000Z",
      endedAt: null,
      sourceReferences: [sourceReference],
    },
  ],
  projectFacts: [
    {
      kind: "source_fact",
      sourceType: "project_contribution",
      sourceId: ids.event,
      sourceOccurredAt: "2026-07-23T09:00:00.000Z",
      projectId: ids.project,
      workstreamId: ids.workstream,
      relatedWorkItemId: null,
      criterionStableId: "ARL-03",
      criterionVersionId: ids.criterionVersion,
      summary: "Compared the approved baseline with the candidate under the same conditions.",
      result: "The candidate reduced median latency while preserving the acceptance threshold.",
      verificationState: "source_supported",
      attributionState: "employee_confirmed",
      responsibilityWindowIds: [ids.responsibilityWindow],
      sourceReferences: [sourceReference],
    },
  ],
  confirmedEvidence: [
    {
      kind: "source_fact",
      sourceType: "confirmed_evidence",
      sourceId: ids.evidence,
      sourceOccurredAt: "2026-07-23T09:05:00.000Z",
      projectId: ids.project,
      workstreamId: ids.workstream,
      relatedWorkItemId: null,
      relatedCriterionStableId: "ARL-03",
      supportedClaim: "The experiment used the approved baseline and acceptance threshold.",
      contributionContext: "Codex designed and verified the comparison.",
      verificationState: "source_supported",
      attributionState: "employee_confirmed",
      sourceReferences: [sourceReference],
    },
  ],
  checkInFacts: [
    {
      kind: "source_fact",
      sourceType: "check_in",
      sourceId: ids.checkIn,
      sourceOccurredAt: "2026-07-24T12:00:00.000Z",
      projectId: ids.project,
      workstreamId: ids.workstream,
      checkInType: "workstream",
      status: "substantive_update_present",
      summary: "A substantive result was already recorded for the week.",
      sourceReferences: [sourceReference],
    },
  ],
  dynamicCriteriaVersions: [
    {
      kind: "source_fact",
      sourceType: "criterion_version",
      sourceId: ids.criterionVersion,
      sourceOccurredAt: "2026-07-01T00:00:00.000Z",
      projectId: ids.project,
      workstreamId: ids.workstream,
      criterionStableId: "ARL-03",
      criterionVersionId: ids.criterionVersion,
      locale: "en",
      name: "Experiment and Evaluation Design",
      effectiveFrom: "2026-07-01T00:00:00.000Z",
      effectiveUntil: null,
      sourceReferences: [sourceReference],
    },
  ],
  employeeInterpretations: [
    {
      kind: "employee_interpretation",
      id: ids.interpretation,
      originalText: "I designed the comparison and believe it clarified the release decision.",
      normalizedText: "The employee states that the comparison clarified the release decision.",
      sourceFactIds: [ids.event, ids.evidence],
      createdAt: "2026-09-29T10:00:00.000Z",
    },
  ],
  sourceCoverageNotes: [
    {
      kind: "coverage_note",
      code: "partial_period",
      scope: "workstream",
      projectId: ids.project,
      workstreamId: ids.workstream,
      message: "The responsibility window covers only part of the evaluation cycle.",
      sourceFactIds: [ids.responsibilityWindow],
      neutral: true,
    },
  ],
} as const;

describe("evaluation fact view contract", () => {
  it("accepts source-labelled facts, effective versions, responsibility windows, and separately labelled employee interpretation", async () => {
    const contracts = (await import("./index.js")) as Record<string, unknown>;
    const schema = contracts.EvaluationFactViewSchema as
      { safeParse: (input: unknown) => { success: boolean } } | undefined;

    expect(schema?.safeParse(validFactView).success).toBe(true);
  });

  it.each([
    {
      name: "cycle ending before it starts",
      input: {
        ...validFactView,
        cycle: {
          ...validFactView.cycle,
          endsAt: "2026-06-30T23:59:59.999Z",
        },
      },
    },
    {
      name: "responsibility ending before it starts",
      input: {
        ...validFactView,
        responsibilityWindows: [
          {
            ...validFactView.responsibilityWindows[0],
            endedAt: "2026-06-30T23:59:59.999Z",
          },
        ],
      },
    },
    {
      name: "criterion version ending before it becomes effective",
      input: {
        ...validFactView,
        dynamicCriteriaVersions: [
          {
            ...validFactView.dynamicCriteriaVersions[0],
            effectiveUntil: "2026-06-30T23:59:59.999Z",
          },
        ],
      },
    },
  ])("rejects $name", ({ input }) => {
    expect(EvaluationFactViewSchema.safeParse(input).success).toBe(false);
  });

  it.each(
    [
      ["suggested", "Rating"],
      ["predicted", "Rating"],
      ["recommended", "Rating"],
      ["employee", "Rank"],
      ["productivity", "Score"],
      ["readiness", "Percentage"],
      ["automatic", "Project", "Average"],
    ].map((parts) => parts.join("")),
  )("rejects the prohibited evaluation field %s", (field) => {
    expect(
      EvaluationFactViewSchema.safeParse({
        ...validFactView,
        [field]: 4,
      }).success,
    ).toBe(false);
    expect(
      EvaluationFactViewSchema.safeParse({
        ...validFactView,
        projectFacts: [
          {
            ...validFactView.projectFacts[0],
            [field]: 4,
          },
        ],
      }).success,
    ).toBe(false);
  });
});
