import { describe, expect, it } from "vitest";

import { EmployeeEvaluationJourneySchema } from "./evaluation-experience-schema.js";

describe("EmployeeEvaluationJourneySchema", () => {
  it("accepts the identified cycle, fixed template order, and actor-owned draft", () => {
    expect(EmployeeEvaluationJourneySchema.parse(fixture())).toMatchObject({
      cycle: { visibilityMode: "identified" },
      drafts: [{ kind: "SELF", version: 2 }],
      factView: { schemaVersion: 2, subjectEmployeeId: "20000000-0000-4000-8000-000000000002" },
      templateSnapshot: { items: [{ displayOrder: 1 }] },
    });
  });

  it("rejects any added AI rating field", () => {
    expect(() =>
      EmployeeEvaluationJourneySchema.parse({
        ...fixture(),
        suggestedRating: 5,
      }),
    ).toThrow();
  });
});

function fixture() {
  return {
    schemaVersion: 1,
    audience: "self",
    cycle: {
      id: "10000000-0000-4000-8000-000000000001",
      type: "CALIBRATION_NON_BASELINE",
      state: "SELF_ASSESSMENT",
      visibilityMode: "identified",
      startsAt: "2026-07-01T00:00:00Z",
      endsAt: "2026-09-30T20:59:59Z",
      version: 2,
    },
    assignment: {
      id: "20000000-0000-4000-8000-000000000001",
      employeeId: "20000000-0000-4000-8000-000000000002",
      managerId: "20000000-0000-4000-8000-000000000003",
      version: 1,
    },
    templateSnapshot: {
      id: "30000000-0000-4000-8000-000000000099",
      versionNumber: 1,
      schemaVersion: 1,
      weightPolicy: {},
      evaluationPolicy: {},
      items: [
        {
          id: "30000000-0000-4000-8000-000000000001",
          stableCriterionId: "quality_reliability",
          kind: "FIXED_CRITERION",
          sectionStableId: "delivery",
          sectionWeight: 100,
          criterionWeight: null,
          displayOrder: 1,
          protectedGlobal: true,
          mandatory: true,
          locales: [
            {
              locale: "en",
              title: "Quality and reliability",
              definition: "Approved definition.",
              anchors: [
                { rating: 1, text: "Anchor 1" },
                { rating: 2, text: "Anchor 2" },
                { rating: 3, text: "Anchor 3" },
                { rating: 4, text: "Anchor 4" },
                { rating: 5, text: "Anchor 5" },
              ],
              examples: [],
              evidenceGuidance: [],
            },
          ],
        },
      ],
    },
    factViewFirst: {
      responsibilityWindows: [],
      workFacts: [],
      researchFacts: [],
      sourceCoverageNotes: [],
    },
    factView: {
      schemaVersion: 2,
      cycle: {
        id: "10000000-0000-4000-8000-000000000001",
        startsAt: "2026-07-01T00:00:00Z",
        endsAt: "2026-09-30T20:59:59Z",
        rubricVersionId: "40000000-0000-4000-8000-000000000001",
      },
      subjectEmployeeId: "20000000-0000-4000-8000-000000000002",
      generatedAt: "2026-08-15T12:00:00Z",
      responsibilityWindows: [],
      projectFacts: [],
      confirmedEvidence: [],
      checkInFacts: [],
      dynamicCriteriaVersions: [],
      researchFacts: [],
      employeeInterpretations: [],
      sourceCoverageNotes: [],
    },
    drafts: [
      {
        kind: "SELF",
        version: 2,
        entries: [
          {
            criterionId: "30000000-0000-4000-8000-000000000001",
            rating: 3,
            justification: "Source-backed reflection.",
            sourceReferences: [],
            directObservationBasis: null,
          },
        ],
        updatedAt: "2026-08-15T12:00:00Z",
      },
    ],
    submissions: [],
    comparison: null,
    discussion: [],
    finalDecision: null,
    acknowledgment: null,
    immutableClosedSnapshot: null,
    independenceGate: { managerSubmittedBeforeSelfProjection: false },
  };
}
