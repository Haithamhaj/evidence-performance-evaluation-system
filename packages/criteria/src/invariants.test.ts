import { describe, expect, it } from "vitest";

import {
  assertCollectionComplete,
  assertCriterionCount,
  assertManagerResolution,
  assertProspectiveEffectiveFrom,
  assertProposalTransition,
} from "./invariants.js";

describe("criteria invariants", () => {
  it.each([
    ["project", 0],
    ["project", 4],
    ["workstream", 1],
    ["workstream", 4],
  ] as const)("rejects %s count %i", (kind, count) => {
    expect(() => assertCriterionCount(kind, count)).toThrowError(
      expect.objectContaining({ code: "CRITERIA_COUNT_INVALID" }),
    );
  });

  it.each([
    ["project", 1],
    ["project", 3],
    ["workstream", 2],
    ["workstream", 3],
  ] as const)("accepts %s count %i", (kind, count) => {
    expect(() => assertCriterionCount(kind, count)).not.toThrow();
  });

  it("counts objections as complete but not missing responses", () => {
    expect(
      assertCollectionComplete(
        [
          { employeeId: "a", responseRequired: true },
          { employeeId: "b", responseRequired: true },
        ],
        [
          { employeeId: "a", response: "acknowledge" },
          { employeeId: "b", response: "object" },
        ],
      ),
    ).toEqual({ complete: true, objectionCount: 1 });
    expect(
      assertCollectionComplete(
        [
          { employeeId: "a", responseRequired: true },
          { employeeId: "b", responseRequired: true },
        ],
        [{ employeeId: "a", response: "acknowledge" }],
      ),
    ).toEqual({ complete: false, objectionCount: 0 });
    expect(assertCollectionComplete([], [])).toEqual({
      complete: true,
      objectionCount: 0,
    });
  });

  it("rejects duplicate, unknown, and owner responses", () => {
    expect(() =>
      assertCollectionComplete(
        [{ employeeId: "a", responseRequired: true }],
        [
          { employeeId: "a", response: "acknowledge" },
          { employeeId: "a", response: "object" },
        ],
      ),
    ).toThrowError(expect.objectContaining({ code: "CRITERIA_RESPONSE_INVALID" }));
    expect(() =>
      assertCollectionComplete(
        [{ employeeId: "owner", responseRequired: false }],
        [{ employeeId: "owner", response: "acknowledge" }],
      ),
    ).toThrowError(expect.objectContaining({ code: "CRITERIA_RESPONSE_INVALID" }));
  });

  it("requires preserved objections for either manager resolution", () => {
    expect(() =>
      assertManagerResolution(0, {
        decision: "accept_with_objections",
        reason: "No objections exist",
      }),
    ).toThrowError(expect.objectContaining({ code: "CRITERIA_RESOLUTION_INVALID" }));
    expect(() =>
      assertManagerResolution(1, {
        decision: "accept_with_objections",
        reason: "  ",
      }),
    ).toThrowError(expect.objectContaining({ code: "CRITERIA_RESOLUTION_INVALID" }));
    expect(
      assertManagerResolution(2, {
        decision: "request_revision",
        reason: "The preserved objections require a revised proposal.",
      }),
    ).toEqual({
      decision: "request_revision",
      reason: "The preserved objections require a revised proposal.",
    });
  });

  it("requires an effective start at or after approval and current time", () => {
    const approvedAt = new Date("2026-07-17T10:00:00.000Z");
    const now = new Date("2026-07-17T11:00:00.000Z");
    expect(() =>
      assertProspectiveEffectiveFrom(new Date("2026-07-17T10:59:59.999Z"), approvedAt, now),
    ).toThrowError(expect.objectContaining({ code: "CRITERIA_EFFECTIVE_FROM_INVALID" }));
    expect(() =>
      assertProspectiveEffectiveFrom(new Date("2026-07-17T11:00:00.000Z"), approvedAt, now),
    ).not.toThrow();
  });

  it("permits only the declared proposal lifecycle", () => {
    expect(() => assertProposalTransition("owner_review", "approved")).not.toThrow();
    expect(() => assertProposalTransition("approved", "activated")).not.toThrow();
    expect(() => assertProposalTransition("activated", "owner_review")).toThrowError(
      expect.objectContaining({ code: "CRITERIA_TRANSITION_INVALID" }),
    );
  });
});
