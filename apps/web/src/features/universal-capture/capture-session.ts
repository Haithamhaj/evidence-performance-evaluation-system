export type CaptureDraft = Readonly<{
  rawText: string;
  sources: readonly Readonly<{
    kind: "voice" | "link" | "image" | "code" | "file";
    label: string;
  }>[];
}>;

type Understanding = import("@evaluation/contracts/employee-experience").CaptureUnderstandingV1;
type ClarificationAnswer = Readonly<{ field: string; answer: string }>;

export type CaptureSessionState =
  | Readonly<{ kind: "capture"; draft: CaptureDraft }>
  | Readonly<{ kind: "understanding"; draft: CaptureDraft }>
  | Readonly<{
      kind: "clarify";
      draft: CaptureDraft;
      understanding: Understanding;
      answers: readonly ClarificationAnswer[];
    }>
  | Readonly<{ kind: "review"; draft: CaptureDraft; understanding: Understanding }>
  | Readonly<{ kind: "private_saved"; inboxItemId: string }>
  | Readonly<{ kind: "recoverable_error"; draft: CaptureDraft; failedSource: string }>;

export function captureSession(
  draft: CaptureDraft,
  state: CaptureSessionState = { kind: "capture", draft },
) {
  return {
    state,
    understanding(value: Understanding) {
      return captureSession(
        draft,
        value.clarification === null
          ? { kind: "review", draft, understanding: value }
          : { kind: "clarify", draft, understanding: value, answers: [] },
      );
    },
    answer(answer: string) {
      if (state.kind !== "clarify" || state.understanding.clarification === null) return this;
      return captureSession(draft, {
        ...state,
        answers: [
          ...state.answers,
          { field: state.understanding.clarification.missingField, answer },
        ],
      });
    },
    review() {
      if (state.kind !== "clarify") return this;
      return captureSession(draft, { kind: "review", draft, understanding: state.understanding });
    },
    recover(failedSource: string) {
      return captureSession(draft, { kind: "recoverable_error", draft, failedSource });
    },
    privateSaved(inboxItemId: string) {
      return captureSession(draft, { kind: "private_saved", inboxItemId });
    },
  };
}
