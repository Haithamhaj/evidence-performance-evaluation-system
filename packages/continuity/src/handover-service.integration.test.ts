import { describe, expect, it } from "vitest";

import { HandoverService } from "./handover-service.js";
import { MemoryContinuityStore, allowAllScopeReader } from "./test-support.js";

const employeeId = "21000000-0000-4000-8000-000000000001";
const projectId = "21000000-0000-4000-8000-000000000002";

describe("versioned handover", () => {
  it("appends revisions and rejects a stale expected revision", async () => {
    const store = seededStore();
    const service = new HandoverService(store, allowAllScopeReader);
    const first = await service.revise(command(0, "Current status"));
    const second = await service.revise(command(1, "Updated status"));
    expect([first.revision, second.revision]).toEqual([1, 2]);
    await expect(service.revise(command(1, "Stale status"))).rejects.toMatchObject({
      code: "VERSION_CONFLICT",
    });
    expect(store.handoverRevisions).toHaveLength(2);
  });

  it("rejects secret or token fields anywhere in handover input", async () => {
    const service = new HandoverService(seededStore(), allowAllScopeReader);
    await expect(
      service.revise({ ...command(0, "Current status"), apiToken: "must-not-store" }),
    ).rejects.toMatchObject({ code: "HANDOVER_SENSITIVE_CONTENT" });
  });

  it("records employee confirmation without treating it as manager technical approval", async () => {
    const store = seededStore();
    const service = new HandoverService(store, allowAllScopeReader);
    await service.revise(command(0, "Current status"));
    const result = await service.confirm({
      handoverId: "21000000-0000-4000-8000-000000000003",
      employeeId,
      actorId: employeeId,
      expectedRevision: 1,
      correlationId: crypto.randomUUID(),
    });
    expect(result).toEqual({
      handoverId: "21000000-0000-4000-8000-000000000003",
      confirmedRevision: 1,
    });
    expect(store.handoverConfirmations).toHaveLength(1);
  });
});

function seededStore() {
  const store = new MemoryContinuityStore();
  store.leaves.set("21000000-0000-4000-8000-000000000004", {
    id: "21000000-0000-4000-8000-000000000004",
    employeeId,
    departmentId: "21000000-0000-4000-8000-000000000005",
    state: "APPROVED",
    startsAt: "2026-08-10T08:00:00.000Z",
    endsAt: "2026-08-12T08:00:00.000Z",
    reasonCategory: "PLANNED_LEAVE",
    affectedScopes: [{ kind: "PROJECT", id: projectId }],
    version: 2,
  });
  return store;
}

function command(expectedRevision: number, currentState: string) {
  return {
    handoverId: "21000000-0000-4000-8000-000000000003",
    leaveId: "21000000-0000-4000-8000-000000000004",
    employeeId,
    actorId: employeeId,
    expectedRevision,
    correlationId: crypto.randomUUID(),
    items: [
      {
        scope: { kind: "PROJECT", id: projectId },
        currentState,
        completedWork: "Completed foundation",
        openWork: "Finish continuity flow",
        blockersAndRisks: "No blocker",
        immediateNextStep: "Run acceptance",
        keyLinks: ["https://example.invalid/project"],
        requiredAccess: ["Repository read"],
        pendingDecisions: ["Confirm deployment window"],
        proposedDelegateId: null,
      },
    ],
  } as const;
}
