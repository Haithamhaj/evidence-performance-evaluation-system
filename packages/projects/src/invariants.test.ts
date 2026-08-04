import { describe, expect, it } from "vitest";
import {
  assertLifecycleTransition,
  assertResponsibilityWindow,
  containsInstant,
  ownerResponsibilityTypes,
} from "./invariants.js";

const managerDecision = {
  managerDecisionById: "00000000-0000-4000-8000-000000000001",
  managerDecisionAt: "2026-07-16T12:00:00Z",
  managerDecisionReason: "Approved responsibility",
} as const;

describe("project invariants", () => {
  it("requires an owner before activation", () => {
    expect(() => assertLifecycleTransition("draft", "active", false)).toThrowError(
      expect.objectContaining({ code: "PRIMARY_OWNER_REQUIRED" }),
    );
  });

  it("enforces the lifecycle graph", () => {
    expect(() => assertLifecycleTransition("draft", "active", true)).not.toThrow();
    expect(() => assertLifecycleTransition("active", "paused", true)).not.toThrow();
    expect(() => assertLifecycleTransition("paused", "completed", true)).not.toThrow();
    expect(() => assertLifecycleTransition("completed", "active", true)).toThrowError(
      expect.objectContaining({ code: "LIFECYCLE_TRANSITION_INVALID" }),
    );
    expect(() => assertLifecycleTransition("archived", "active", true)).toThrowError(
      expect.objectContaining({ code: "LIFECYCLE_TRANSITION_INVALID" }),
    );
  });

  it("accepts half-open contributor windows and rejects zero duration", () => {
    const window = {
      startsAt: "2026-07-17T00:00:00Z",
      endsAt: "2026-07-18T00:00:00Z",
    };

    expect(containsInstant(window, "2026-07-17T00:00:00Z")).toBe(true);
    expect(containsInstant(window, "2026-07-17T23:59:59Z")).toBe(true);
    expect(containsInstant(window, "2026-07-18T00:00:00Z")).toBe(false);
    expect(() =>
      assertResponsibilityWindow({
        responsibilityType: "contributor",
        startsAt: "2026-07-17T00:00:00Z",
        endsAt: "2026-07-17T00:00:00Z",
        reason: "Contribution",
        managerDecisionById: null,
        managerDecisionAt: null,
        managerDecisionReason: null,
        delegationType: null,
      }),
    ).toThrowError(expect.objectContaining({ code: "RESPONSIBILITY_WINDOW_INVALID" }));
  });

  it("supports open-ended windows and rejects invalid instants", () => {
    expect(
      containsInstant({ startsAt: "2026-07-17T00:00:00Z", endsAt: null }, "2027-01-01T00:00:00Z"),
    ).toBe(true);
    expect(containsInstant({ startsAt: "invalid", endsAt: null }, "2027-01-01T00:00:00Z")).toBe(
      false,
    );
    expect(() =>
      assertResponsibilityWindow({
        responsibilityType: "contributor",
        startsAt: "invalid",
        endsAt: null,
        reason: "Contribution",
        managerDecisionById: null,
        managerDecisionAt: null,
        managerDecisionReason: null,
        delegationType: null,
      }),
    ).toThrowError(expect.objectContaining({ code: "RESPONSIBILITY_WINDOW_INVALID" }));
  });

  it("requires the complete manager-decision triad for owner responsibilities", () => {
    expect(() =>
      assertResponsibilityWindow({
        responsibilityType: "permanent",
        startsAt: "2026-07-17T00:00:00Z",
        endsAt: null,
        reason: "Permanent transfer",
        managerDecisionById: managerDecision.managerDecisionById,
        managerDecisionAt: null,
        managerDecisionReason: managerDecision.managerDecisionReason,
        delegationType: null,
      }),
    ).toThrowError(expect.objectContaining({ code: "MANAGER_DECISION_REQUIRED" }));
  });

  it("requires finite acting ownership and delegation data", () => {
    expect(() =>
      assertResponsibilityWindow({
        responsibilityType: "acting",
        startsAt: "2026-07-17T00:00:00Z",
        endsAt: null,
        reason: "Cover approved absence",
        managerDecisionById: null,
        managerDecisionAt: null,
        managerDecisionReason: null,
        delegationType: null,
      }),
    ).toThrowError(expect.objectContaining({ code: "MANAGER_DECISION_REQUIRED" }));

    expect(() =>
      assertResponsibilityWindow({
        responsibilityType: "acting",
        startsAt: "2026-07-17T00:00:00Z",
        endsAt: null,
        reason: "Cover approved absence",
        ...managerDecision,
        delegationType: "approved_leave",
      }),
    ).toThrowError(expect.objectContaining({ code: "ACTING_WINDOW_END_REQUIRED" }));

    expect(() =>
      assertResponsibilityWindow({
        responsibilityType: "acting",
        startsAt: "2026-07-17T00:00:00Z",
        endsAt: "2026-07-18T00:00:00Z",
        reason: "Cover approved absence",
        ...managerDecision,
        delegationType: null,
      }),
    ).toThrowError(expect.objectContaining({ code: "ACTING_DELEGATION_REQUIRED" }));
  });

  it("forbids delegation data for non-acting responsibilities", () => {
    expect(() =>
      assertResponsibilityWindow({
        responsibilityType: "original",
        startsAt: "2026-07-17T00:00:00Z",
        endsAt: null,
        reason: "Initial owner",
        ...managerDecision,
        delegationType: "not_applicable",
      }),
    ).toThrowError(expect.objectContaining({ code: "DELEGATION_NOT_ALLOWED" }));

    expect(() =>
      assertResponsibilityWindow({
        responsibilityType: "contributor",
        startsAt: "2026-07-17T00:00:00Z",
        endsAt: null,
        reason: "Contribution",
        managerDecisionById: null,
        managerDecisionAt: null,
        managerDecisionReason: null,
        delegationType: "not_applicable",
      }),
    ).toThrowError(expect.objectContaining({ code: "DELEGATION_NOT_ALLOWED" }));
  });

  it("identifies the only owner responsibility types", () => {
    expect(ownerResponsibilityTypes).toEqual(["original", "acting", "permanent"]);
  });
});
