import { describe, expect, it } from "vitest";

import {
  ExperienceDeliveryJobSchema,
  ExperienceWorkflowEventV1Schema,
} from "./experience-events.js";

const validEvent = {
  schemaVersion: 1,
  eventId: "20000000-0000-4000-8000-000000000001",
  type: "experience.retry",
  actorId: "20000000-0000-4000-8000-000000000002",
  recipientId: "20000000-0000-4000-8000-000000000002",
  entityRef: {
    entityType: "private_inbox_item",
    entityId: "20000000-0000-4000-8000-000000000003",
    version: 1,
  },
  operationId: "20000000-0000-4000-8000-000000000004",
  idempotencyKey: "retry:20000000-0000-4000-8000-000000000004",
  expectedVersion: null,
  safeReasonCode: "connection_recovered",
  correlationId: "20000000-0000-4000-8000-000000000005",
  occurredAt: "2026-08-12T08:10:00.000Z",
} as const;

describe("ExperienceWorkflowEventV1Schema", () => {
  it("accepts the closed retry lifecycle event", () => {
    expect(ExperienceWorkflowEventV1Schema.parse(validEvent)).toEqual(validEvent);
  });

  it("fails closed for an unknown workflow event or version", () => {
    expect(() =>
      ExperienceWorkflowEventV1Schema.parse({ ...validEvent, type: "experience.opened" }),
    ).toThrow();
    expect(() =>
      ExperienceWorkflowEventV1Schema.parse({ ...validEvent, schemaVersion: 2 }),
    ).toThrow();
  });
});

describe("ExperienceDeliveryJobSchema", () => {
  it("accepts only the closed work-signal delivery job", () => {
    expect(
      ExperienceDeliveryJobSchema.parse({
        schemaVersion: 1,
        jobType: "experience.deliver",
        receiptId: "20000000-0000-4000-8000-000000000006",
        correlationId: "20000000-0000-4000-8000-000000000007",
      }),
    ).toMatchObject({ jobType: "experience.deliver" });
    expect(() =>
      ExperienceDeliveryJobSchema.parse({
        schemaVersion: 1,
        jobType: "telemetry.deliver",
        receiptId: "20000000-0000-4000-8000-000000000006",
        correlationId: "20000000-0000-4000-8000-000000000007",
      }),
    ).toThrow();
  });
});
