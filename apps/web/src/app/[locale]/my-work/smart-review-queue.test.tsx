import { getCatalog } from "@evaluation/localization";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProjectMatchCard } from "./project-match-card.js";
import { TaskDraftSheetView } from "./task-draft-sheet.js";

const employeeId = "11111111-1111-4111-8111-111111111111";
const sourceItemId = "22222222-2222-4222-8222-222222222222";
const projectId = "33333333-3333-4333-8333-333333333333";

const suggestion = {
  kind: "PROJECT_SUGGESTION" as const,
  id: "44444444-4444-4444-8444-444444444444",
  employeeId,
  sourceItemId,
  revision: 1,
  schemaVersion: "project-link-suggestion-output.v1",
  promptVersion: "context-project-match-prompt.v1",
  routeTrace: {
    aiRunId: "55555555-5555-4555-8555-555555555555",
    routeKey: "context.project-match.v1",
    routeConfigId: "66666666-6666-4666-8666-666666666666",
    routeConfigVersion: 1,
  },
  sourceReferences: [`connected-source:${sourceItemId}`],
  reviewStatus: "PENDING" as const,
  revisionOrigin: "AI" as const,
  correctionReason: null,
  createdAt: "2026-08-02T08:30:00Z",
  analysisId: "77777777-7777-4777-8777-777777777777",
  projectId,
  decision: "AUTO_LINK" as const,
  explanation: "Two approved context anchors match this Project.",
  anchors: [
    {
      kind: "EXPLICIT_PROJECT_REFERENCE" as const,
      reference: "project-term:000000000001",
      conflicts: false,
    },
    {
      kind: "CALENDAR_CONTEXT" as const,
      reference: "calendar-context:000000000002",
      conflicts: false,
    },
  ],
  supersedesSuggestionId: null,
};

const draft = {
  kind: "TASK_DRAFT" as const,
  id: "88888888-8888-4888-8888-888888888888",
  employeeId,
  sourceItemId,
  revision: 1,
  schemaVersion: "task-draft-output.v1",
  promptVersion: "task-draft-prompt.v1",
  routeTrace: {
    aiRunId: "99999999-9999-4999-8999-999999999999",
    routeKey: "task.draft.v1",
    routeConfigId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    routeConfigVersion: 1,
  },
  sourceReferences: [`connected-source:${sourceItemId}`],
  reviewStatus: "PENDING" as const,
  revisionOrigin: "AI" as const,
  correctionReason: null,
  createdAt: "2026-08-02T08:30:00Z",
  draft: {
    title: "Prepare the rollout note",
    description: "Review the agreed next steps.",
    projectId: null,
    workstreamId: null,
    proposedAssigneeId: null,
    dueAt: null,
    acceptanceConditions: [],
    sourceReferences: [`connected-source:${sourceItemId}`],
    uncertainties: ["Due date is optional and unknown."],
  },
  supersedesTaskDraftId: null,
  clarification: {
    requiredFields: ["projectId", "assigneeId"] as ("projectId" | "assigneeId")[],
    nextQuestion: { field: "projectId" as const, sourceItemId },
  },
};

describe("smart context review queue", () => {
  it("shows an explainable prepared Project match with correction and rejection choices", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(ProjectMatchCard, {
        catalog,
        locale: "en",
        projects: [{ id: projectId, name: "Atlas Delivery" }],
        suggestion,
      }),
    );

    expect(markup).toContain("Prepared");
    expect(markup).toContain("Likely linked because");
    expect(markup).toContain("Atlas Delivery");
    expect(markup).toContain("Confirm link");
    expect(markup).toContain("Choose another Project");
    expect(markup).toContain("Not a Project link");
    expect(markup).not.toContain(suggestion.id);
    expect(markup).not.toContain(sourceItemId);
  });

  it("shows one focused question and the shareable Task preview before confirmation", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(TaskDraftSheetView, {
        catalog,
        locale: "en",
        draft,
        projects: [{ id: projectId, name: "Atlas Delivery" }],
      }),
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("Needs your review");
    expect(markup).toContain("Which Project should this Task belong to?");
    expect(markup).toContain("What will become shared");
    expect(markup).toContain("Prepare the rollout note");
    expect(markup).toContain("Confirm Task");
    expect(markup).not.toContain(sourceItemId);
    expect(markup).not.toContain("Private source");
  });

  it("moves to the assignee question without showing two clarification controls", async () => {
    const catalog = await getCatalog("en");
    const markup = renderToStaticMarkup(
      createElement(TaskDraftSheetView, {
        catalog,
        draft: { ...draft, draft: { ...draft.draft, projectId } },
        locale: "en",
        projects: [{ id: projectId, name: "Atlas Delivery" }],
      }),
    );

    expect(markup).toContain("Who should be responsible for this Task?");
    expect(markup).not.toContain("Which Project should this Task belong to?");
  });

  it("keeps the review vocabulary available in Arabic RTL without exposing technical IDs", async () => {
    const catalog = await getCatalog("ar");
    const markup = renderToStaticMarkup(
      createElement(ProjectMatchCard, {
        catalog,
        locale: "ar",
        projects: [{ id: projectId, name: "Atlas Delivery" }],
        suggestion,
      }),
    );

    expect(markup).toContain('dir="rtl"');
    expect(markup).toContain("تم الإعداد");
    expect(markup).not.toContain(suggestion.id);
  });
});
