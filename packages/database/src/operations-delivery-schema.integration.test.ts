import { afterAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "./index.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

afterAll(async () => database.$disconnect());

describe("operations delivery and reporting schema", () => {
  it("creates notification and export lifecycle tables", async () => {
    const expected = [
      "AdminMutationReceipt",
      "AdminProbeHistory",
      "ExportAccessEvent",
      "ExportArtifact",
      "ExportManifest",
      "ExportRequest",
      "ExportRevocation",
      "NotificationDeliveryAttempt",
      "NotificationIntent",
      "NotificationPreference",
    ].sort();
    const rows = await database.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY(${expected}::text[])
      ORDER BY table_name
    `;
    expect(rows.map(({ table_name }) => table_name)).toEqual(expected);
  });

  it("enforces notification and export idempotency in the database", async () => {
    const expected = [
      "ExportRequest_requesterId_idempotencyKey_key",
      "NotificationIntent_recipientId_category_dedupeKey_key",
    ].sort();
    const rows = await database.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = ANY(${expected}::text[])
      ORDER BY indexname
    `;
    expect(rows.map(({ indexname }) => indexname)).toEqual(expected);
  });

  it("protects immutable manifests and append-only audit rows", async () => {
    const expected = ["ExportAccessEvent", "ExportManifest", "ExportRevocation"].sort();
    const rows = await database.$queryRaw<Array<{ table_name: string }>>`
      SELECT event_object_table AS table_name
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
        AND trigger_name LIKE '%_append_only'
        AND event_object_table = ANY(${expected}::text[])
      GROUP BY event_object_table
      ORDER BY event_object_table
    `;
    expect(rows.map(({ table_name }) => table_name)).toEqual(expected);
  });
});
