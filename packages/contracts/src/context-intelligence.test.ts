import { describe, expect, it } from "vitest";

import {
  ContextAnalysisSchema,
  ProjectLinkSuggestionSchema,
  SourceLinkCorrectionSchema,
  TaskDraftRecordSchema,
  TaskDraftSchema,
} from "./context-intelligence.js";

const employeeId = "00000000-0000-4000-8000-000000000301";
const sourceItemId = "00000000-0000-4000-8000-000000000302";
const projectId = "00000000-0000-4000-8000-000000000303";
const aiRunId = "00000000-0000-4000-8000-000000000304";
const routeConfigId = "00000000-0000-4000-8000-000000000305";
const analysisId = "00000000-0000-4000-8000-000000000306";
const suggestionId = "00000000-0000-4000-8000-000000000307";
const taskDraftId = "00000000-0000-4000-8000-000000000308";
const sourceReferences = [`connected-source:${sourceItemId}`];
const createdAt = "2026-08-02T08:30:00Z";

const governedMetadata = {
  employeeId,
  sourceItemId,
  revision: 1,
  schemaVersion: "context-analysis-output.v1",
  promptVersion: "context-summary-prompt.v1",
  routeTrace: {
    aiRunId,
    routeKey: "context.summarize.v1",
    routeConfigId,
    routeConfigVersion: 3,
  },
  sourceReferences,
  reviewStatus: "PENDING",
  revisionOrigin: "AI",
  correctionReason: null,
  createdAt,
} as const;

describe("context intelligence contracts", () => {
  it("validates the complete nullable Task draft without permitting rating-like output", () => {
    const draft = {
      title: "Prepare the context review",
      description: "Inspect the connected source and prepare a reviewable plan.",
      projectId: null,
      workstreamId: null,
      proposedAssigneeId: null,
      dueAt: null,
      acceptanceConditions: ["The employee can inspect every source reference."],
      sourceReferences,
      uncertainties: ["Project linkage requires employee review."],
    } as const;

    expect(TaskDraftSchema.parse(draft)).toEqual(draft);
    expect(() => TaskDraftSchema.parse({ ...draft, sourceReferences: [] })).toThrow();
    expect(() => TaskDraftSchema.parse({ ...draft, dueAt: "tomorrow" })).toThrow();
    expect(() => TaskDraftSchema.parse({ ...draft, recommendedRating: 5 })).toThrow();
  });

  it("requires schema version, prompt version, AI route trace, sources, review state, and supersession", () => {
    const analysis = {
      id: analysisId,
      ...governedMetadata,
      summary: "A source-grounded draft summary.",
      uncertainties: ["The Project is not yet confirmed."],
      supersedesAnalysisId: null,
    } as const;

    expect(ContextAnalysisSchema.parse(analysis)).toEqual(analysis);

    for (const missingField of [
      "schemaVersion",
      "promptVersion",
      "routeTrace",
      "sourceReferences",
      "reviewStatus",
      "supersedesAnalysisId",
    ] as const) {
      const invalid = { ...analysis } as Record<string, unknown>;
      delete invalid[missingField];
      expect(() => ContextAnalysisSchema.parse(invalid), missingField).toThrow();
    }

    expect(
      ContextAnalysisSchema.parse({
        ...analysis,
        id: "00000000-0000-4000-8000-000000000309",
        revision: 2,
        revisionOrigin: "EMPLOYEE",
        correctionReason: "The source describes a different deliverable.",
        reviewStatus: "CORRECTED",
        supersedesAnalysisId: analysis.id,
      }),
    ).toMatchObject({
      revision: 2,
      reviewStatus: "CORRECTED",
      supersedesAnalysisId: analysis.id,
    });
  });

  it("prevents model-only confidence from authorizing an automatic Project link", () => {
    const suggestion = {
      id: suggestionId,
      ...governedMetadata,
      schemaVersion: "project-link-suggestion-output.v1",
      promptVersion: "context-project-match-prompt.v1",
      routeTrace: { ...governedMetadata.routeTrace, routeKey: "context.project-match.v1" },
      analysisId,
      projectId,
      decision: "AUTO_LINK",
      explanation: "Two independent governed anchors support this Project.",
      anchors: [
        {
          kind: "EXPLICIT_PROJECT_REFERENCE",
          reference: "project-term:000000000001",
          conflicts: false,
        },
        {
          kind: "CALENDAR_CONTEXT",
          reference: "calendar-context:000000000002",
          conflicts: false,
        },
      ],
      supersedesSuggestionId: null,
    } as const;

    expect(ProjectLinkSuggestionSchema.parse(suggestion)).toEqual(suggestion);
    expect(() =>
      ProjectLinkSuggestionSchema.parse({
        ...suggestion,
        anchors: [],
        modelConfidence: 0.99,
      }),
    ).toThrow();
    expect(() =>
      ProjectLinkSuggestionSchema.parse({
        ...suggestion,
        anchors: [suggestion.anchors[0]],
      }),
    ).toThrow();
  });

  it("keeps employee Project corrections and Task-draft revisions explicit", () => {
    const correction = {
      id: "00000000-0000-4000-8000-000000000310",
      suggestionId,
      employeeId,
      previousProjectId: projectId,
      correctedProjectId: "00000000-0000-4000-8000-000000000311",
      action: "CORRECT",
      reason: "This source belongs to the customer rollout Project.",
      sourceReferences,
      supersedingSuggestionId: "00000000-0000-4000-8000-000000000312",
      createdAt,
    } as const;
    expect(SourceLinkCorrectionSchema.parse(correction)).toEqual(correction);

    const draftRecord = {
      id: taskDraftId,
      ...governedMetadata,
      schemaVersion: "task-draft-output.v1",
      promptVersion: "task-draft-prompt.v1",
      routeTrace: { ...governedMetadata.routeTrace, routeKey: "task.draft.v1" },
      draft: {
        title: "Prepare rollout checklist",
        description: "Draft only; no official Task has been created.",
        projectId,
        workstreamId: null,
        proposedAssigneeId: employeeId,
        dueAt: "2026-08-06T12:00:00Z",
        acceptanceConditions: ["Employee confirms the final Task before creation."],
        sourceReferences,
        uncertainties: [],
      },
      supersedesTaskDraftId: null,
    } as const;
    expect(TaskDraftRecordSchema.parse(draftRecord)).toEqual(draftRecord);
    expect(
      TaskDraftRecordSchema.parse({
        ...draftRecord,
        id: "00000000-0000-4000-8000-000000000313",
        revision: 2,
        revisionOrigin: "EMPLOYEE",
        correctionReason: "Employee clarified the acceptance condition.",
        reviewStatus: "CORRECTED",
        supersedesTaskDraftId: taskDraftId,
      }),
    ).toMatchObject({ revision: 2, supersedesTaskDraftId: taskDraftId });
  });
});
