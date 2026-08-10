/* eslint-disable no-unused-vars */
import { describe, expect, it } from "vitest";

import {
  ReturnService,
  type ReturnDelegation,
  type ReturnRecord,
  type ReturnStore,
  type ReturnTransaction,
} from "./return-service.js";

const delegation: ReturnDelegation = {
  id: "30000000-0000-4000-8000-000000000001",
  ownerId: "30000000-0000-4000-8000-000000000002",
  delegateId: "30000000-0000-4000-8000-000000000003",
  managerId: "30000000-0000-4000-8000-000000000004",
  departmentId: "30000000-0000-4000-8000-000000000005",
  state: "ACTIVE" as const,
};
const returnId = "30000000-0000-4000-8000-000000000006";
const correlationId = "30000000-0000-4000-8000-000000000007";

class MemoryReturnStore implements ReturnStore, ReturnTransaction {
  current = delegation;
  record: ReturnRecord | null = null;
  audits: Record<string, unknown>[] = [];
  extensions: Record<string, unknown>[] = [];
  async transaction<T>(operation: (tx: ReturnTransaction) => Promise<T>) {
    return operation(this);
  }
  async findDelegation() {
    return this.current;
  }
  async findReturn() {
    return this.record;
  }
  async expireDelegation() {
    this.current = { ...this.current, state: "RETURNED" as const };
  }
  async extendDelegation(_id: string, input: Record<string, unknown>) {
    this.extensions.push(input);
  }
  async appendReturn(input: Record<string, unknown>) {
    this.record = {
      id: input.id as string,
      delegationId: input.delegationId as string,
      actingOwnerId: input.actingOwnerId as string,
      originalOwnerId: input.originalOwnerId as string,
      state: "DRAFT",
      version: 1,
      choice: null,
    };
    return this.record;
  }
  async confirmReturn(_id: string, input: Record<string, unknown>) {
    if (!this.record || this.record.version !== input.expectedVersion) throw new Error("conflict");
    this.record = { ...this.record, state: "OWNER_CONFIRMED", version: 2 };
    return this.record;
  }
  async finalizeReturn(_id: string, input: Record<string, unknown>) {
    if (!this.record || this.record.version !== input.expectedVersion) throw new Error("conflict");
    this.record = {
      ...this.record,
      state: "FINALIZED",
      version: 3,
      choice: input.choice as ReturnRecord["choice"],
    };
    return this.record;
  }
  async appendAudit(input: Record<string, unknown>) {
    this.audits.push(input);
    return { id: crypto.randomUUID() };
  }
}

function decisions(
  store: MemoryReturnStore,
  permanentTransfer: (input: Record<string, unknown>) => void = () => undefined,
) {
  return {
    async finalize(input: Record<string, unknown>) {
      const record = store.record;
      if (!record || record.version !== input.expectedVersion) throw new Error("conflict");
      if (input.choice === "RETURN") await store.expireDelegation();
      if (input.choice === "EXTEND") await store.extendDelegation(delegation.id, input);
      if (input.choice === "PERMANENT_TRANSFER") permanentTransfer(input);
      return store.finalizeReturn(record.id, input);
    },
  };
}

describe("ReturnService", () => {
  it("binds acting draft, owner confirmation, and manager final choice to three principals", async () => {
    const store = new MemoryReturnStore();
    const service = new ReturnService(
      store,
      { canManageEmployee: async (actor) => actor === delegation.managerId },
      decisions(store),
    );
    const draft = await service.draft({
      id: returnId,
      delegationId: delegation.id,
      actorId: delegation.delegateId,
      completedWork: "Reviewed the active work",
      decisionsAndChanges: "Accepted one delivery decision",
      openWork: "One approval remains",
      risksAndNextSteps: "Owner should confirm the approval",
      correlationId,
    });
    await expect(
      service.confirm({
        returnId,
        delegationId: delegation.id,
        actorId: delegation.delegateId,
        expectedVersion: draft.version,
        correlationId,
      }),
    ).rejects.toMatchObject({ code: "RETURN_HANDOVER_INVALID" });
    const confirmed = await service.confirm({
      returnId,
      delegationId: delegation.id,
      actorId: delegation.ownerId,
      expectedVersion: draft.version,
      correlationId,
    });
    await expect(
      service.finalize({
        returnId,
        delegationId: delegation.id,
        managerId: delegation.delegateId,
        expectedVersion: confirmed.version,
        choice: "RETURN",
        occurredAt: "2026-08-12T08:00:00.000Z",
        reason: "Owner resumed responsibility",
        correlationId,
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_SCOPE" });
    const result = await service.finalize({
      returnId,
      delegationId: delegation.id,
      managerId: delegation.managerId,
      expectedVersion: confirmed.version,
      choice: "RETURN",
      occurredAt: "2026-08-12T08:00:00.000Z",
      reason: "Owner resumed responsibility",
      correlationId,
    });
    expect(result).toMatchObject({ state: "FINALIZED", choice: "RETURN" });
    expect(store.current.state).toBe("RETURNED");
  });

  it("allows the authorized manager to return authority without owner confirmation", async () => {
    const store = new MemoryReturnStore();
    const service = new ReturnService(
      store,
      { canManageEmployee: async (actor) => actor === delegation.managerId },
      decisions(store),
    );
    const draft = await service.draft(draftInput());
    await expect(
      service.finalize({
        returnId,
        delegationId: delegation.id,
        managerId: delegation.managerId,
        expectedVersion: draft.version,
        choice: "RETURN",
        occurredAt: "2026-08-11T08:00:00.000Z",
        reason: "Manager confirmed operational return",
        correlationId,
      }),
    ).resolves.toMatchObject({ state: "FINALIZED", choice: "RETURN" });
    expect(store.current.state).toBe("RETURNED");
  });

  it("executes extension and permanent-transfer choices instead of only storing them", async () => {
    const store = new MemoryReturnStore();
    const transfers: Record<string, unknown>[] = [];
    const service = new ReturnService(
      store,
      { canManageEmployee: async () => true },
      decisions(store, (input) => transfers.push(input)),
    );
    const draft = await service.draft(draftInput());
    await service.finalize({
      returnId,
      delegationId: delegation.id,
      managerId: delegation.managerId,
      expectedVersion: draft.version,
      choice: "EXTEND",
      occurredAt: "2026-08-11T08:00:00.000Z",
      extendedEndsAt: "2026-08-12T12:00:00.000Z",
      reason: "Coverage remains necessary",
      correlationId,
    });
    expect(store.extensions).toHaveLength(1);
    expect(store.current.state).toBe("ACTIVE");

    const secondStore = new MemoryReturnStore();
    const second = new ReturnService(
      secondStore,
      { canManageEmployee: async () => true },
      decisions(secondStore, (input) => transfers.push(input)),
    );
    const secondReturnId = crypto.randomUUID();
    const secondDraft = await second.draft({ ...draftInput(), id: secondReturnId });
    await second.finalize({
      returnId: secondReturnId,
      delegationId: delegation.id,
      managerId: delegation.managerId,
      expectedVersion: secondDraft.version,
      choice: "PERMANENT_TRANSFER",
      occurredAt: "2026-08-11T08:00:00.000Z",
      reason: "Approved permanent ownership",
      correlationId,
    });
    expect(transfers).toHaveLength(1);
  });
});

function draftInput() {
  return {
    id: returnId,
    delegationId: delegation.id,
    actorId: delegation.delegateId,
    completedWork: "Completed",
    decisionsAndChanges: "None",
    openWork: "One item",
    risksAndNextSteps: "Manager decision",
    correlationId,
  };
}
