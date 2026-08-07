/* eslint-disable no-unused-vars */
import { describe, expect, it, vi } from "vitest";

import {
  OffboardingService,
  type OffboardingCase,
  type OffboardingStore,
  type OffboardingTransaction,
} from "./offboarding-service.js";

const userId = "40000000-0000-4000-8000-000000000001";
const adminId = "40000000-0000-4000-8000-000000000002";
const managerId = "40000000-0000-4000-8000-000000000003";
const successorId = "40000000-0000-4000-8000-000000000004";
const projectId = "40000000-0000-4000-8000-000000000005";
const correlationId = "40000000-0000-4000-8000-000000000006";

class MemoryOffboardingStore implements OffboardingStore, OffboardingTransaction {
  cases: OffboardingCase[] = [];
  audits: Record<string, unknown>[] = [];
  intents: Record<string, unknown>[] = [];
  async transaction<T>(operation: (tx: OffboardingTransaction) => Promise<T>) {
    return operation(this);
  }
  async createCaseIfMissing(input: Omit<OffboardingCase, "id" | "state">) {
    const existing = this.cases.find(
      (item) =>
        item.formerOwnerId === input.formerOwnerId &&
        item.scope.id === input.scope.id &&
        item.state === "REASSIGNMENT_REQUIRED",
    );
    if (existing) return existing;
    const created = { ...input, id: crypto.randomUUID(), state: "REASSIGNMENT_REQUIRED" as const };
    this.cases.push(created);
    return created;
  }
  async findCase(id: string) {
    return this.cases.find((item) => item.id === id) ?? null;
  }
  async markResolved(id: string) {
    const index = this.cases.findIndex((item) => item.id === id);
    const current = this.cases[index];
    if (!current) throw new Error("missing");
    const resolved = { ...current, state: "RESOLVED" as const };
    this.cases[index] = resolved;
    return resolved;
  }
  async appendAudit(input: Record<string, unknown>) {
    this.audits.push(input);
    return { id: crypto.randomUUID() };
  }
  async appendNotificationIntent(input: Record<string, unknown>) {
    this.intents.push(input);
  }
}

function fixture() {
  const store = new MemoryOffboardingStore();
  const ownership = {
    listActiveOwnedScopes: async () => [{ kind: "PROJECT" as const, id: projectId, version: 3 }],
    resolveReassignment: async (input: { caseId: string }) => store.markResolved(input.caseId),
  };
  const auth = { deactivate: async () => ({ userId, deactivatedAt: "2026-08-12T08:00:00.000Z" }) };
  const authorization = {
    canResolveReassignment: async (actorId: string) => actorId === managerId,
  };
  return {
    store,
    ownership,
    auth,
    authorization,
    service: new OffboardingService(store, auth, ownership, authorization),
  };
}

describe("OffboardingService", () => {
  it("deactivates immediately, creates one deduplicated case, and never chooses a successor", async () => {
    const { service, store } = fixture();
    const input = {
      administratorId: adminId,
      userId,
      occurredAt: "2026-08-12T08:00:00.000Z",
      correlationId,
    };
    const first = await service.deactivate(input);
    const second = await service.deactivate(input);

    expect(first.preservedHistory).toBe(true);
    expect(first.reassignmentCaseIds).toHaveLength(1);
    expect(second.reassignmentCaseIds).toEqual(first.reassignmentCaseIds);
    expect(store.cases).toHaveLength(1);
    expect(store.cases[0]).not.toHaveProperty("successorId");
  });

  it("allows only a manager to resolve permanent reassignment through the Projects command", async () => {
    const { service, ownership } = fixture();
    const receipt = await service.deactivate({
      administratorId: adminId,
      userId,
      occurredAt: "2026-08-12T08:00:00.000Z",
      correlationId,
    });
    const caseId = receipt.reassignmentCaseIds[0]!;
    await expect(
      service.resolve({
        caseId,
        actorId: adminId,
        successorId,
        effectiveAt: "2026-08-12T09:00:00.000Z",
        reason: "Team continuity",
        correlationId,
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_SCOPE" });
    const spy = vi.spyOn(ownership, "resolveReassignment");
    await expect(
      service.resolve({
        caseId,
        actorId: managerId,
        successorId,
        effectiveAt: "2026-08-12T09:00:00.000Z",
        reason: "Team continuity",
        correlationId,
      }),
    ).resolves.toMatchObject({ state: "RESOLVED" });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ transferKind: "permanent", successorId }),
    );
  });
});
