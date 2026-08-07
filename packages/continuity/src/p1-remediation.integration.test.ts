import { describe, expect, it, vi } from "vitest";

import { DelegationService } from "./delegation-service.js";
import { HandoverService } from "./handover-service.js";
import { MemoryContinuityStore, allowAllScopeReader } from "./test-support.js";

const ids = {
  leave: "51000000-0000-4000-8000-000000000001",
  handover: "51000000-0000-4000-8000-000000000002",
  revision: "51000000-0000-4000-8000-000000000003",
  delegation: "51000000-0000-4000-8000-000000000004",
  owner: "51000000-0000-4000-8000-000000000005",
  otherOwner: "51000000-0000-4000-8000-000000000006",
  delegate: "51000000-0000-4000-8000-000000000007",
  manager: "51000000-0000-4000-8000-000000000008",
  department: "51000000-0000-4000-8000-000000000009",
  project: "51000000-0000-4000-8000-000000000010",
  gap: "51000000-0000-4000-8000-000000000011",
  correlation: "51000000-0000-4000-8000-000000000012",
} as const;

describe("E6A bounded P1 remediation", () => {
  it("binds handover revisions to the stored employee leave and scans string values", async () => {
    const store = new MemoryContinuityStore();
    store.leaves.set(ids.leave, {
      id: ids.leave,
      employeeId: ids.owner,
      departmentId: ids.department,
      state: "APPROVED",
      startsAt: "2026-08-10T08:00:00.000Z",
      endsAt: "2026-08-12T08:00:00.000Z",
      reasonCategory: "PLANNED_LEAVE",
      affectedScopes: [{ kind: "PROJECT", id: ids.project }],
      version: 2,
    });
    const service = new HandoverService(store, allowAllScopeReader);
    await expect(
      service.revise(handoverCommand(ids.otherOwner, "No secret here")),
    ).rejects.toMatchObject({ code: "HANDOVER_LEAVE_MISMATCH" });
    await expect(
      service.revise(handoverCommand(ids.owner, "Authorization: Bearer live-secret-value")),
    ).rejects.toMatchObject({ code: "HANDOVER_SENSITIVE_CONTENT" });
  });

  it("source-binds approval, resolves access gaps append-only, and activates real authority", async () => {
    const records = new Map<string, import("./delegation-service.js").DelegationRecord>();
    const confirmations = new Map<
      string,
      Readonly<{ delegateId: string; receiptConfirmed: true; accessConfirmed: true }>
    >();
    let gapOpen = true;
    const store: import("./delegation-service.js").DelegationStore = {
      transaction: async (operation) => operation(store),
      find: async (id) => records.get(id) ?? null,
      save: async (record) => (records.set(record.id, record), record),
      findReceipt: async (id) => confirmations.get(id) ?? null,
      confirmReceipt: async (id, input) => {
        confirmations.set(id, input as never);
      },
      isReceiptConfirmed: async (id) => confirmations.has(id),
      reportAccessGap: async () => undefined,
      hasOpenAccessGap: async () => gapOpen,
      resolveAccessGap: async () => {
        gapOpen = false;
      },
      appendAudit: async () => ({ id: crypto.randomUUID() }),
    };
    const source = {
      verifyApprovalSource: vi.fn(async () => ({ handoverRevisionId: ids.revision })),
    };
    const authority = {
      activate: vi.fn(async (record: import("./delegation-service.js").DelegationRecord) => ({
        ...record,
        state: "ACTIVE" as const,
        version: record.version + 1,
      })),
      expire: vi.fn(async (record: import("./delegation-service.js").DelegationRecord) => ({
        ...record,
        state: "EXPIRED" as const,
        version: record.version + 1,
      })),
    };
    const service = new DelegationService(
      store,
      { canManageEmployee: async (actor) => actor === ids.manager },
      source,
      authority,
    );
    await service.approve(approval());
    expect(source.verifyApprovalSource).toHaveBeenCalled();
    await service.confirm(confirmation());
    await expect(service.confirm(confirmation())).resolves.toMatchObject({ id: ids.delegation });
    await expect(
      service.activate({
        delegationId: ids.delegation,
        actorId: ids.manager,
        correlationId: ids.correlation,
      }),
    ).rejects.toMatchObject({ code: "DELEGATION_ACCESS_GAP_OPEN" });
    await service.resolveGap({
      delegationId: ids.delegation,
      gapId: ids.gap,
      managerId: ids.manager,
      resolution: "RESOLVED",
      reason: "Repository access granted",
      correlationId: ids.correlation,
    });
    await expect(
      service.activate({
        delegationId: ids.delegation,
        actorId: ids.manager,
        correlationId: ids.correlation,
      }),
    ).resolves.toMatchObject({ state: "ACTIVE" });
    expect(authority.activate).toHaveBeenCalledOnce();
  });
});

function handoverCommand(employeeId: string, currentState: string) {
  return {
    handoverId: ids.handover,
    leaveId: ids.leave,
    employeeId,
    actorId: employeeId,
    expectedRevision: 0,
    correlationId: ids.correlation,
    items: [
      {
        scope: { kind: "PROJECT" as const, id: ids.project },
        currentState,
        completedWork: "Foundation complete",
        openWork: "Acceptance remains",
        blockersAndRisks: "None",
        immediateNextStep: "Confirm handover",
        keyLinks: ["https://example.invalid/project"],
        requiredAccess: ["Repository read"],
        pendingDecisions: ["Release"],
        proposedDelegateId: ids.delegate,
      },
    ],
  };
}

function approval() {
  return {
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
    actions: ["project.update" as const],
    emergency: false,
    emergencyReason: null,
    correlationId: ids.correlation,
  };
}

function confirmation() {
  return {
    delegationId: ids.delegation,
    delegateId: ids.delegate,
    receiptConfirmed: true,
    accessConfirmed: true,
    correlationId: ids.correlation,
  };
}
