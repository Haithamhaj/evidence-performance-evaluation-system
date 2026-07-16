import { describe, expect, it } from "vitest";

import {
  EligibilitySnapshotSchema,
  ExcludeEligibilityInputSchema,
  OpenCycleInputSchema,
} from "./evaluation-cycle.js";

const employeeId = "4fd02cc1-2a49-4af6-a4a3-240e906495c5";

const openInput = {
  actorId: "9a11bb8f-79f5-4a72-a98f-2e763e97699b",
  managerId: "9a11bb8f-79f5-4a72-a98f-2e763e97699b",
  departmentId: "cfc37f55-68f1-4c7c-b787-b76c44f02e67",
  version: 1,
  visibilityMode: "identified",
  sourceReason: "Quarterly pilot cycle",
  effectiveFrom: "2026-07-01T00:00:00.000Z",
  effectiveTo: "2026-09-30T23:59:59.999Z",
  correlationId: "0e7a03a1-8152-4679-aa67-2410c6f1ec63",
  eligibleEmployees: [
    {
      employeeId,
      state: "pending",
      sourceReason: "Active department employee",
      effectiveFrom: "2026-07-01T00:00:00.000Z",
      effectiveTo: "2026-09-30T23:59:59.999Z",
    },
  ],
} as const;

describe("evaluation cycle contracts", () => {
  it("accepts a strict versioned cycle with all four bounded eligibility states", () => {
    for (const state of ["active", "excluded", "approved_leave", "pending"] as const) {
      expect(
        OpenCycleInputSchema.parse({
          ...openInput,
          eligibleEmployees: [{ ...openInput.eligibleEmployees[0], state }],
        }).eligibleEmployees[0]?.state,
      ).toBe(state);
    }

    expect(() => OpenCycleInputSchema.parse({ ...openInput, teamComplete: false })).toThrow();
    expect(() =>
      OpenCycleInputSchema.parse({
        ...openInput,
        eligibleEmployees: [openInput.eligibleEmployees[0], openInput.eligibleEmployees[0]],
      }),
    ).toThrow();
  });

  it("requires a trimmed 3-500 character reason for exclusion", () => {
    const input = {
      actorId: openInput.actorId,
      cycleId: "699511e9-4d42-4628-bc6f-c20aba6e17bf",
      employeeId,
      reason: "Approved cycle exclusion",
      effectiveAt: "2026-08-01T10:00:00.000Z",
      correlationId: openInput.correlationId,
    };

    expect(ExcludeEligibilityInputSchema.parse(input).reason).toBe(input.reason);
    expect(() => ExcludeEligibilityInputSchema.parse({ ...input, reason: " ab " })).toThrow();
    expect(() =>
      ExcludeEligibilityInputSchema.parse({ ...input, reason: "a".repeat(501) }),
    ).toThrow();
  });

  it("serializes frozen snapshot timestamps as UTC strings", () => {
    const snapshot = {
      id: "84aef3b5-1190-4d4f-aa0b-a83c1aef7696",
      cycleId: "699511e9-4d42-4628-bc6f-c20aba6e17bf",
      version: 1,
      visibilityMode: "identified",
      sourceReason: openInput.sourceReason,
      effectiveFrom: openInput.effectiveFrom,
      effectiveTo: openInput.effectiveTo,
      openedAt: "2026-07-01T00:00:00.000Z",
      entries: [
        {
          id: "cf2ec657-cc08-46c6-882d-d719d2e0de20",
          employeeId,
          state: "pending",
          sourceReason: "Active department employee",
          effectiveFrom: openInput.effectiveFrom,
          effectiveTo: openInput.effectiveTo,
          submittedAt: null,
        },
      ],
    };

    expect(EligibilitySnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(() =>
      EligibilitySnapshotSchema.parse({ ...snapshot, openedAt: "2026-07-01T03:00:00+03:00" }),
    ).toThrow();
  });
});
