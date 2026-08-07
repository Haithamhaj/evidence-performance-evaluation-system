/* eslint-disable no-unused-vars */
import { describe, expect, it } from "vitest";

import {
  ReturnService,
  type ReturnDelegation,
  type ReturnStore,
  type ReturnTransaction,
} from "./return-service.js";

const delegation: ReturnDelegation = {
  id: "30000000-0000-4000-8000-000000000001",
  ownerId: "30000000-0000-4000-8000-000000000002",
  delegateId: "30000000-0000-4000-8000-000000000003",
  state: "ACTIVE" as const,
};
const correlationId = "30000000-0000-4000-8000-000000000004";

class MemoryReturnStore implements ReturnStore, ReturnTransaction {
  current = delegation;
  records: Record<string, unknown>[] = [];
  audits: Record<string, unknown>[] = [];
  async transaction<T>(operation: (tx: ReturnTransaction) => Promise<T>) {
    return operation(this);
  }
  async findDelegation() {
    return this.current;
  }
  async expireDelegation() {
    this.current = { ...this.current, state: "RETURNED" as const };
  }
  async appendReturn(input: Record<string, unknown>) {
    this.records.push(input);
    return input;
  }
  async appendAudit(input: Record<string, unknown>) {
    this.audits.push(input);
    return { id: crypto.randomUUID() };
  }
}

describe("ReturnService", () => {
  it("expires acting authority immediately and preserves a return handover", async () => {
    const store = new MemoryReturnStore();
    const result = await new ReturnService(store).complete({
      delegationId: delegation.id,
      actingOwnerId: delegation.delegateId,
      originalOwnerId: delegation.ownerId,
      completedWork: "Reviewed the active work",
      decisionsAndChanges: "Accepted one delivery decision",
      openWork: "One approval remains",
      risksAndNextSteps: "Owner should confirm the approval",
      choice: "RETURN",
      confirmedById: delegation.ownerId,
      occurredAt: "2026-08-12T08:00:00.000Z",
      correlationId,
    });

    expect(result).toMatchObject({ delegationId: delegation.id, choice: "RETURN" });
    expect(store.current.state).toBe("RETURNED");
    expect(store.records).toHaveLength(1);
  });
});
