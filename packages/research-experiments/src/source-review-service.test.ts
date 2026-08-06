import { describe, expect, it } from "vitest";

import {
  assertSourceReviewTransition,
  recoveryOptionsFor,
  sanitizeResearchDisplayUrl,
  sourceInputFingerprint,
} from "./source-review-service.js";

describe("Research source-review state policy", () => {
  it.each([
    ["PENDING_RETRIEVAL", "READY_FOR_REVIEW"],
    ["PENDING_RETRIEVAL", "PARTIAL"],
    ["PENDING_RETRIEVAL", "BLOCKED"],
    ["READY_FOR_REVIEW", "CONFIRMED"],
    ["READY_FOR_REVIEW", "DISMISSED"],
    ["READY_FOR_REVIEW", "STALE"],
    ["PARTIAL", "CONFIRMED"],
    ["PARTIAL", "DISMISSED"],
    ["PARTIAL", "STALE"],
    ["STALE", "READY_FOR_REVIEW"],
    ["STALE", "PARTIAL"],
    ["STALE", "BLOCKED"],
  ] as const)("allows %s to become %s", (from, to) => {
    expect(() => assertSourceReviewTransition(from, to)).not.toThrow();
  });

  it.each([
    ["PENDING_RETRIEVAL", "CONFIRMED"],
    ["BLOCKED", "CONFIRMED"],
    ["CONFIRMED", "STALE"],
    ["DISMISSED", "READY_FOR_REVIEW"],
  ] as const)("rejects the invalid %s to %s transition", (from, to) => {
    expect(() => assertSourceReviewTransition(from, to)).toThrow(
      expect.objectContaining({ code: "RESEARCH_SOURCE_REVIEW_STATE_INVALID" }),
    );
  });

  it("returns only the approved structured recovery choices for incomplete retrieval", () => {
    expect(recoveryOptionsFor("PARTIAL").map(({ kind }) => kind)).toEqual([
      "UPLOAD_DOCUMENT",
      "ADD_MANUAL_CITATION",
      "TRY_AGAIN",
    ]);
    expect(recoveryOptionsFor("BLOCKED").map(({ kind }) => kind)).toEqual([
      "UPLOAD_DOCUMENT",
      "ADD_MANUAL_CITATION",
      "TRY_AGAIN",
    ]);
    expect(recoveryOptionsFor("RETRIEVED")).toEqual([]);
  });

  it("creates a stable source identity without exposing the original URL", () => {
    const first = sourceInputFingerprint({
      kind: "URL",
      url: "https://example.com/private-paper?ticket=sensitive#section",
    });
    const replay = sourceInputFingerprint({
      kind: "URL",
      url: "https://example.com/private-paper?ticket=sensitive#section",
    });
    const changed = sourceInputFingerprint({
      kind: "URL",
      url: "https://example.com/private-paper?ticket=changed#section",
    });

    expect(first).toBe(replay);
    expect(first).not.toBe(changed);
    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(first).not.toContain("sensitive");
  });

  it("removes credentials, query, and fragment from the queryable display URL", () => {
    expect(
      sanitizeResearchDisplayUrl(
        "https://employee:secret@example.com/paper?id=private#confidential",
      ),
    ).toBe("https://example.com/paper");
  });
});
