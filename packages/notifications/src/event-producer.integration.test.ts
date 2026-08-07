import { randomUUID } from "node:crypto";

import { createDatabaseClient } from "@evaluation/database";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { NotificationEventProducer } from "./event-producer.js";
import { NotificationIntentService } from "./intent-service.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const recipientId = randomUUID();

beforeAll(async () => {
  await database.user.create({
    data: { id: recipientId, email: `${recipientId}@example.test`, displayName: "Recipient" },
  });
});
afterAll(async () => database.$disconnect());

describe("NotificationEventProducer", () => {
  it("maps approved source events to one deduplicated intent and request-only delivery job", async () => {
    const enqueue = vi.fn().mockResolvedValue({ jobId: "job" });
    const queue = { enqueue, close: async () => undefined };
    const producer = new NotificationEventProducer(new NotificationIntentService(database), queue);
    const event = {
      type: "CHECK_IN_DUE",
      eventId: randomUUID(),
      eventVersion: 1,
      recipientId,
      obligationId: randomUUID(),
      dueAt: "2026-08-07T08:00:00.000Z",
    } as const;
    const first = await producer.publish(event);
    const second = await producer.publish(event);
    expect(second.id).toBe(first.id);
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue).toHaveBeenLastCalledWith(
      { intentId: first.id, correlationId: expect.any(String) },
      { deliverAfter: new Date(event.dueAt) },
    );
    expect(JSON.stringify(enqueue.mock.calls)).not.toMatch(/rating|score|readiness/iu);
  });
});
