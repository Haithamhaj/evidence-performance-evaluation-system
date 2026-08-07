/* eslint-disable no-unused-vars */
import { describe, expect, it } from "vitest";

import {
  DelegationService,
  type DelegationRecord,
  type DelegationStore,
  type DelegationTransaction,
} from "./delegation-service.js";

const ids = {
  delegation: "10000000-0000-4000-8000-000000000001",
  leave: "10000000-0000-4000-8000-000000000002",
  owner: "10000000-0000-4000-8000-000000000003",
  delegate: "10000000-0000-4000-8000-000000000004",
  manager: "10000000-0000-4000-8000-000000000005",
  department: "10000000-0000-4000-8000-000000000006",
  project: "10000000-0000-4000-8000-000000000007",
  correlation: "10000000-0000-4000-8000-000000000008",
};

class MemoryDelegationStore implements DelegationStore, DelegationTransaction {
  records = new Map<string, DelegationRecord>();
  confirmations = new Set<string>();
  gaps: string[] = [];
  audits: Record<string, unknown>[] = [];

  async transaction<T>(operation: (tx: DelegationTransaction) => Promise<T>) {
    return operation(this);
  }
  async find(id: string) {
    return this.records.get(id) ?? null;
  }
  async save(record: DelegationRecord) {
    this.records.set(record.id, record);
    return record;
  }
  async confirmReceipt(id: string) {
    this.confirmations.add(id);
  }
  async isReceiptConfirmed(id: string) {
    return this.confirmations.has(id);
  }
  async reportAccessGap(id: string) {
    this.gaps.push(id);
  }
  async hasOpenAccessGap(id: string) {
    return this.gaps.includes(id);
  }
  async appendAudit(event: Record<string, unknown>) {
    this.audits.push(event);
    return { id: crypto.randomUUID() };
  }
}

const normalApproval = {
  id: ids.delegation,
  leaveId: ids.leave,
  ownerId: ids.owner,
  delegateId: ids.delegate,
  managerId: ids.manager,
  departmentId: ids.department,
  startsAt: "2026-08-10T08:00:00.000Z",
  endsAt: "2026-08-12T08:00:00.000Z",
  projectIds: [ids.project],
  workstreamIds: [],
  actions: ["project.update"] as const,
  emergency: false,
  emergencyReason: null,
  correlationId: ids.correlation,
};

describe("DelegationService", () => {
  it("requires manager approval, delegate receipt/access confirmation, and no open gap", async () => {
    const store = new MemoryDelegationStore();
    const service = new DelegationService(store, {
      canManageEmployee: async (managerId) => managerId === ids.manager,
    });

    await expect(
      service.approve({ ...normalApproval, managerId: ids.owner }),
    ).rejects.toMatchObject({
      code: "AUTHZ_SCOPE",
    });
    expect((await service.approve(normalApproval)).state).toBe("PENDING_DELEGATE");
    await expect(
      service.activate({
        delegationId: ids.delegation,
        actorId: ids.manager,
        correlationId: ids.correlation,
      }),
    ).rejects.toMatchObject({ code: "DELEGATE_CONFIRMATION_REQUIRED" });

    await service.confirm({
      delegationId: ids.delegation,
      delegateId: ids.delegate,
      receiptConfirmed: true,
      accessConfirmed: true,
      correlationId: ids.correlation,
    });
    expect(
      (
        await service.activate({
          delegationId: ids.delegation,
          actorId: ids.manager,
          correlationId: ids.correlation,
        })
      ).state,
    ).toBe("ACTIVE");
  });

  it("does not widen permissions when an access gap is reported", async () => {
    const store = new MemoryDelegationStore();
    const service = new DelegationService(store, { canManageEmployee: async () => true });
    await service.approve(normalApproval);
    await service.confirm({
      delegationId: ids.delegation,
      delegateId: ids.delegate,
      receiptConfirmed: true,
      accessConfirmed: true,
      correlationId: ids.correlation,
    });
    await service.reportGap({
      delegationId: ids.delegation,
      delegateId: ids.delegate,
      description: "Repository access is missing",
      correlationId: ids.correlation,
    });
    await expect(
      service.activate({
        delegationId: ids.delegation,
        actorId: ids.manager,
        correlationId: ids.correlation,
      }),
    ).rejects.toMatchObject({ code: "DELEGATION_ACCESS_GAP_OPEN" });
  });

  it("requires a reason and audit for emergency activation", async () => {
    const store = new MemoryDelegationStore();
    const service = new DelegationService(store, { canManageEmployee: async () => true });
    await expect(
      service.approve({ ...normalApproval, emergency: true, emergencyReason: "" }),
    ).rejects.toThrow();
    const active = await service.approve({
      ...normalApproval,
      emergency: true,
      emergencyReason: "Owner became unexpectedly unavailable",
    });
    expect(active.state).toBe("ACTIVE");
    expect(store.audits).toContainEqual(
      expect.objectContaining({ eventType: "continuity.delegation.emergency_activated" }),
    );
  });
});
