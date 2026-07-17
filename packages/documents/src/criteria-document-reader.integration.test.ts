import { describe, expect, it } from "vitest";

import { assertReadinessLifecycleTransition } from "./criteria-document-reader.js";

describe("criteria document lifecycle port", () => {
  it("allows only explicit append-only lifecycle transitions", () => {
    expect(() =>
      assertReadinessLifecycleTransition("ready_for_criteria_generation", "criteria_approved"),
    ).not.toThrow();
    expect(() => assertReadinessLifecycleTransition("draft", "criteria_approved")).toThrow();
  });
});
