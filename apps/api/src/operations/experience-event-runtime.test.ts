import { describe, expect, it, vi } from "vitest";

import { ExperienceEventRuntime } from "./experience-event-runtime.js";

const recipientId = "30000000-0000-4000-8000-000000000001";
const unrelatedId = "30000000-0000-4000-8000-000000000002";
const signal = {
  schemaVersion: 1,
  signalId: "30000000-0000-4000-8000-000000000003",
  type: "user.capture_submitted",
  sourceClass: "user_domain_action",
  originatingDomain: "work_items",
  entityRefs: [
    {
      entityType: "private_inbox_item",
      entityId: "30000000-0000-4000-8000-000000000004",
      version: 1,
    },
  ],
  actor: { kind: "human", id: recipientId },
  occurredAt: "2026-08-12T09:00:00.000Z",
  receivedAt: "2026-08-12T09:00:01.000Z",
  idempotencyKey: "capture:30000000-0000-4000-8000-000000000004:v1",
  visibility: { kind: "owner", recipientId },
  correlationId: "30000000-0000-4000-8000-000000000005",
  freshness: {
    state: "fresh",
    evaluatedAt: "2026-08-12T09:00:01.000Z",
    sourceUpdatedAt: "2026-08-12T09:00:00.000Z",
    safeReasonCode: "source_current",
    recoveryMode: "none",
    expectedVersion: 1,
  },
} as const;

function harness(authorized = true) {
  const rows: Record<string, unknown>[] = [];
  const workflowRows: Record<string, unknown>[] = [];
  const database = {
    workSignalReceipt: {
      findUnique: vi.fn(async ({ where }) =>
        rows.find(
          (row) =>
            (where.idempotencyKey !== undefined && row.idempotencyKey === where.idempotencyKey) ||
            (where.id !== undefined && row.id === where.id),
        ),
      ),
      create: vi.fn(async ({ data }) => {
        const row = {
          ...data,
          id: signal.signalId,
          deliveryCursor: BigInt(rows.length + 1),
          deliveryState: "queued",
          deliveryAttemptCount: 0,
          replayCount: 0,
          deliveredAt: null,
          acknowledgedAt: null,
          createdAt: new Date(signal.receivedAt),
          updatedAt: new Date(signal.receivedAt),
        };
        rows.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where }) =>
        rows.filter(
          (row) =>
            row.recipientId === where.recipientId &&
            (where.deliveryState?.in === undefined ||
              where.deliveryState.in.includes(row.deliveryState)) &&
            (where.deliveryCursor?.gt === undefined ||
              (row.deliveryCursor as bigint) > where.deliveryCursor.gt),
        ),
      ),
      updateMany: vi.fn(async ({ where, data }) => {
        const row = rows.find(
          (candidate) =>
            candidate.id === where.id &&
            (where.recipientId === undefined || candidate.recipientId === where.recipientId) &&
            (where.deliveryState === undefined || candidate.deliveryState === where.deliveryState),
        );
        if (!row) return { count: 0 };
        Object.assign(row, {
          ...data,
          deliveryAttemptCount:
            typeof data.deliveryAttemptCount === "object"
              ? (row.deliveryAttemptCount as number) + data.deliveryAttemptCount.increment
              : (data.deliveryAttemptCount ?? row.deliveryAttemptCount),
          replayCount:
            typeof data.replayCount === "object"
              ? (row.replayCount as number) + data.replayCount.increment
              : (data.replayCount ?? row.replayCount),
        });
        return { count: 1 };
      }),
    },
    experienceWorkflowEventReceipt: {
      findUnique: vi.fn(async ({ where }) =>
        workflowRows.find((row) => row.idempotencyKey === where.idempotencyKey),
      ),
      create: vi.fn(async ({ data }) => {
        const row = { ...data, createdAt: new Date("2026-08-12T09:10:00.000Z") };
        workflowRows.push(row);
        return row;
      }),
    },
    $transaction: async (operation: (transaction: unknown) => unknown) => operation(database),
  };
  const enqueue = vi.fn(async () => undefined);
  const runtime = new ExperienceEventRuntime(
    database as never,
    { authorize: vi.fn(async () => authorized) },
    { enqueue },
  );
  return { runtime, rows, workflowRows, database, enqueue };
}

