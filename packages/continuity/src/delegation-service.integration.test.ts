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
  async findReceipt(id: string) {
    return this.confirmations.has(id)
      ? {
          delegateId: ids.delegate,
          receiptConfirmed: true as const,
          accessConfirmed: true as const,
        }
      : null;
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
  async resolveAccessGap() {
    this.gaps.splice(0);
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

function service(
  store: MemoryDelegationStore,
  canManageEmployee: (
    managerId: string,
    employeeId: string,
    departmentId: string,
  ) => Promise<boolean> = async () => true,
) {
  return new DelegationService(
    store,
    { canManageEmployee },
    { verifyApprovalSource: async () => ({ handoverRevisionId: crypto.randomUUID() }) },
    {
      activate: async (record) => {
        if (record.emergency) {
          await store.appendAudit({
            eventType: "continuity.delegation.emergency_activated",
            actorId: record.managerId,
            targetId: record.id,
          });
        }
        const active = { ...record, state: "ACTIVE" as const, version: record.version + 1 };
        return store.save(active);
      },
      expire: async (record) =>
        store.save({ ...record, state: "EXPIRED" as const, version: record.version + 1 }),
    },
  );
}

describe("DelegationService", () => {
  it("requires manager approval, delegate receipt/access confirmation, and no open gap", async () => {
    const store = new MemoryDelegationStore();
    const subject = service(store, async (managerId) => managerId === ids.manager);

    await expect(
      subject.approve({ ...normalApproval, managerId: ids.owner }),
    ).rejects.toMatchObject({
      code: "AUTHZ_SCOPE",
    });
    expect((await subject.approve(normalApproval)).state).toBe("PENDING_DELEGATE");
    await expect(
      subject.activate({
        delegationId: ids.delegation,
        actorId: ids.manager,
        correlationId: ids.correlation,
      }),
    ).rejects.toMatchObject({ code: "DELEGATE_CONFIRMATION_REQUIRED" });

    await subject.confirm({
      delegationId: ids.delegation,
      delegateId: ids.delegate,
      receiptConfirmed: true,
      accessConfirmed: true,
      correlationId: ids.correlation,
    });
    expect(
      (
        await subject.activate({
          delegationId: ids.delegation,
          actorId: ids.manager,
          correlationId: ids.correlation,
        })
      ).state,
    ).toBe("ACTIVE");
  });

  it("does not widen permissions when an access gap is reported", async () => {
    const store = new MemoryDelegationStore();
    const subject = service(store);
    await subject.approve(normalApproval);
    await subject.confirm({
      delegationId: ids.delegation,
      delegateId: ids.delegate,
      receiptConfirmed: true,
      accessConfirmed: true,
      correlationId: ids.correlation,
    });
    await subject.reportGap({
      delegationId: ids.delegation,
      delegateId: ids.delegate,
      description: "Repository access is missing",
      correlationId: ids.correlation,
    });
    await expect(
      subject.activate({
        delegationId: ids.delegation,
        actorId: ids.manager,
        correlationId: ids.correlation,
      }),
    ).rejects.toMatchObject({ code: "DELEGATION_ACCESS_GAP_OPEN" });
  });

  it("requires a reason and audit for emergency activation", async () => {
    const store = new MemoryDelegationStore();
    const subject = service(store);
    await expect(
      subject.approve({ ...normalApproval, emergency: true, emergencyReason: "" }),
    ).rejects.toThrow();
    const active = await subject.approve({
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
