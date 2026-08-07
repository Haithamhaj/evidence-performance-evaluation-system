import { describe, expect, it } from "vitest";

import { AdminCommandSchema, AdminHealthStateSchema } from "./administration.js";

describe("administration contracts", () => {
  it("accepts bounded health states", () => {
    expect(AdminHealthStateSchema.parse("DEGRADED")).toBe("DEGRADED");
  });

  it("rejects forbidden manager authority", () => {
    expect(() =>
      AdminCommandSchema.parse({
        schemaVersion: 1,
        idempotencyKey: "10000000-0000-4000-8000-000000000001",
        actorId: "10000000-0000-4000-8000-000000000002",
        capability: "PROJECT_REASSIGN",
        expectedVersion: 1,
        reason: "test",
        payload: {},
      }),
    ).toThrow();
  });
});