describe("ExperienceEventRuntime", () => {
  it("persists one receipt and safely wakes the same queued job across idempotent replay", async () => {
    const { runtime, rows, enqueue } = harness();

    const first = await runtime.receiveWorkSignal(signal);
    const replay = await runtime.receiveWorkSignal(signal);

    expect(first).toMatchObject({ receiptId: signal.signalId, replay: false });
    expect(replay).toMatchObject({ receiptId: signal.signalId, replay: true });
    expect(rows).toHaveLength(1);
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue.mock.calls[0]).toEqual(enqueue.mock.calls[1]);
  });

  it("re-enqueues a durable queued receipt when the first queue wake-up fails", async () => {
    const { runtime, rows, enqueue } = harness();
    enqueue.mockRejectedValueOnce(new Error("queue unavailable"));

    await expect(runtime.receiveWorkSignal(signal)).rejects.toThrow("queue unavailable");
    await expect(runtime.receiveWorkSignal(signal)).resolves.toMatchObject({
      receiptId: signal.signalId,
      replay: true,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ deliveryState: "queued" });
    expect(enqueue).toHaveBeenCalledTimes(2);
  });

  it("recovers an identical receipt created by a concurrent writer without a duplicate wake-up", async () => {
    const { runtime, database, rows, enqueue } = harness();
    const create = database.workSignalReceipt.create;
    create.mockImplementationOnce(async ({ data }) => {
      rows.push({
        ...data,
        id: signal.signalId,
        deliveryCursor: 1n,
        deliveryState: "delivered",
        deliveryAttemptCount: 1,
        replayCount: 0,
        deliveredAt: new Date(signal.receivedAt),
        acknowledgedAt: null,
        createdAt: new Date(signal.receivedAt),
        updatedAt: new Date(signal.receivedAt),
      });
      throw new Error("unique constraint");
    });

    await expect(runtime.receiveWorkSignal(signal)).resolves.toMatchObject({
      receiptId: signal.signalId,
      replay: true,
    });

    expect(rows).toHaveLength(1);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("denies an unauthorized recipient before persistence or queueing", async () => {
    const { runtime, rows, enqueue } = harness(false);

    await expect(runtime.receiveWorkSignal(signal)).rejects.toMatchObject({
      code: "EXPERIENCE_RECIPIENT_FORBIDDEN",
      status: 403,
    });
    expect(rows).toHaveLength(0);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("returns only the authenticated recipient projection and denies wrong-user acknowledgement", async () => {
    const { runtime, rows } = harness();
    await runtime.receiveWorkSignal(signal);

    const queued = await runtime.listWhatChanged({ actorId: recipientId, afterCursor: null });
    expect(queued.items).toEqual([]);

    Object.assign(rows[0]!, { deliveryState: "delivered", deliveredAt: new Date() });

    const authorized = await runtime.listWhatChanged({ actorId: recipientId, afterCursor: null });
    const unrelated = await runtime.listWhatChanged({ actorId: unrelatedId, afterCursor: null });

    expect(authorized.items).toHaveLength(1);
    expect(authorized.items[0]).toMatchObject({
      receiptId: signal.signalId,
      type: signal.type,
      source: "work_items",
    });
    expect(unrelated.items).toEqual([]);
    await runtime.acknowledge({ actorId: recipientId, receiptId: signal.signalId });
    await expect(
      runtime.listWhatChanged({ actorId: recipientId, afterCursor: null }),
    ).resolves.toMatchObject({ items: [expect.objectContaining({ state: "acknowledged" })] });
    await expect(
      runtime.acknowledge({ actorId: unrelatedId, receiptId: signal.signalId }),
    ).rejects.toMatchObject({ code: "EXPERIENCE_RECEIPT_FORBIDDEN" });
  });

  it("acknowledges only delivered receipts and treats an owner replay as idempotent", async () => {
    const { runtime, rows } = harness();
    await runtime.receiveWorkSignal(signal);

    await expect(
      runtime.acknowledge({ actorId: recipientId, receiptId: signal.signalId }),
    ).rejects.toMatchObject({ code: "EXPERIENCE_RECEIPT_NOT_DELIVERED", status: 409 });
    Object.assign(rows[0]!, { deliveryState: "delivered", deliveredAt: new Date() });
    await expect(
      runtime.acknowledge({ actorId: recipientId, receiptId: signal.signalId }),
    ).resolves.toEqual({ receiptId: signal.signalId, state: "acknowledged" });
    await expect(
      runtime.acknowledge({ actorId: recipientId, receiptId: signal.signalId }),
    ).resolves.toEqual({ receiptId: signal.signalId, state: "acknowledged" });
  });

  it("revives only the requesting owner's queued receipt during reconnect", async () => {
    const { runtime, enqueue } = harness();
    await runtime.receiveWorkSignal(signal);
    enqueue.mockClear();

    await runtime.listWhatChanged({ actorId: unrelatedId, afterCursor: null });
    expect(enqueue).not.toHaveBeenCalled();
    await runtime.listWhatChanged({ actorId: recipientId, afterCursor: null });
    expect(enqueue).toHaveBeenCalledWith({
      receiptId: signal.signalId,
      correlationId: signal.correlationId,
    });
  });

  it("rejects changed payload under the same idempotency key", async () => {
    const { runtime } = harness();
    await runtime.receiveWorkSignal(signal);
    await expect(
      runtime.receiveWorkSignal({
        ...signal,
        freshness: { ...signal.freshness, safeReasonCode: "changed" },
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT", status: 409 });
  });

  it("persists workflow decisions in a separate idempotent receipt store", async () => {
    const { runtime, rows, workflowRows, enqueue } = harness();
    const event = {
      schemaVersion: 1,
      eventId: "30000000-0000-4000-8000-000000000010",
      type: "experience.retry",
      actorId: recipientId,
      recipientId,
      entityRef: signal.entityRefs[0],
      operationId: "30000000-0000-4000-8000-000000000011",
      idempotencyKey: "retry:30000000-0000-4000-8000-000000000011",
      expectedVersion: null,
      safeReasonCode: "connection_recovered",
      correlationId: "30000000-0000-4000-8000-000000000012",
      occurredAt: "2026-08-12T09:10:00.000Z",
    } as const;

    const first = await runtime.recordWorkflowEvent(event);
    const replay = await runtime.recordWorkflowEvent(event);

    expect(first).toEqual({ receiptId: event.eventId, replay: false });
    expect(replay).toEqual({ receiptId: event.eventId, replay: true });
    expect(workflowRows).toHaveLength(1);
    expect(rows).toHaveLength(0);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("recovers an identical workflow event created by a concurrent writer", async () => {
    const { runtime, database, workflowRows } = harness();
    const event = {
      schemaVersion: 1,
      eventId: "30000000-0000-4000-8000-000000000020",
      type: "experience.retry",
      actorId: recipientId,
      recipientId,
      entityRef: signal.entityRefs[0],
      operationId: "30000000-0000-4000-8000-000000000021",
      idempotencyKey: "retry:30000000-0000-4000-8000-000000000021",
      expectedVersion: null,
      safeReasonCode: "connection_recovered",
      correlationId: "30000000-0000-4000-8000-000000000022",
      occurredAt: "2026-08-12T09:10:00.000Z",
    } as const;
    database.experienceWorkflowEventReceipt.create.mockImplementationOnce(async ({ data }) => {
      workflowRows.push({ ...data, createdAt: new Date(event.occurredAt) });
      throw new Error("unique constraint");
    });

    await expect(runtime.recordWorkflowEvent(event)).resolves.toEqual({
      receiptId: event.eventId,
      replay: true,
    });
    expect(workflowRows).toHaveLength(1);
  });
});
