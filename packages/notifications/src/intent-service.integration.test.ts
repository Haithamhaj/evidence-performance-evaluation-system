import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@evaluation/database";

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

describe("NotificationIntentService", () => {
  it("deduplicates an authoritative event for the same recipient and category", async () => {
    const service = new NotificationIntentService(database);
    const input = {
      recipientId,
      category: "CHECK_IN_DUE" as const,
      urgency: "ACTION_REQUIRED" as const,
      template: { version: 1, key: "check_in_due", arguments: {} },
      action: { kind: "CHECK_IN" as const, resourceId: randomUUID() },
      source: { eventId: randomUUID(), eventVersion: 1 },
      dedupeKey: `check-in:${randomUUID()}`,
      channels: ["IN_APP", "EMAIL"] as const,
      deliverAfter: new Date("2026-08-07T08:00:00.000Z"),
    };

    const first = await service.create(input);
    const second = await service.create(input);

    expect(second.id).toBe(first.id);
  });

  it("reauthorizes the target when opened and denies a revoked action", async () => {
    const service = new NotificationIntentService(database);
    const intent = await service.create({
      recipientId,
      category: "DOCUMENT_REVIEW",
      urgency: "ACTION",
      template: { version: 1, key: "document_review", arguments: {} },
      action: { kind: "REVIEW_DOCUMENT", resourceId: randomUUID() },
      source: { eventId: randomUUID(), eventVersion: 1 },
      dedupeKey: randomUUID(),
      channels: ["IN_APP"],
      deliverAfter: new Date(),
    });

    await expect(service.open(intent.id, recipientId, async () => false)).resolves.toEqual({
      allowed: false,
      reason: "TARGET_ACCESS_REVOKED",
    });
  });

  it("keeps critical email enabled while honoring optional email preferences", async () => {
    const preferences = new NotificationPreferenceService(database);
    await preferences.set({ recipientId, category: "CHECK_IN_DUE", emailEnabled: false });
    await preferences.set({ recipientId, category: "SECURITY_ALERT", emailEnabled: false });

    await expect(preferences.emailAllowed(recipientId, "CHECK_IN_DUE")).resolves.toBe(false);
    await expect(preferences.emailAllowed(recipientId, "SECURITY_ALERT")).resolves.toBe(true);
  });
});
