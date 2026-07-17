import { describe, expect, it, vi } from "vitest";

import { mapManagerReadiness, readinessAllowedByExtraction } from "./readiness-service.js";

describe("ReadinessService rules", () => {
  it("requires fully extracted original text before criteria readiness", () => {
    expect(
      readinessAllowedByExtraction({
        coverage: "complete",
        sources: [
          {
            reference: `document-source:${crypto.randomUUID()}`,
            mediaType: "text/markdown",
            coverage: "complete",
            sha256: "a".repeat(64),
            contentBase64: "YQ==",
          },
        ],
      }),
    ).toBe(true);
    expect(
      readinessAllowedByExtraction({
        coverage: "unsupported",
        sources: [
          {
            reference: `document-source:${crypto.randomUUID()}`,
            mediaType: "text/uri-list",
            coverage: "unsupported",
            reason: "not_fetched",
          },
        ],
      }),
    ).toBe(false);
  });

  it("projects manager state without details or scoring values", () => {
    expect(mapManagerReadiness("ready_for_criteria_generation", [], true)).toEqual({
      state: "ready",
    });
    expect(mapManagerReadiness("incomplete", [{ templateSectionKey: "scope" }], true)).toEqual({
      state: "missing_critical_information",
    });
    expect(mapManagerReadiness("incomplete", [], true)).toEqual({ state: "needs_attention" });
    expect(JSON.stringify(mapManagerReadiness("incomplete", [], false))).not.toMatch(
      /percentage|rank|rating|missingItems/u,
    );
    expect(vi.fn()).not.toHaveBeenCalled();
  });
});
