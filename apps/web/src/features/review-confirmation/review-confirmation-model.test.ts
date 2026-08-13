import { describe, expect, it } from "vitest";

import {
  createReviewState,
  editEvidence,
  editUpdate,
  selectedActions,
  toggleEvidence,
  toggleProgressProposal,
  toggleUpdate,
} from "./review-confirmation-model.js";

const draft = {
  schemaVersion: "review-confirmation-draft.v1" as const,
  captureId: "10000000-0000-4000-8000-000000000004",
  project: { id: "10000000-0000-4000-8000-000000000001", name: "Atlas Delivery" },
  workItem: {
    id: "10000000-0000-4000-8000-000000000002",
    title: "Validate streaming fallback",
  },
  update: {
    sessionId: "10000000-0000-4000-8000-000000000005",
    expectedVersion: 1,
    editable: true as const,
    selected: true,
    summary: "Streaming fallback works in staging.",
    result: "The fallback path completed successfully.",
    nextAction: "Confirm the API error source.",
    sourceRefs: [
      {
        kind: "github" as const,
        label: "PR #184",
        observedAt: "2026-08-13T08:00:00Z",
        freshness: "fresh" as const,
      },
    ],
  },
  evidence: [
    {
      draftId: "10000000-0000-4000-8000-000000000006",
      expectedRevision: 1,
      selected: false,
      employeeEditRequired: true,
      employeeEdited: false,
      supportedClaim: "Fallback works in staging.",
      contributionContext: "AI draft",
      sourceRefs: [
        {
          kind: "github" as const,
          label: "PR #184",
          observedAt: "2026-08-13T08:00:00Z",
          freshness: "fresh" as const,
        },
      ],
    },
  ],
  progressProposal: {
    componentId: "10000000-0000-4000-8000-000000000003",
    selected: false,
    proposedValue: "1.8%",
    rationale: "Owner must verify the measurement source.",
    mutatesOfficialProgress: false as const,
    requiresOwnerConfirmation: true,
    sourceRefs: [
      {
        kind: "manual_capture" as const,
        label: "API metrics",
        observedAt: "2026-08-13T08:00:00Z",
        freshness: "fresh" as const,
      },
    ],
  },
  uncertainty: "The measurement source is still missing.",
  afterConfirmation: ["The Update will be appended to the Project Timeline."],
};

describe("review confirmation model", () => {
  it("keeps Update, Evidence, and progress proposal independently selectable", () => {
    let state = createReviewState(draft);
    state = toggleUpdate(state, false);
    state = editEvidence(state, draft.evidence[0]!.draftId, {
      supportedClaim: "Fallback completed successfully in staging.",
      contributionContext: "I implemented and verified the fallback path.",
    });
    state = toggleEvidence(state, draft.evidence[0]!.draftId, true);
    state = toggleProgressProposal(state, true);

    expect(state.update?.selected).toBe(false);
    expect(state.evidence[0]?.selected).toBe(true);
    expect(state.progressProposal?.selected).toBe(true);
  });

  it("requires an employee edit before GitHub evidence can be selected", () => {
    const initial = createReviewState(draft);
    expect(() => toggleEvidence(initial, draft.evidence[0]!.draftId, true)).toThrow(
      "EMPLOYEE_EDIT_REQUIRED",
    );

    const edited = editEvidence(initial, draft.evidence[0]!.draftId, {
      supportedClaim: "Fallback completed successfully in staging.",
      contributionContext: "I implemented and verified the fallback path.",
    });
    expect(toggleEvidence(edited, draft.evidence[0]!.draftId, true).evidence[0]).toMatchObject({
      employeeEdited: true,
      selected: true,
    });
  });

  it("preserves employee edits and lists only intended commands", () => {
    const edited = editUpdate(createReviewState(draft), {
      summary: "Fallback validated in staging.",
      result: "The measured request completed through the fallback.",
      nextAction: "Attach the verified error-rate source.",
    });
    const actions = selectedActions(edited);

    expect(edited.update?.summary).toBe("Fallback validated in staging.");
    expect(actions.map(({ kind }) => kind)).toEqual(["update"]);
    expect(actions).not.toContainEqual(expect.objectContaining({ kind: "progress_proposal" }));
  });
});
