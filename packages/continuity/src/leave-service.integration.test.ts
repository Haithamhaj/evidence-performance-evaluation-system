import { describe, expect, it } from "vitest";

import { LeaveService } from "./leave-service.js";
import { MemoryContinuityStore, allowAllScopeReader } from "./test-support.js";

const employeeId = "20000000-0000-4000-8000-000000000001";
const managerId = "20000000-0000-4000-8000-000000000002";
const otherManagerId = "20000000-0000-4000-8000-000000000003";
const departmentId = "20000000-0000-4000-8000-000000000004";
const projectId = "20000000-0000-4000-8000-000000000005";

describe("leave workflow", () => {
  it("excludes approved leave from check-ins and negative regularity", async () => {
    const store = new MemoryContinuityStore();
    const service = new LeaveService(store, allowAllScopeReader, {
      canManageEmployee: async (actor) => actor === managerId,
    });
    const leave = await service.submit(command());
    await service.decide({
      leaveId: leave.id,
      managerId,
      decision: "APPROVED",
      reason: "Approved planned leave",
      correlationId: crypto.randomUUID(),
    });
    const eligibility = await service.readEligibility(employeeId, "2026-08-13T12:00:00.000Z");
    expect(eligibility).toEqual({
      onApprovedLeave: true,
      checkInRequired: false,
      negativeRegularitySignal: false,
      evaluationObligationSuspended: true,
    });
  });

  it("rejects a manager outside the employee department", async () => {
    const store = new MemoryContinuityStore();
    const service = new LeaveService(store, allowAllScopeReader, {
      canManageEmployee: async (actor) => actor === managerId,
    });
    const leave = await service.submit(command());
    await expect(
      service.decide({
        leaveId: leave.id,
        managerId: otherManagerId,
        decision: "APPROVED",
        reason: "Attempt outside scope",
        correlationId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_SCOPE" });
  });

  it("rolls back the state when the audit append fails", async () => {
    const store = new MemoryContinuityStore();
    const service = new LeaveService(store, allowAllScopeReader, {
      canManageEmployee: async () => true,
    });
    const leave = await service.submit(command());
    store.failNextAudit = true;
    await expect(
      service.decide({
        leaveId: leave.id,
        managerId,
        decision: "APPROVED",
        reason: "Approved planned leave",
        correlationId: crypto.randomUUID(),
      }),
    ).rejects.toThrow("audit unavailable");
    expect((await store.findLeave(leave.id))?.state).toBe("SUBMITTED");
  });

  it("activates only inside the approved interval and allows an audited cancellation", async () => {
    const store = new MemoryContinuityStore();
    const service = new LeaveService(store, allowAllScopeReader, {
      canManageEmployee: async () => true,
    });
    const leave = await service.submit(command());
    await service.decide({
      leaveId: leave.id,
      managerId,
      decision: "APPROVED",
      reason: "Approved",
      correlationId: crypto.randomUUID(),
    });
    await expect(
      service.activate({
        leaveId: leave.id,
        managerId,
        occurredAt: "2026-08-09T08:00:00.000Z",
        correlationId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "LEAVE_INTERVAL_INACTIVE" });
    expect(
      (
        await service.activate({
          leaveId: leave.id,
          managerId,
          occurredAt: "2026-08-10T08:00:00.000Z",
          correlationId: crypto.randomUUID(),
        })
      ).state,
    ).toBe("ACTIVE");
    expect(
      (
        await service.cancel({
          leaveId: leave.id,
          actorId: managerId,
          reason: "Return arranged early",
          correlationId: crypto.randomUUID(),
        })
      ).state,
    ).toBe("CANCELLED");
  });
});

function command() {
  return {
    id: crypto.randomUUID(),
    employeeId,
    actorId: employeeId,
    departmentId,
    startsAt: "2026-08-10T08:00:00.000Z",
    endsAt: "2026-08-17T08:00:00.000Z",
    reasonCategory: "PLANNED_LEAVE",
    affectedScopes: [{ kind: "PROJECT", id: projectId }],
    correlationId: crypto.randomUUID(),
  } as const;
}
