import { describe, expect, it } from "vitest";

import { JobEnvelopeSchema, jobQueueName } from "./jobs.js";

const envelope = {
  jobVersion: 1,
  jobType: "system.test",
  operationId: "4fd02cc1-2a49-4af6-a4a3-240e906495c5",
  correlationId: "9a11bb8f-79f5-4a72-a98f-2e763e97699b",
  trace: {
    traceId: "0123456789abcdef0123456789abcdef",
    spanId: "0123456789abcdef",
  },
  scope: { organizationId: "cfc37f55-68f1-4c7c-b787-b76c44f02e67" },
  idempotencyKey: "system.test:fixture-1",
  payload: { value: "safe" },
} as const;

describe("JobEnvelopeSchema", () => {
  it("requires version, operation, trace, scope, and idempotency", () => {
    expect(JobEnvelopeSchema.parse(envelope).jobVersion).toBe(1);
  });

  it("rejects unknown fields and malformed identifiers", () => {
    expect(() => JobEnvelopeSchema.parse({ ...envelope, unexpected: true })).toThrow();
    expect(() => JobEnvelopeSchema.parse({ ...envelope, operationId: "not-a-uuid" })).toThrow();
    expect(() => JobEnvelopeSchema.parse({ ...envelope, correlationId: "not-a-uuid" })).toThrow();
    expect(() =>
      JobEnvelopeSchema.parse({
        ...envelope,
        trace: { ...envelope.trace, traceId: "ABCDEF0123456789ABCDEF0123456789" },
      }),
    ).toThrow();
  });

  it("bounds version, type, idempotency, scope, and serialized payload size", () => {
    expect(() => JobEnvelopeSchema.parse({ ...envelope, jobVersion: 0 })).toThrow();
    expect(() => JobEnvelopeSchema.parse({ ...envelope, jobType: "Invalid Type" })).toThrow();
    expect(() => JobEnvelopeSchema.parse({ ...envelope, idempotencyKey: "x" })).toThrow();
    expect(() =>
      JobEnvelopeSchema.parse({
        ...envelope,
        scope: {
          ...envelope.scope,
          departmentId: "not-a-uuid",
        },
      }),
    ).toThrow();
    expect(() =>
      JobEnvelopeSchema.parse({ ...envelope, payload: { value: "x".repeat(65_537) } }),
    ).toThrow();
  });

  it("rejects payloads that cannot be serialized as JSON", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => JobEnvelopeSchema.parse({ ...envelope, payload: circular })).toThrow();
    expect(() => JobEnvelopeSchema.parse({ ...envelope, payload: { value: 1n } })).toThrow();
    expect(() => JobEnvelopeSchema.parse({ ...envelope, payload: { value: undefined } })).toThrow();
    expect(() =>
      JobEnvelopeSchema.parse({ ...envelope, payload: { value: () => "hidden" } }),
    ).toThrow();
    expect(() =>
      JobEnvelopeSchema.parse({ ...envelope, payload: { value: Number.NaN } }),
    ).toThrow();
  });

  it("derives a versioned domain queue name", () => {
    expect(jobQueueName("system.test", 1)).toBe("system:v1");
  });
});
