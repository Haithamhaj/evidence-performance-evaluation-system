import { afterAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "./index.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

afterAll(async () => client.$disconnect());

describe("progress contract AI draft schema", () => {
  it("creates restrictive request and append-only revision history", async () => {
    const tables = await client.$queryRaw<Array<{ name: string | null }>>`
      SELECT to_regclass('"ProgressContractAiDraftRequest"')::text AS name
      UNION ALL
      SELECT to_regclass('"ProgressContractAiDraftRevision"')::text
    `;
    expect(tables.map(({ name }) => name)).not.toContain(null);

    const foreignKeys = await client.$queryRaw<
      Array<{ table_name: string; delete_rule: string }>
    >`
      SELECT tc.table_name, rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_schema = tc.constraint_schema
       AND rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_schema = 'public'
        AND tc.table_name IN (
          'ProgressContractAiDraftRequest',
          'ProgressContractAiDraftRevision'
        )
    `;
    expect(foreignKeys.length).toBeGreaterThanOrEqual(7);
    expect(foreignKeys.every(({ delete_rule }) => delete_rule === "RESTRICT")).toBe(true);

    const revisionTriggers = await client.$queryRaw<Array<{ manipulation: string }>>`
      SELECT event_manipulation AS manipulation
      FROM information_schema.triggers
      WHERE event_object_schema = 'public'
        AND event_object_table = 'ProgressContractAiDraftRevision'
        AND event_manipulation IN ('UPDATE', 'DELETE')
      ORDER BY event_manipulation
    `;
    expect(revisionTriggers.map(({ manipulation }) => manipulation)).toEqual([
      "DELETE",
      "UPDATE",
    ]);
  });

  it("pins idempotency and monotonically increasing revision numbers", async () => {
    const indexes = await client.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'ProgressContractAiDraftRequest_requestedById_idempotencyKey_key',
          'ProgressContractAiDraftRevision_requestId_revision_key'
        )
      ORDER BY indexname
    `;
    expect(indexes).toHaveLength(2);
  });
});
