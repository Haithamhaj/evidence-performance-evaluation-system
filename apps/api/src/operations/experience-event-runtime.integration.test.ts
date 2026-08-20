import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@evaluation/database";
import { WorkItemsExperienceRecipientAuthorizer } from "@evaluation/work-items";

import { ExperienceEventRuntime } from "./experience-event-runtime.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const ownerId = crypto.randomUUID();
const unrelatedId = crypto.randomUUID();
const inboxItemId = crypto.randomUUID();
const signalId = crypto.randomUUID();
const correlationId = crypto.randomUUID();

beforeAll(async () => {
  await database.user.createMany({
    data: [
      {
        id: ownerId,
        email: `t088-owner-${ownerId}@example.test`,
        displayName: "T088 owner",
        active: true,
      },
      {
        id: unrelatedId,
        email: `t088-unrelated-${unrelatedId}@example.test`,
        displayName: "T088 unrelated user",
        active: true,
      },
    ],
  });
  await database.privateInboxItem.create({
    data: { id: inboxItemId, employeeId: ownerId, text: "Deterministic T088 demo capture" },
  });
});

afterAll(async () => {
  await database.experienceWorkflowEventReceipt.deleteMany({
    where: { OR: [{ actorId: ownerId }, { recipientId: ownerId }] },
  });
  await database.workSignalReceipt.deleteMany({ where: { recipientId: ownerId } });
  await database.privateInboxItem.deleteMany({ where: { id: inboxItemId } });
  await database.user.deleteMany({ where: { id: { in: [ownerId, unrelatedId] } } });
  await database.$disconnect();
});

describe("T088 deterministic authorized refresh demo", () => {
  it("shows one delivered change to its owner and zero to an unrelated user", async () => {
    const queued: Array<{ receiptId: string; correlationId: string }> = [];
    const runtime = new ExperienceEventRuntime(
      database,
      new WorkItemsExperienceRecipientAuthorizer(database),
      { enqueue: async (job) => void queued.push(job) },
    );
    const now = "2026-08-12T11:00:00.000Z";
    await runtime.receiveWorkSignal({
      schemaVersion: 1,
      signalId,
      type: "user.capture_submitted",
      sourceClass: "user_domain_action",
      originatingDomain: "work_items",
      entityRefs: [{ entityType: "private_inbox_item", entityId: inboxItemId, version: 1 }],
      actor: { kind: "human", id: ownerId },
      occurredAt: now,
      receivedAt: now,
      idempotencyKey: `t088:${inboxItemId}:v1`,
      visibility: { kind: "owner", recipientId: ownerId },
      correlationId,
      freshness: {
        state: "fresh",
        evaluatedAt: now,
        sourceUpdatedAt: now,
        safeReasonCode: "source_current",
        recoveryMode: "none",
        expectedVersion: 1,
      },
    });

    expect(queued).toEqual([{ receiptId: signalId, correlationId }]);
    await database.workSignalReceipt.update({
      where: { id: signalId },
      data: {
        deliveryState: "delivered",
        deliveryAttemptCount: { increment: 1 },
        deliveredAt: new Date("2026-08-12T11:00:01.000Z"),
      },
    });

    const owner = await runtime.listWhatChanged({ actorId: ownerId, afterCursor: null });
    const unrelated = await runtime.listWhatChanged({ actorId: unrelatedId, afterCursor: null });
    expect(owner.items).toEqual([
      expect.objectContaining({
        receiptId: signalId,
        state: "delivered",
        type: "user.capture_submitted",
      }),
    ]);
    expect(unrelated.items).toEqual([]);
  });
});
