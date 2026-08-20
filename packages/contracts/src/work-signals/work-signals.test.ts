import { describe, expect, it } from "vitest";

import { WorkSignalV1Schema } from "./work-signals.js";

const validSignal = {
  schemaVersion: 1,
  signalId: "10000000-0000-4000-8000-000000000001",
  type: "user.capture_submitted",
  sourceClass: "user_domain_action",
  originatingDomain: "work_items",
  entityRefs: [
    {
      entityType: "private_inbox_item",
      entityId: "10000000-0000-4000-8000-000000000002",
      version: 1,
    },
  ],
  actor: { kind: "human", id: "10000000-0000-4000-8000-000000000003" },
  occurredAt: "2026-08-12T08:00:00.000Z",
  receivedAt: "2026-08-12T08:00:01.000Z",
  idempotencyKey: "capture:10000000-0000-4000-8000-000000000002:v1",
  visibility: {
    kind: "owner",
    recipientId: "10000000-0000-4000-8000-000000000003",
  },
  correlationId: "10000000-0000-4000-8000-000000000004",
  freshness: {
    state: "fresh",
    evaluatedAt: "2026-08-12T08:00:01.000Z",
    sourceUpdatedAt: "2026-08-12T08:00:00.000Z",
    safeReasonCode: "source_current",
    recoveryMode: "none",
    expectedVersion: 1,
  },
} as const;

describe("WorkSignalV1Schema", () => {
  it("accepts an authorized owner-scoped domain signal", () => {
    expect(WorkSignalV1Schema.parse(validSignal)).toEqual(validSignal);
  });

  it("fails closed for unknown signal names and schema versions", () => {
    expect(() => WorkSignalV1Schema.parse({ ...validSignal, type: "page.viewed" })).toThrow();
    expect(() => WorkSignalV1Schema.parse({ ...validSignal, schemaVersion: 2 })).toThrow();
  });

  it("rejects a mismatched source class and non-owner visibility", () => {
    expect(() => WorkSignalV1Schema.parse({ ...validSignal, sourceClass: "connector" })).toThrow();
    expect(() =>
      WorkSignalV1Schema.parse({
        ...validSignal,
        visibility: { kind: "department", recipientId: validSignal.actor.id },
      }),
    ).toThrow();
  });
});
