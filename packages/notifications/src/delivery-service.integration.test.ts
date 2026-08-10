import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@evaluation/database";

import { InMemoryEmailAdapter } from "./adapters/in-memory-email.js";
import { NotificationDeliveryService } from "./delivery-service.js";
import { NotificationIntentService } from "./intent-service.js";
import { NotificationPreferenceService } from "./preference-service.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const recipientId = randomUUID();

beforeAll(async () => {
  await database.user.create({
    data: { id: recipientId, email: `${recipientId}@example.test`, displayName: "Recipient" },
  });
});
afterAll(async () => database.$disconnect());

async function createIntent() {
  return new NotificationIntentService(database).create({
    recipientId,
    category: "EXPORT_READY",
    urgency: "ACTION",
    template: { version: 1, key: "export_ready", arguments: {} },
    action: { kind: "DOWNLOAD_EXPORT", resourceId: randomUUID() },
    source: { eventId: randomUUID(), eventVersion: 1 },
    dedupeKey: randomUUID(),
    channels: ["IN_APP", "EMAIL"],
    deliverAfter: new Date(),
  });
}

describe("NotificationDeliveryService", () => {
  it("persists the in-app action before a transient email failure", async () => {
    const intent = await createIntent();
    const email = new InMemoryEmailAdapter();
    email.failNext("TRANSIENT");
    const delivery = new NotificationDeliveryService(
      database,
      new NotificationPreferenceService(database),
      email,
    );

    await expect(delivery.deliver(intent.id, randomUUID())).rejects.toMatchObject({
      retryable: true,
    });
    const stored = await database.notificationIntent.findUniqueOrThrow({
      where: { id: intent.id },
    });
    expect(stored.inAppState).toBe("READY");
    await expect(
      database.notificationDeliveryAttempt.findFirstOrThrow({
        where: { intentId: intent.id, channel: "EMAIL" },
        orderBy: { attempt: "desc" },
      }),
    ).resolves.toMatchObject({ state: "RETRY_SCHEDULED", nextRetryAt: expect.any(Date) });
  });

  it("does not deliver before deliverAfter", async () => {
    const service = new NotificationIntentService(database);
    const intent = await service.create({
      recipientId,
      category: "EXPORT_READY",
      urgency: "ACTION",
      template: { version: 1, key: "export_ready", arguments: {} },
      action: { kind: "DOWNLOAD_EXPORT", resourceId: randomUUID() },
      source: { eventId: randomUUID(), eventVersion: 1 },
      dedupeKey: randomUUID(),
      channels: ["IN_APP", "EMAIL"],
      deliverAfter: new Date(Date.now() + 60_000),
    });
    const email = new InMemoryEmailAdapter();
    const delivery = new NotificationDeliveryService(
      database,
      new NotificationPreferenceService(database),
      email,
    );
    await expect(delivery.deliver(intent.id, randomUUID())).rejects.toMatchObject({
      retryable: true,
    });
    expect(email.messages).toHaveLength(0);
    await expect(
      database.notificationIntent.findUniqueOrThrow({ where: { id: intent.id } }),
    ).resolves.toMatchObject({ inAppState: "PENDING" });
  });

  it("does not duplicate a successful authoritative delivery", async () => {
    const intent = await createIntent();
    const email = new InMemoryEmailAdapter();
    const delivery = new NotificationDeliveryService(
      database,
      new NotificationPreferenceService(database),
      email,
    );

    await delivery.deliver(intent.id, randomUUID());
    await delivery.deliver(intent.id, randomUUID());

    expect(email.messages).toHaveLength(1);
  });
});
