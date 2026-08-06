import { getCatalog } from "@evaluation/localization";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EvaluationFactView } from "./evaluation-fact-view.js";

describe("EvaluationFactView", () => {
  it("shows source facts before separately labelled employee interpretation without decision controls", async () => {
    const sourceId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const view = {
      schemaVersion: 2 as const,
      cycle: {
        id: crypto.randomUUID(),
        startsAt: "2026-07-01T00:00:00.000Z",
        endsAt: "2026-09-30T23:59:59.999Z",
        rubricVersionId: crypto.randomUUID(),
      },
      subjectEmployeeId: crypto.randomUUID(),
      generatedAt: "2026-10-01T08:00:00.000Z",
      responsibilityWindows: [],
      projectFacts: [
        {
          kind: "source_fact" as const,
          sourceType: "project_contribution" as const,
          sourceId,
          sourceOccurredAt: "2026-08-14T10:00:00.000Z",
          projectId,
          workstreamId: null,
          relatedWorkItemId: null,
          criterionStableId: null,
          criterionVersionId: null,
          summary: "Implemented the approved release flow.",
          result: "The acceptance path passed.",
          verificationState: "source_supported" as const,
          attributionState: "employee_confirmed" as const,
          responsibilityWindowIds: [],
          sourceReferences: [
            {
              sourceType: "timeline_event" as const,
              sourceId,
              sourceVersion: 1,
              occurredAt: "2026-08-14T10:00:00.000Z",
              url: "https://example.test/source",
            },
          ],
        },
      ],
      confirmedEvidence: [],
      checkInFacts: [],
      dynamicCriteriaVersions: [],
      researchFacts: [
        {
          kind: "source_fact" as const,
          sourceType: "research" as const,
          factType: "experiment_conclusion" as const,
          sourceId: crypto.randomUUID(),
          sourceOccurredAt: "2026-08-15T10:00:00.000Z",
          projectId,
          workstreamId: null,
          relatedWorkItemId: null,
          humanConfirmationState: "human_decision" as const,
          verificationState: "source_supported" as const,
          responsibilityWindowIds: [],
          summary: "The bounded experiment supported the selected approach.",
          limitations: ["Small sample"],
          uncertainty: "Long-term behavior remains unknown.",
          sourceReferences: [
            {
              sourceType: "experiment_conclusion" as const,
              sourceId: crypto.randomUUID(),
              sourceVersion: null,
              occurredAt: "2026-08-15T10:00:00.000Z",
              url: null,
            },
          ],
        },
      ],
      employeeInterpretations: [
        {
          kind: "employee_interpretation" as const,
          id: crypto.randomUUID(),
          originalText: "I led the release flow.",
          normalizedText: "The employee states that they led the release flow.",
          sourceFactIds: [sourceId],
          createdAt: "2026-09-29T10:00:00.000Z",
        },
      ],
      sourceCoverageNotes: [],
    };
    const markup = renderToStaticMarkup(
      createElement(EvaluationFactView, {
        catalog: await getCatalog("en"),
        locale: "en",
        view,
      }),
    );

    expect(markup.indexOf("Source-supported work facts")).toBeLessThan(
      markup.indexOf("Employee interpretation"),
    );
    expect(markup).toContain("Implemented the approved release flow.");
    expect(markup).toContain("The employee states that they led the release flow.");
    expect(markup).toContain("The bounded experiment supported the selected approach.");
    expect(markup).not.toMatch(/<input|<select|<textarea|<button/iu);
  });
});
