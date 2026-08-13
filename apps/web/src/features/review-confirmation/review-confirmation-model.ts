import type { z } from "zod";

import type { ReviewConfirmationDraftV1Schema } from "@evaluation/contracts";

export type ReviewConfirmationDraft = z.infer<typeof ReviewConfirmationDraftV1Schema>;
export type ReviewState = ReviewConfirmationDraft;
export type SelectedReviewAction =
  | Readonly<{
      kind: "update";
      id: string;
      expectedVersion: number;
      summary: string;
      result: string;
      nextAction: string;
      relatedProgressComponentIds: readonly string[];
    }>
  | Readonly<{
      kind: "evidence";
      id: string;
      expectedVersion: number;
      supportedClaim: string;
      contributionContext: string;
    }>;

export function createReviewState(draft: ReviewConfirmationDraft): ReviewState {
  return structuredClone(draft);
}

export function toggleUpdate(state: ReviewState, selected: boolean): ReviewState {
  return state.update === null ? state : { ...state, update: { ...state.update, selected } };
}

export function editUpdate(
  state: ReviewState,
  edit: Pick<NonNullable<ReviewState["update"]>, "nextAction" | "result" | "summary">,
): ReviewState {
  return state.update === null ? state : { ...state, update: { ...state.update, ...edit } };
}

export function editEvidence(
  state: ReviewState,
  draftId: string,
  edit: Pick<ReviewState["evidence"][number], "contributionContext" | "supportedClaim">,
): ReviewState {
  return {
    ...state,
    evidence: state.evidence.map((item) =>
      item.draftId === draftId ? { ...item, ...edit, employeeEdited: true } : item,
    ),
  };
}

export function toggleEvidence(
  state: ReviewState,
  draftId: string,
  selected: boolean,
): ReviewState {
  return {
    ...state,
    evidence: state.evidence.map((item) => {
      if (item.draftId !== draftId) return item;
      if (selected && item.employeeEditRequired && !item.employeeEdited) {
        throw new Error("EMPLOYEE_EDIT_REQUIRED");
      }
      return { ...item, selected };
    }),
  };
}

export function toggleProgressProposal(state: ReviewState, selected: boolean): ReviewState {
  return state.progressProposal === null
    ? state
    : { ...state, progressProposal: { ...state.progressProposal, selected } };
}

export function selectedActions(state: ReviewState): readonly SelectedReviewAction[] {
  return [
    ...(state.update?.selected === true
      ? [
          {
            kind: "update" as const,
            id: state.update.sessionId,
            expectedVersion: state.update.expectedVersion,
            summary: state.update.summary,
            result: state.update.result,
            nextAction: state.update.nextAction,
            relatedProgressComponentIds:
              state.progressProposal?.selected === true ? [state.progressProposal.componentId] : [],
          },
        ]
      : []),
    ...state.evidence
      .filter(({ selected }) => selected)
      .map(({ draftId, expectedRevision }) => ({
        kind: "evidence" as const,
        id: draftId,
        expectedVersion: expectedRevision,
        supportedClaim: state.evidence.find((item) => item.draftId === draftId)!.supportedClaim,
        contributionContext: state.evidence.find((item) => item.draftId === draftId)!
          .contributionContext,
      })),
  ];
}
