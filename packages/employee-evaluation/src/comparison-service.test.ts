import { describe, expect, it } from "vitest";

import { ComparisonService } from "./comparison-service.js";

const now = new Date("2026-08-06T10:00:00Z");

describe("ComparisonService", () => {
  it("explains rating, weight, citation, responsibility, and attribution differences without resolving them", () => {
    const assignmentId = crypto.randomUUID();
    const projectCriterionId = crypto.randomUUID();
    const fixedCriterionId = crypto.randomUUID();
    const selfOnlySourceId = crypto.randomUUID();
    const managerOnlySourceId = crypto.randomUUID();
    const disputedSourceId = crypto.randomUUID();
    const responsibilityWindowId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const cycleId = crypto.randomUUID();
    const subjectEmployeeId = crypto.randomUUID();
    const rubricVersionId = crypto.randomUUID();

    const comparison = new ComparisonService(() => now).read({
      assignmentId,
      selfSubmission: {
        assignmentId,
        kind: "SELF",
        entries: [
          assessmentEntry(projectCriterionId, 4, [selfOnlySourceId, disputedSourceId]),
          assessmentEntry(fixedCriterionId, 2, []),
        ],
      },
      managerSubmission: {
        assignmentId,
        kind: "MANAGER_INITIAL",
        entries: [
          assessmentEntry(projectCriterionId, 3, [managerOnlySourceId, disputedSourceId]),
          assessmentEntry(fixedCriterionId, 3, []),
        ],
      },
      templateItems: [
        {
          criterionId: projectCriterionId,
          kind: "PROJECT_CONTRIBUTION",
          sectionWeight: 25,
          criterionWeight: null,
        },
        {
          criterionId: fixedCriterionId,
          kind: "FIXED_CRITERION",
          sectionWeight: 20,
          criterionWeight: 30,
        },
      ],
      discussionEntries: [
        {
          id: crypto.randomUUID(),
          body: "Review the disputed attribution and responsibility period.",
          sourceReferences: [disputedSourceId, responsibilityWindowId],
          createdAt: "2026-08-06T09:00:00Z",
        },
      ],
      factScope: {
        cycleId,
        subjectEmployeeId,
        rubricVersionId,
        startsAt: "2026-07-01T00:00:00Z",
        endsAt: "2026-10-01T00:00:00Z",
      },
      factView: {
        schemaVersion: 2,
        cycle: {
          id: cycleId,
          startsAt: "2026-07-01T00:00:00Z",
          endsAt: "2026-10-01T00:00:00Z",
          rubricVersionId,
        },
        subjectEmployeeId,
        generatedAt: now.toISOString(),
        responsibilityWindows: [
          {
            kind: "source_fact",
            sourceId: responsibilityWindowId,
            sourceOccurredAt: "2026-07-01T00:00:00Z",
            projectId,
            workstreamId: null,
            sourceType: "responsibility_window",
            responsibilityType: "acting_owner",
            startedAt: "2026-07-01T00:00:00Z",
            endedAt: "2026-08-01T00:00:00Z",
            sourceReferences: [sourceReference(responsibilityWindowId, "responsibility_window")],
          },
        ],
        projectFacts: [
          projectFact(selfOnlySourceId, projectId, "employee_confirmed", []),
          projectFact(managerOnlySourceId, projectId, "employee_confirmed", []),
          projectFact(disputedSourceId, projectId, "disputed", [responsibilityWindowId]),
        ],
        confirmedEvidence: [],
        checkInFacts: [],
        dynamicCriteriaVersions: [],
        researchFacts: [],
        employeeInterpretations: [],
        sourceCoverageNotes: [
          {
            kind: "coverage_note",
            code: "partial_period",
            scope: "project",
            projectId,
            workstreamId: null,
            messageKey: "evaluation.coverage.partialResponsibilityPeriod",
            sourceFactIds: [responsibilityWindowId],
            neutral: true,
          },
        ],
      },
    });

    expect(comparison.entries[0]).toMatchObject({
      criterionId: projectCriterionId,
      selfRating: 4,
      managerRating: 3,
      gap: 1,
      highWeightGap: true,
      sourceDifference: {
        selfOnly: [selfOnlySourceId],
        managerOnly: [managerOnlySourceId],
      },
      missingRationale: { self: false, manager: false },
      responsibilityDurationInterpretation: [
        {
          sourceId: responsibilityWindowId,
          responsibilityType: "acting_owner",
          startedAt: "2026-07-01T00:00:00Z",
          endedAt: "2026-08-01T00:00:00Z",
        },
      ],
      disputedAttributionSourceIds: [disputedSourceId],
      discussionRequired: true,
    });
    expect(comparison.entries[1]).toMatchObject({ highWeightGap: false });
    expect(Object.keys(comparison).sort()).toEqual([
      "assignmentId",
      "discussionEntries",
      "entries",
      "generatedAt",
      "schemaVersion",
    ]);
    expect(Object.keys(comparison.entries[0]!).sort()).toEqual([
      "criterionId",
      "discussionRequired",
      "disputedAttributionSourceIds",
      "effectiveWeight",
      "gap",
      "highWeightGap",
      "managerRating",
      "managerSourceReferences",
      "missingRationale",
      "responsibilityDurationInterpretation",
      "selfRating",
      "selfSourceReferences",
      "sourceDifference",
    ]);
  });

  it("fails closed when submissions do not belong to the same assignment or criteria", () => {
    const assignmentId = crypto.randomUUID();
    const criterionId = crypto.randomUUID();
    const service = new ComparisonService(() => now);
    const factView = emptyFactView();
    const base = {
      assignmentId,
      templateItems: [
        {
          criterionId,
          kind: "PROJECT_CONTRIBUTION" as const,
          sectionWeight: 25,
          criterionWeight: null,
        },
      ],
      discussionEntries: [],
      factView,
      factScope: {
        cycleId: factView.cycle.id,
        subjectEmployeeId: factView.subjectEmployeeId,
        rubricVersionId: factView.cycle.rubricVersionId,
        startsAt: factView.cycle.startsAt,
        endsAt: factView.cycle.endsAt,
      },
      selfSubmission: {
        assignmentId,
        kind: "SELF" as const,
        entries: [assessmentEntry(criterionId, 4, [])],
      },
    };

    expect(() =>
      service.read({
        ...base,
        managerSubmission: {
          assignmentId: crypto.randomUUID(),
          kind: "MANAGER_INITIAL",
          entries: [assessmentEntry(criterionId, 3, [])],
        },
      }),
    ).toThrowError(/scope/i);
    expect(() =>
      service.read({
        ...base,
        managerSubmission: {
          assignmentId,
          kind: "MANAGER_INITIAL",
          entries: [assessmentEntry(crypto.randomUUID(), 3, [])],
        },
      }),
    ).toThrowError(/criteria/i);
    expect(() =>
      service.read({
        ...base,
        factScope: { ...base.factScope, subjectEmployeeId: crypto.randomUUID() },
        managerSubmission: {
          assignmentId,
          kind: "MANAGER_INITIAL",
          entries: [assessmentEntry(criterionId, 3, [])],
        },
      }),
    ).toThrowError(/scope/i);
  });
});

