import { describe, expect, it } from "vitest";

import { ProductTelemetryEventV1Schema } from "./product-telemetry.js";

describe("ProductTelemetryEventV1Schema", () => {
  it("accepts only minimized allowlisted product-use fields", () => {
    expect(
      ProductTelemetryEventV1Schema.parse({
        schemaVersion: 1,
        type: "telemetry.capture_completed",
        occurredAt: "2026-08-12T08:10:00.000Z",
        metadata: { input_type: "text", surface: "capture", result_class: "success" },
      }),
    ).toMatchObject({ type: "telemetry.capture_completed" });
  });

  it("rejects protected domain content and arbitrary telemetry names", () => {
    expect(() =>
      ProductTelemetryEventV1Schema.parse({
        schemaVersion: 1,
        type: "telemetry.capture_completed",
        occurredAt: "2026-08-12T08:10:00.000Z",
        metadata: {
          input_type: "text",
          surface: "capture",
          result_class: "success",
          content_body: "private employee note",
        },
      }),
    ).toThrow();
    expect(() =>
      ProductTelemetryEventV1Schema.parse({
        schemaVersion: 1,
        type: "telemetry.employee_rank",
        occurredAt: "2026-08-12T08:10:00.000Z",
        metadata: {},
      }),
    ).toThrow();
  });
});
