import { afterAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "./index.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

afterAll(async () => client.$disconnect());

describe("work items and progress contract schema", () => {
  it("creates the bounded Phase 2 foundation tables without a manual percentage", async () => {
    const tables = await client.$queryRaw<Array<{ name: string | null }>>`
      SELECT to_regclass('"WorkItem"')::text AS name
      UNION ALL SELECT to_regclass('"WorkItemStatusHistory"')::text
      UNION ALL SELECT to_regclass('"WorkItemAssignmentHistory"')::text
      UNION ALL SELECT to_regclass('"ProgressContract"')::text
      UNION ALL SELECT to_regclass('"ProgressContractComponent"')::text
      UNION ALL SELECT to_regclass('"ProgressContractTransition"')::text
      UNION ALL SELECT to_regclass('"ProgressHumanConfirmation"')::text
      UNION ALL SELECT to_regclass('"ProgressSnapshot"')::text
      UNION ALL SELECT to_regclass('"ProgressSnapshotSource"')::text
    `;
    expect(tables.map(({ name }) => name)).not.toContain(null);

    const forbiddenColumns = await client.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('WorkItem', 'ProgressContract', 'ProgressSnapshot')
        AND lower(column_name) IN (
          'manualpercent',
          'manual_percent',
          'suggestedrating',
          'predictedrating',
          'productivityscore'
        )
    `;
    expect(forbiddenColumns).toEqual([]);

    const contractVersionColumns = await client.$queryRaw<
      Array<{ column_name: string; is_nullable: string }>
    >`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ProgressContract'
        AND column_name IN ('contractVersion', 'version')
      ORDER BY column_name
    `;
    expect(contractVersionColumns).toEqual([
      { column_name: "contractVersion", is_nullable: "NO" },
      { column_name: "version", is_nullable: "NO" },
    ]);

    const lineageIndexes = await client.$queryRaw<Array<{ indexdef: string }>>`
      SELECT indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'ProgressContract_project_version_unique',
          'ProgressContract_workstream_version_unique'
        )
      ORDER BY indexname
    `;
    expect(lineageIndexes).toHaveLength(2);
    expect(lineageIndexes.every(({ indexdef }) => indexdef.includes('"contractVersion"'))).toBe(
      true,
    );
  });

  it("protects Work Item and progress history with append-only triggers", async () => {
    const triggers = await client.$queryRaw<Array<{ table_name: string; trigger_name: string }>>`
      SELECT event_object_table AS table_name, trigger_name
      FROM information_schema.triggers
      WHERE event_object_schema = 'public'
        AND event_object_table IN (
          'WorkItemStatusHistory',
          'WorkItemAssignmentHistory',
          'ProgressContractTransition',
          'ProgressHumanConfirmation',
          'ProgressSnapshot',
          'ProgressSnapshotSource'
        )
        AND event_manipulation IN ('UPDATE', 'DELETE')
      ORDER BY event_object_table, trigger_name
    `;
    expect(new Set(triggers.map(({ table_name }) => table_name))).toEqual(
      new Set([
        "WorkItemStatusHistory",
        "WorkItemAssignmentHistory",
        "ProgressContractTransition",
        "ProgressHumanConfirmation",
        "ProgressSnapshot",
        "ProgressSnapshotSource",
      ]),
    );
  });
});
