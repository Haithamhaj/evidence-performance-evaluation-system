import { describe, expect, it } from "vitest";

import { captureSession } from "./capture-session.js";

const draft = {
  rawText: "Authentication fallback works in staging.",
  sources: [{ kind: "link" as const, label: "https://github.com/atlas/voice/pull/184" }],
};

describe("universal Capture session", () => {
  it("preserves the raw draft through understanding, one clarification, and review", () => {
    const initial = captureSession(draft);
    const understanding = {
      schemaVersion: "capture-understanding.v1" as const,
      likelyProject: null,
      likelyMeaning: "project_update" as const,
      relatedWorkItemId: null,
      relatedComponentId: null,
      sourceRefs: [],
      clarification: { question: "Which Project is this for?", missingField: "project" },
      confidence: "uncertain" as const,
      createsOfficialRecord: false as const,
    };
    const clarify = initial.understanding(understanding);
    const answered = clarify.answer("Atlas Delivery");
    const review = answered.review();

    expect(clarify.state.kind).toBe("clarify");
    expect(answered.state.kind).toBe("clarify");
    expect(review.state).toMatchObject({ kind: "review", draft });
    expect("officialRecord" in review.state).toBe(false);
  });

  it("keeps private save and recoverable error available from the raw draft", () => {
    const session = captureSession(draft);
    expect(session.recover("assistant").state).toEqual({
      kind: "recoverable_error",
      draft,
      failedSource: "assistant",
    });
    expect(session.privateSaved(crypto.randomUUID()).state.kind).toBe("private_saved");
  });
});
