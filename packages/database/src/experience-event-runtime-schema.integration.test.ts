import { afterAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "./client.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

afterAll(async () => database.$disconnect());

describe("experience event runtime schema", () => {
  it("keeps work-signal delivery and workflow-event receipts in separate durable tables", async () => {
    const tables = await database.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('WorkSignalReceipt', 'ExperienceWorkflowEventReceipt')
      ORDER BY table_name
    `;
    expect(tables.map(({ table_name }) => table_name)).toEqual([
      "ExperienceWorkflowEventReceipt",
      "WorkSignalReceipt",
    ]);

    const constraints = await database.$queryRaw<Array<{ conname: string }>>`
      SELECT conname
      FROM pg_constraint
      WHERE conname IN (
        'WorkSignalReceipt_closed_taxonomy_check',
        'ExperienceWorkflowEventReceipt_closed_taxonomy_check'
      )
      ORDER BY conname
    `;
    expect(constraints.map(({ conname }) => conname)).toEqual([
      "ExperienceWorkflowEventReceipt_closed_taxonomy_check",
      "WorkSignalReceipt_closed_taxonomy_check",
    ]);
  });
});
