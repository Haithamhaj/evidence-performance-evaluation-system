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

  it("recovers source metadata and return path without retaining file bodies or secret text", () => {
    saveUpdateDraft("employee-current", {
      projectId: "11111111-1111-4111-8111-111111111111",
      workstreamId: null,
      workItemId: null,
      rawText: "Deployment passed the approved acceptance check.",
      sources: [
        { kind: "file", uploadedSourceId: "22222222-2222-4222-8222-222222222222" },
        { kind: "url", url: "https://example.invalid/acceptance" },
        { kind: "cli_snapshot", text: "secret-token=do-not-store" },
      ] as unknown as readonly { kind: string }[],
      returnPath: "/en/my-work?capture=resume",
    });
    const recovered = loadUpdateDraft("employee-current");
    expect(recovered).toMatchObject({
      returnPath: "/en/my-work?capture=resume",
      sources: [
        { kind: "file", uploadedSourceId: "22222222-2222-4222-8222-222222222222" },
        { kind: "url", url: "https://example.invalid/acceptance" },
        { kind: "cli_snapshot" },
      ],
    });
    expect(JSON.stringify(recovered)).not.toContain("blob");
    expect(JSON.stringify(recovered)).not.toContain("secret-token");
  });

  it("fails closed for malformed or differently versioned browser data", () => {
    sessionStorage.setItem("daily-update:v1:employee-current", "{invalid");
    expect(loadUpdateDraft("employee-current")).toBeNull();
  });
});
