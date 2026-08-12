import { afterEach, describe, expect, it } from "vitest";

import { sourceReviewEnabled } from "./source-review-flag.js";

const original = process.env.AI_NATIVE_SOURCE_REVIEW_ENABLED;

afterEach(() => {
  if (original === undefined) delete process.env.AI_NATIVE_SOURCE_REVIEW_ENABLED;
  else process.env.AI_NATIVE_SOURCE_REVIEW_ENABLED = original;
});

describe("sourceReviewEnabled", () => {
  it("enables the approved source journey by default", () => {
    delete process.env.AI_NATIVE_SOURCE_REVIEW_ENABLED;
    expect(sourceReviewEnabled()).toBe(true);
  });

  it("retains the existing manual and connected-context routes as rollback", () => {
    process.env.AI_NATIVE_SOURCE_REVIEW_ENABLED = "false";
    expect(sourceReviewEnabled()).toBe(false);
  });
});
