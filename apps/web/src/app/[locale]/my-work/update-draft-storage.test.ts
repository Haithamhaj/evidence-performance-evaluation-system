import { afterEach, describe, expect, it } from "vitest";

import { loadUpdateDraft, removeUpdateDraft, saveUpdateDraft } from "./update-draft-storage.js";

const values = new Map<string, string>();

afterEach(() => values.clear());

Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  },
});

describe("daily Update draft storage", () => {
  it("round-trips an in-progress draft and removes it after confirmation", () => {
    saveUpdateDraft("employee-current", {
      projectId: "11111111-1111-4111-8111-111111111111",
      workstreamId: null,
      workItemId: null,
      rawText: "Deployment passed the approved acceptance check.",
      returnPath: "/en/my-work",
    });
    expect(loadUpdateDraft("employee-current")).toMatchObject({
      rawText: "Deployment passed the approved acceptance check.",
    });

    removeUpdateDraft("employee-current");
    expect(loadUpdateDraft("employee-current")).toBeNull();
  });

  it("fails closed for malformed or differently versioned browser data", () => {
    sessionStorage.setItem("daily-update:v1:employee-current", "{invalid");
    expect(loadUpdateDraft("employee-current")).toBeNull();
  });
});
