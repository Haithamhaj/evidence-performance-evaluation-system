import { describe, expect, it } from "vitest";

import {
  NotificationDeliveryJobSchema,
  NotificationDomainEventSchema,
  NotificationIntentSchema,
  NotificationUrgencySchema,
} from "./notifications.js";

const validIntent = {
  schemaVersion: 1,
  id: "10000000-0000-4000-8000-000000000001",
  recipientId: "10000000-0000-4000-8000-000000000002",
  category: "CHECK_IN_DUE",
  urgency: "ACTION_REQUIRED",
  template: { version: 1, key: "check_in_due", arguments: { scopeLabel: "Project" } },
  action: { kind: "CHECK_IN", resourceId: "10000000-0000-4000-8000-000000000003" },
  source: { eventId: "event-1", eventVersion: 1 },
  dedupeKey: "check-in:2026-08-07",
  channels: ["IN_APP", "EMAIL"],
  deliverAfter: "2026-08-07T08:00:00.000Z",
  createdAt: "2026-08-07T08:00:00.000Z",
};

describe("notification contracts", () => {
  it("accepts the approved urgency vocabulary", () => {
    expect(NotificationUrgencySchema.parse("ACTION_REQUIRED")).toBe("ACTION_REQUIRED");
  });

  it("rejects performance scoring fields", () => {
    expect(() => NotificationIntentSchema.parse({ ...validIntent, employeeScore: 82 })).toThrow();
  });

  it("accepts a minimal actionable intent", () => {
    expect(NotificationIntentSchema.parse(validIntent)).toMatchObject({
      dedupeKey: validIntent.dedupeKey,
    });
  });

  it("accepts only bounded notification events and delivery jobs", () => {
    expect(
      NotificationDomainEventSchema.parse({
        type: "CHECK_IN_DUE",
        eventId: "check-in-event",
        eventVersion: 1,
        recipientId: "10000000-0000-4000-8000-000000000002",
        obligationId: "10000000-0000-4000-8000-000000000003",
        dueAt: "2026-08-07T08:00:00.000Z",
      }),
    ).toMatchObject({ type: "CHECK_IN_DUE" });
    expect(
      NotificationDeliveryJobSchema.parse({
        schemaVersion: 1,
        jobType: "notifications.deliver",
        intentId: "10000000-0000-4000-8000-000000000001",
        correlationId: "10000000-0000-4000-8000-000000000004",
      }),
    ).toMatchObject({ jobType: "notifications.deliver" });
  });
});
