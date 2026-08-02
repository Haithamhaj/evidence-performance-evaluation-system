import { describe, expect, it } from "vitest";

import { createContextReviewDraftStorage } from "./context-review-draft-storage.js";

const draft = {
  title: "Prepared title",
  description: "Employee edit that must survive reauthentication.",
  projectHandle: `opaque-project-${"x".repeat(40)}`,
};

describe("context review draft storage", () => {
  it("restores only editable Task fields by the server draft identity", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const drafts = createContextReviewDraftStorage(storage);

    const draftHandle = `opaque-task_draft-${"x".repeat(40)}`;
    drafts.save(draftHandle, draft);

    expect(drafts.load(draftHandle)).toEqual(draft);
    expect(JSON.stringify([...values.values()])).not.toContain("connected-source");
  });

  it("drops malformed browser storage instead of trusting it", () => {
    const values = new Map([
      [`context-review-draft:opaque-task_draft-${"x".repeat(40)}`, '{"title":true}'],
    ]);
    const drafts = createContextReviewDraftStorage({
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    });

    expect(drafts.load(`opaque-task_draft-${"x".repeat(40)}`)).toBeNull();
    expect(values.size).toBe(0);
  });
});
