import { describe, expect, it } from "vitest";

import {
  assertResearchRevisionCanBecomeCurrent,
  assertResearchScopeImmutable,
  assertResearchTransition,
  assertSingleActiveResearchOwner,
} from "./research-invariants.js";

describe("Research invariants", () => {
  it.each([
    ["DRAFT", "ACTIVE"],
    ["DRAFT", "CANCELLED"],
    ["ACTIVE", "CANCELLED"],
    ["ACTIVE", "SUPERSEDED"],
  ] as const)("allows %s -> %s", (from, to) => {
    expect(() =>
      assertResearchTransition(from, to, {
        reason: to === "CANCELLED" || to === "SUPERSEDED" ? "Approved disposition" : null,
        successorResearchId: to === "SUPERSEDED" ? "10000000-0000-4000-8000-000000000001" : null,
      }),
    ).not.toThrow();
  });

  it.each([
    ["DRAFT", "CONCLUDED"],
    ["ACTIVE", "CONCLUDED"],
    ["CONCLUDED", "ACTIVE"],
    ["CANCELLED", "ACTIVE"],
    ["SUPERSEDED", "ACTIVE"],
  ] as const)("rejects unavailable transition %s -> %s", (from, to) => {
    expect(() =>
      assertResearchTransition(from, to, { reason: null, successorResearchId: null }),
    ).toThrow(expect.objectContaining({ code: "RESEARCH_STATE_INVALID" }));
  });

  it("requires a reason and successor for supersession", () => {
    expect(() =>
      assertResearchTransition("ACTIVE", "SUPERSEDED", {
        reason: null,
        successorResearchId: null,
      }),
    ).toThrow(expect.objectContaining({ code: "RESEARCH_TRANSITION_REASON_REQUIRED" }));
    expect(() =>
      assertResearchTransition("ACTIVE", "SUPERSEDED", {
        reason: "Replaced",
        successorResearchId: null,
      }),
    ).toThrow(expect.objectContaining({ code: "RESEARCH_SUCCESSOR_REQUIRED" }));
  });

  it("keeps Project and narrower scope immutable after activation", () => {
    const original = {
      projectId: "10000000-0000-4000-8000-000000000001",
      workstreamId: null,
      workItemId: null,
    };
    expect(() => assertResearchScopeImmutable("DRAFT", original, { ...original })).not.toThrow();
    expect(() =>
      assertResearchScopeImmutable("ACTIVE", original, {
        ...original,
        projectId: "10000000-0000-4000-8000-000000000002",
      }),
    ).toThrow(expect.objectContaining({ code: "RESEARCH_SCOPE_IMMUTABLE" }));
  });

  it("allows only employee-authored or employee-confirmed AI revisions to become current", () => {
    expect(() =>
      assertResearchRevisionCanBecomeCurrent({ origin: "EMPLOYEE", employeeConfirmed: false }),
    ).not.toThrow();
    expect(() =>
      assertResearchRevisionCanBecomeCurrent({ origin: "AI_DRAFT", employeeConfirmed: false }),
    ).toThrow(expect.objectContaining({ code: "RESEARCH_AI_CONFIRMATION_REQUIRED" }));
    expect(() =>
      assertResearchRevisionCanBecomeCurrent({ origin: "AI_DRAFT", employeeConfirmed: true }),
    ).not.toThrow();
  });

  it("requires exactly one active owner matching the mutable root", () => {
    const events = [
      { employeeId: "owner-a", action: "STARTED" as const },
      { employeeId: "owner-a", action: "ENDED" as const },
      { employeeId: "owner-b", action: "STARTED" as const },
    ];
    expect(() => assertSingleActiveResearchOwner("owner-b", events)).not.toThrow();
    expect(() =>
      assertSingleActiveResearchOwner("owner-b", [
        { employeeId: "owner-a", action: "STARTED" },
        { employeeId: "owner-b", action: "STARTED" },
      ]),
    ).toThrow(expect.objectContaining({ code: "RESEARCH_OWNER_HISTORY_INVALID" }));
  });
});
