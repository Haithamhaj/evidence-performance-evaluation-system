import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { databaseAuditWriter } from "../../packages/audit/src/index.js";
import { createDatabaseClient } from "../../packages/database/src/index.js";

import { administrativelyReplayOperation } from "../../apps/worker/src/queue/job-runner.js";

const operationId = "4fd02cc1-2a49-4af6-a4a3-240e906495c5";

function fixture(reason: string | undefined) {
  const state = { operationStatus: "failed", auditEvents: [] as unknown[] };
  const transaction = {
    auditEvent: {
      create: vi.fn(async ({ data }: { data: unknown }) => {
        state.auditEvents.push(data);
        return { id: crypto.randomUUID(), createdAt: new Date() };
      }),
    },
    operation: {
      findUnique: vi.fn(async () => ({ id: operationId, status: state.operationStatus })),
      update: vi.fn(async ({ data }: { data: { status: string } }) => {
        state.operationStatus = data.status;
        return { id: operationId, status: state.operationStatus };
      }),
    },
  };
  const database = {
    $transaction: vi.fn(async (callback: (value: typeof transaction) => Promise<unknown>) => {
      const previous = state.operationStatus;
      const auditCount = state.auditEvents.length;
      try {
        return await callback(transaction);
      } catch (error) {
        state.operationStatus = previous;
        state.auditEvents.splice(auditCount);
        throw error;
      }
    }),
  };
  return {
    database,
    reason,
    replay: vi.fn(async () => undefined),
    state,
    transaction,
  };
}

const request = {
  operationId,
  actor: { kind: "human" as const, id: "23d0a485-c533-44a3-a24c-85d1a46d5072" },
  effectiveSubjectId: "23d0a485-c533-44a3-a24c-85d1a46d5072",
  scopeType: "organization" as const,
  scopeId: "cfc37f55-68f1-4c7c-b787-b76c44f02e67",
  correlationId: "9a11bb8f-79f5-4a72-a98f-2e763e97699b",
};

describe("administrative replay", () => {
  beforeEach(() => vi.restoreAllMocks());

  it.each([undefined, "  ", "ab", "x".repeat(501)])(
    "rejects a missing or invalid reason before audit or replay",
    async (reason) => {
      const context = fixture(reason);
      await expect(
        administrativelyReplayOperation(
          context.database,
          { ...request, reason },
          { append: vi.fn() },
          context.replay,
        ),
      ).rejects.toThrow();
      expect(context.database.$transaction).not.toHaveBeenCalled();
      expect(context.replay).not.toHaveBeenCalled();
      expect(context.state).toMatchObject({ auditEvents: [], operationStatus: "failed" });
    },
  );

  it("leaves the operation unchanged and never invokes when audit fails", async () => {
    const context = fixture("  Retry after dependency recovery  ");
    const writer = { append: vi.fn().mockRejectedValue(new Error("audit unavailable")) };
    await expect(
      administrativelyReplayOperation(
        context.database,
        { ...request, reason: context.reason },
        writer,
        context.replay,
      ),
    ).rejects.toThrow("audit unavailable");
    expect(context.state.operationStatus).toBe("failed");
    expect(context.replay).not.toHaveBeenCalled();
    expect(context.transaction.operation.update).not.toHaveBeenCalled();
  });

  it("commits the exact audit before enabling exactly one replay", async () => {
    const context = fixture("  Retry after dependency recovery  ");
    const order: string[] = [];
    const writer = {
      append: vi.fn(async (_transaction: unknown, input: { eventType: string; reason: string }) => {
        order.push(`audit:${input.eventType}:${input.reason}`);
        return { id: crypto.randomUUID(), createdAt: new Date().toISOString() };
      }),
    };
    context.transaction.operation.update.mockImplementation(async ({ data }) => {
      order.push(`state:${data.status}`);
      context.state.operationStatus = data.status;
      return { id: operationId, status: data.status };
    });
    context.replay.mockImplementation(async () => {
      order.push("replay");
    });

    await administrativelyReplayOperation(
      context.database,
      { ...request, reason: context.reason },
      writer,
      context.replay,
    );

    expect(order).toEqual([
      "audit:administrative_replay.requested:Retry after dependency recovery",
      "state:pending",
      "replay",
    ]);
    expect(context.replay).toHaveBeenCalledTimes(1);
  });
});

const realDatabase = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const realOrganizationId = crypto.randomUUID();

beforeAll(async () => {
  await realDatabase.organization.create({
    data: {
      id: realOrganizationId,
      key: `administrative-replay-${realOrganizationId}`,
      name: "Administrative Replay Test",
    },
  });
});

afterAll(async () => {
  await realDatabase.operation.deleteMany({ where: { organizationId: realOrganizationId } });
  await realDatabase.organization.delete({ where: { id: realOrganizationId } });
  await realDatabase.$disconnect();
});

async function failedOperation() {
  const id = crypto.randomUUID();
  const timestamp = new Date();
  await realDatabase.operation.create({
    data: {
      id,
      organizationId: realOrganizationId,
      jobType: "system.test",
      jobVersion: 1,
      idempotencyKey: `system.test:${id}`,
      correlationId: crypto.randomUUID(),
      payloadHash: "0".repeat(64),
      status: "failed",
      attemptCount: 1,
      errorCode: "UPSTREAM_TEMPORARY",
      startedAt: timestamp,
      completedAt: timestamp,
    },
  });
  return id;
}

describe("administrative replay database atomicity", () => {
  it("rolls back the durable state when the audit writer fails", async () => {
    const id = await failedOperation();
    const replay = vi.fn();
    await expect(
      administrativelyReplayOperation(
        realDatabase,
        { ...request, operationId: id, scopeId: realOrganizationId, reason: "Retry after outage" },
        { append: vi.fn().mockRejectedValue(new Error("audit unavailable")) },
        replay,
      ),
    ).rejects.toThrow("audit unavailable");
    await expect(realDatabase.operation.findUnique({ where: { id } })).resolves.toMatchObject({
      errorCode: "UPSTREAM_TEMPORARY",
      status: "failed",
    });
    expect(replay).not.toHaveBeenCalled();
  });

  it("commits the exact audit and pending state before one replay invocation", async () => {
    const id = await failedOperation();
    const replay = vi.fn().mockResolvedValue(undefined);
    await administrativelyReplayOperation(
      realDatabase,
      {
        ...request,
        operationId: id,
        scopeId: realOrganizationId,
        reason: "  Retry after outage  ",
      },
      databaseAuditWriter,
      replay,
    );

    await expect(realDatabase.operation.findUnique({ where: { id } })).resolves.toMatchObject({
      errorCode: null,
      status: "pending",
    });
    await expect(realDatabase.auditEvent.findMany({ where: { targetId: id } })).resolves.toEqual([
      expect.objectContaining({
        eventType: "administrative_replay.requested",
        reason: "Retry after outage",
        source: "admin_replay",
      }),
    ]);
    expect(replay).toHaveBeenCalledOnce();
    expect(replay).toHaveBeenCalledWith(id);
  });
});
