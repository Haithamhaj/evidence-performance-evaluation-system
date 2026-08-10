import { describe, expect, it } from "vitest";

import {
  DelegationScopeSchema,
  LeaveRecordSchema,
  LeaveStateSchema,
  OperationalLeaveProjectionSchema,
  ReassignmentResolutionSchema,
  UtcIntervalSchema,
} from "./continuity.js";

const id = "10000000-0000-4000-8000-000000000001";
const otherId = "10000000-0000-4000-8000-000000000002";

describe("continuity contracts", () => {
  it("accepts the approved leave state vocabulary", () => {
    expect(LeaveStateSchema.parse("ACTIVE")).toBe("ACTIVE");
  });

  it("rejects private medical narrative from a leave record", () => {
    expect(() =>
      LeaveRecordSchema.parse({
        schemaVersion: 1,
        id,
        employeeId: otherId,
        departmentId: id,
        state: "SUBMITTED",
        interval: { startsAt: "2026-08-10T08:00:00.000Z", endsAt: "2026-08-12T08:00:00.000Z" },
        reasonCategory: "PLANNED_LEAVE",
        affectedScopes: [{ kind: "PROJECT", id }],
        version: 1,
        createdAt: "2026-08-07T08:00:00.000Z",
        medicalDetails: "private",
      }),
    ).toThrow();
  });

  it("rejects organization-wide or empty acting-owner scope", () => {
    expect(() =>
      DelegationScopeSchema.parse({
        projectIds: [],
        workstreamIds: [],
        actions: ["project.update"],
        allOrganizationProjects: true,
      }),
    ).toThrow();
  });

  it("enforces a non-empty half-open UTC interval", () => {
    expect(() =>
      UtcIntervalSchema.parse({
        startsAt: "2026-08-10T08:00:00.000Z",
        endsAt: "2026-08-10T08:00:00.000Z",
      }),
    ).toThrow();
  });

  it("exposes operational leave state without a reason category", () => {
    expect(
      OperationalLeaveProjectionSchema.parse({
        employeeId: id,
        state: "ACTIVE",
        startsAt: "2026-08-10T08:00:00.000Z",
        endsAt: "2026-08-12T08:00:00.000Z",
        checkInRequired: false,
        negativeRegularitySignal: false,
      }),
    ).not.toHaveProperty("reasonCategory");
  });

  it("requires a manager actor for permanent reassignment resolution", () => {
    expect(() =>
      ReassignmentResolutionSchema.parse({
        schemaVersion: 1,
        id,
        caseId: otherId,
        actorId: id,
        actorRole: "SYSTEM_ADMINISTRATOR",
        resolution: "PERMANENT_REASSIGNMENT",
        successorId: otherId,
        effectiveAt: "2026-08-12T08:00:00.000Z",
        reason: "Department continuity",
        createdAt: "2026-08-07T08:00:00.000Z",
      }),
    ).toThrow();
  });
});
