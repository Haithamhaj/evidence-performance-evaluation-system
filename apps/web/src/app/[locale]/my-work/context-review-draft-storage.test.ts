import { describe, expect, it } from "vitest";

import { createContextReviewDraftStorage } from "./context-review-draft-storage.js";

const draft = {
  title: "Prepared title",
  description: "Employee edit that must survive reauthentication.",
  projectId: "33333333-3333-4333-8333-333333333333",
  assigneeId: "11111111-1111-4111-8111-111111111111",
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

    drafts.save("44444444-4444-4444-8444-444444444444", draft);

    expect(drafts.load("44444444-4444-4444-8444-444444444444")).toEqual(draft);
    expect(JSON.stringify([...values.values()])).not.toContain("connected-source");
  });

  it("drops malformed browser storage instead of trusting it", () => {
    const values = new Map([
      ["context-review-draft:44444444-4444-4444-8444-444444444444", '{"title":true}'],
    ]);
    const drafts = createContextReviewDraftStorage({
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    });

    expect(drafts.load("44444444-4444-4444-8444-444444444444")).toBeNull();
    expect(values.size).toBe(0);
  });
});
