import { describe, expect, it } from "vitest";

import { EvaluationFactViewSchema } from "../../packages/contracts/src/evaluation-fact-view.js";

const projectId = "00000000-0000-4000-8000-000000000101";
const cycleId = "00000000-0000-4000-8000-000000000102";
const employeeId = "00000000-0000-4000-8000-000000000103";
const rubricVersionId = "00000000-0000-4000-8000-000000000104";
const sourceId = "00000000-0000-4000-8000-000000000105";
const interpretationId = "00000000-0000-4000-8000-000000000106";

function neutralView() {
  return {
    schemaVersion: 2,
    cycle: {
      id: cycleId,
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: "2026-09-30T23:59:59.000Z",
      rubricVersionId,
    },
    subjectEmployeeId: employeeId,
    generatedAt: "2026-08-05T09:00:00.000Z",
    responsibilityWindows: [],
    projectFacts: [
      {
        kind: "source_fact",
        sourceType: "project_contribution",
        sourceId,
        sourceOccurredAt: "2026-08-01T09:00:00.000Z",
        projectId,
        workstreamId: null,
        sourceReferences: [
          {
            sourceType: "timeline_event",
            sourceId,
            sourceVersion: 1,
            occurredAt: "2026-08-01T09:00:00.000Z",
            url: null,
          },
        ],
        relatedWorkItemId: null,
        criterionStableId: null,
        criterionVersionId: null,
        summary: "تم توثيق نتيجة التسليم وربطها بمصدرها.",
        result: "اجتاز التسليم شروط القبول المحددة.",
        verificationState: "source_supported",
        attributionState: "employee_confirmed",
        responsibilityWindowIds: [],
      },
    ],
    confirmedEvidence: [],
    checkInFacts: [],
    researchFacts: [],
    dynamicCriteriaVersions: [],
    employeeInterpretations: [
      {
        kind: "employee_interpretation",
        id: interpretationId,
        originalText: "أرى أنني عالجت خطر التسليم.",
        normalizedText: "تفسير الموظف: تمت معالجة خطر التسليم.",
        sourceFactIds: [sourceId],
        createdAt: "2026-08-01T09:15:00.000Z",
      },
    ],
    sourceCoverageNotes: [],
  } as const;
}

describe("Evaluation Fact View neutrality", () => {
  it("accepts Arabic source facts while keeping employee interpretation separate", () => {
    const parsed = EvaluationFactViewSchema.parse(neutralView());

    expect(parsed.projectFacts[0]?.summary).toBe("تم توثيق نتيجة التسليم وربطها بمصدرها.");
    expect(parsed.employeeInterpretations[0]?.kind).toBe("employee_interpretation");
    expect(parsed.employeeInterpretations[0]?.sourceFactIds).toEqual([sourceId]);
  });

  it.each([
    ["recommended", "Rating"],
    ["predicted", "Rating"],
    ["productivity", "Score"],
    ["employee", "Rank"],
    ["readiness", "Percentage"],
  ])("rejects prohibited judgment field %s%s", (prefix, suffix) => {
    const prohibitedField = `${prefix}${suffix}`;
    const candidate = { ...neutralView(), [prohibitedField]: 5 };

    expect(EvaluationFactViewSchema.safeParse(candidate).success).toBe(false);
  });

  it("requires every source fact to carry a traceable source reference", () => {
    const candidate = neutralView();
    const unsupported = {
      ...candidate,
      projectFacts: [{ ...candidate.projectFacts[0], sourceReferences: [] }],
    };

    expect(EvaluationFactViewSchema.safeParse(unsupported).success).toBe(false);
  });
});
