import { describe, expect, it, vi } from "vitest";

import { DelegationController } from "../../apps/api/src/continuity/delegation.controller.js";
import { LeaveController } from "../../apps/api/src/continuity/leave.controller.js";
import { ReassignmentController } from "../../apps/api/src/continuity/reassignment.controller.js";

const request = (userId: string) => ({
  principal: {
    userId,
    active: true,
    oidcSubject: userId,
    email: `${userId}@test.invalid`,
    roles: [],
  },
  headers: {},
  params: {},
  correlationId: "50000000-0000-4000-8000-000000000001",
});

describe("continuity API protected composition", () => {
  it("derives leave and delegate actors from the authenticated principal", async () => {
    const leave = {
      submit: vi.fn(async (input) => input),
      decide: vi.fn(),
      activate: vi.fn(),
      cancel: vi.fn(),
    };
    const delegation = {
      approve: vi.fn(),
      confirm: vi.fn(async (input) => input),
      reportGap: vi.fn(),
      activate: vi.fn(),
      expire: vi.fn(),
    };
    const returns = { draft: vi.fn(), confirm: vi.fn(), finalize: vi.fn() };
    const leaveController = new LeaveController(leave as never);
    const delegationController = new DelegationController(delegation as never, returns as never);

    await leaveController.submit(request("employee-1") as never, { employeeId: "attacker" });
    await delegationController.confirm(request("delegate-1") as never, { delegateId: "attacker" });

    expect(leave.submit).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "employee-1", employeeId: "employee-1" }),
    );
    expect(delegation.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ delegateId: "delegate-1" }),
    );
  });

  it("binds each return step to the authenticated principal and strips protected identities", async () => {
    const delegation = {
      approve: vi.fn(),
      confirm: vi.fn(),
      reportGap: vi.fn(),
      resolveGap: vi.fn(),
      activate: vi.fn(),
      expire: vi.fn(),
    };
    const returns = {
      draft: vi.fn(async (input) => input),
      confirm: vi.fn(async (input) => input),
      finalize: vi.fn(async (input) => input),
    };
    const controller = new DelegationController(delegation as never, returns as never);

    await controller.draftReturn(request("delegate-1") as never, "delegation-1", {
      id: "return-1",
      completedWork: "done",
      decisionsAndChanges: "none",
      openWork: "next",
      risksAndNextSteps: "safe",
      actorId: "attacker",
      finalizedById: "attacker",
    });
    await controller.confirmReturn(request("owner-1") as never, "delegation-1", {
      returnId: "return-1",
      expectedVersion: 1,
      actorId: "attacker",
      confirmedById: "attacker",
    });
    await controller.finalizeReturn(request("manager-1") as never, "delegation-1", {
      returnId: "return-1",
      expectedVersion: 2,
      choice: "RETURN",
      occurredAt: "2026-08-11T08:00:00.000Z",
      managerId: "attacker",
      finalizedById: "attacker",
    });

    expect(returns.draft).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "delegate-1", delegationId: "delegation-1" }),
    );
    expect(returns.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "owner-1", delegationId: "delegation-1" }),
    );
    expect(returns.finalize).toHaveBeenCalledWith(
      expect.objectContaining({ managerId: "manager-1", delegationId: "delegation-1" }),
    );
    for (const call of [returns.draft, returns.confirm, returns.finalize]) {
      expect(call.mock.calls[0]?.[0]).not.toHaveProperty("confirmedById");
      expect(call.mock.calls[0]?.[0]).not.toHaveProperty("finalizedById");
    }
  });

  it("does not let the controller turn an administrator into the reassignment decision maker", async () => {
    const offboarding = {
      deactivate: vi.fn(),
      resolve: vi
        .fn()
        .mockRejectedValue(Object.assign(new Error("denied"), { code: "AUTHZ_SCOPE" })),
    };
    const controller = new ReassignmentController(offboarding as never);
    await expect(
      controller.resolve(request("system-admin") as never, "case-1", { successorId: "user-2" }),
    ).rejects.toMatchObject({ code: "AUTHZ_SCOPE" });
    expect(offboarding.resolve).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "system-admin" }),
    );
  });
});