function assessmentEntry(criterionId: string, rating: 1 | 2 | 3 | 4 | 5, sources: string[]) {
  return {
    criterionId,
    rating,
    justification: `Human rationale for ${criterionId}.`,
    sourceReferences: sources,
    directObservationBasis: null,
  };
}

function sourceReference(sourceId: string, sourceType: "responsibility_window" | "timeline_event") {
  return {
    sourceType,
    sourceId,
    sourceVersion: 1,
    occurredAt: "2026-08-01T00:00:00Z",
    url: null,
  };
}

function projectFact(
  sourceId: string,
  projectId: string,
  attributionState: "employee_confirmed" | "disputed",
  responsibilityWindowIds: string[],
) {
  return {
    kind: "source_fact" as const,
    sourceId,
    sourceOccurredAt: "2026-08-01T00:00:00Z",
    projectId,
    workstreamId: null,
    sourceType: "project_contribution" as const,
    relatedWorkItemId: null,
    criterionStableId: null,
    criterionVersionId: null,
    summary: "Source-supported project contribution.",
    result: "Approved acceptance condition met.",
    verificationState: "source_supported" as const,
    attributionState,
    responsibilityWindowIds,
    sourceReferences: [sourceReference(sourceId, "timeline_event")],
  };
}

function emptyFactView() {
  return {
    schemaVersion: 2 as const,
    cycle: {
      id: crypto.randomUUID(),
      startsAt: "2026-07-01T00:00:00Z",
      endsAt: "2026-10-01T00:00:00Z",
      rubricVersionId: crypto.randomUUID(),
    },
    subjectEmployeeId: crypto.randomUUID(),
    generatedAt: now.toISOString(),
    responsibilityWindows: [],
    projectFacts: [],
    confirmedEvidence: [],
    checkInFacts: [],
    dynamicCriteriaVersions: [],
    researchFacts: [],
    employeeInterpretations: [],
    sourceCoverageNotes: [],
  };
}
