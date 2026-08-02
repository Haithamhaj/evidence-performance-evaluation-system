import { describe, expect, it, vi } from "vitest";

import {
  confirmTaskDraft,
  listContextReviewQueue,
  prepareTaskDraft,
} from "./context-intelligence-api.js";

const employeeId = "11111111-1111-4111-8111-111111111111";
const sourceItemId = "22222222-2222-4222-8222-222222222222";
const projectId = "33333333-3333-4333-8333-333333333333";
const taskDraftId = "44444444-4444-4444-8444-444444444444";
const routeConfigId = "55555555-5555-4555-8555-555555555555";
const aiRunId = "66666666-6666-4666-8666-666666666666";

const taskDraft = {
  kind: "TASK_DRAFT",
  id: taskDraftId,
  employeeId,
  sourceItemId,
  revision: 1,
  schemaVersion: "task-draft-output.v1",
  promptVersion: "task-draft-prompt.v1",
  routeTrace: {
    aiRunId,
    routeKey: "task.draft.v1",
    routeConfigId,
    routeConfigVersion: 1,
  },
  sourceReferences: [`connected-source:${sourceItemId}`],
  reviewStatus: "PENDING",
  revisionOrigin: "AI",
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
    uncertainties: ["The Project needs your confirmation."],
  },
  supersedesTaskDraftId: null,
  clarification: {
    requiredFields: ["projectId", "assigneeId"],
    nextQuestion: { field: "projectId", sourceItemId },
  },
} as const;

describe("Context Intelligence browser gateway", () => {
  it("loads the employee's review queue through the same-origin gateway without a browser bearer token", async () => {
    const request = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ items: [taskDraft] }), { status: 200 }));

    await expect(listContextReviewQueue()).resolves.toEqual({ items: [taskDraft] });
    expect(request).toHaveBeenCalledWith("/api/daily-work/context/review-queue", {
      cache: "no-store",
      headers: { accept: "application/json" },
      method: "GET",
    });
  });

  it("preserves a useful editable draft and asks only the first missing confirmation field", async () => {
    const request = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(taskDraft), { status: 200 }));

    await expect(prepareTaskDraft(sourceItemId)).resolves.toEqual(taskDraft);
    expect(request).toHaveBeenCalledWith("/api/daily-work/context/task-drafts", {
      cache: "no-store",
      headers: { accept: "application/json", "content-type": "application/json" },
      method: "POST",
      body: JSON.stringify({ sourceItemId }),
    });
  });

  it("sends only human-edited official Task fields when confirming a draft", async () => {
    const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          taskDraftId,
          confirmedRevision: 2,
          workItem: {
            id: "77777777-7777-4777-8777-777777777777",
            projectId,
            assigneeId: employeeId,
          },
        }),
        { status: 200 },
      ),
    );

    await confirmTaskDraft({
      id: taskDraftId,
      expectedRevision: 1,
      reason: "I reviewed the prepared Task.",
      draft: {
        title: "Prepare the rollout note",
        description: "Review the agreed next steps.",
        projectId,
        workstreamId: null,
        assigneeId: employeeId,
        dueAt: null,
        acceptanceConditions: [],
      },
    });

    expect(request).toHaveBeenCalledWith(
      `/api/daily-work/context/task-drafts/${taskDraftId}/confirm`,
      expect.objectContaining({
        method: "POST",
        body: expect.not.stringContaining(sourceItemId),
      }),
    );
  });
});
