import { afterAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "./index.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

afterAll(async () => client.$disconnect());

describe("updates and evidence schema", () => {
  it("creates the bounded update, evidence, and accepted-event lineage", async () => {
    const expected = [
      "AcceptedEvidenceEvent",
      "AcceptedUpdateEvent",
      "ClarificationAnswer",
      "ClarificationSession",
      "ClarificationTurn",
      "EvidenceAttribution",
      "EvidenceConfirmation",
      "EvidenceLink",
      "EvidenceRecord",
      "EvidenceRevision",
      "EvidenceVerification",
      "ProgressRecalculationRequest",
      "StructuredUpdateDraftRevision",
      "UpdateConfirmation",
      "UpdateSource",
    ];
    const tables = await client.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY(${expected}::text[])
      ORDER BY table_name
    `;
    expect(tables.map(({ table_name }) => table_name)).toEqual(expected);
  });

  it("keeps accepted lineage append-only and excludes performance outputs", async () => {
    const protectedTables = [
      "AcceptedEvidenceEvent",
      "AcceptedUpdateEvent",
      "ClarificationAnswer",
      "ClarificationTurn",
      "EvidenceAttribution",
      "EvidenceConfirmation",
      "EvidenceLink",
      "EvidenceRevision",
      "EvidenceVerification",
      "StructuredUpdateDraftRevision",
      "UpdateConfirmation",
      "UpdateSource",
    ];
    const triggers = await client.$queryRaw<Array<{ table_name: string }>>`
      SELECT DISTINCT event_object_table AS table_name
      FROM information_schema.triggers
      WHERE event_object_schema = 'public'
        AND event_object_table = ANY(${protectedTables}::text[])
        AND event_manipulation IN ('UPDATE', 'DELETE')
      ORDER BY event_object_table
    `;
    expect(triggers.map(({ table_name }) => table_name)).toEqual(protectedTables);

    const forbidden = await client.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN (
          'UpdateSource',
          'StructuredUpdateDraftRevision',
          'AcceptedUpdateEvent',
          'EvidenceRecord',
          'EvidenceRevision',
          'AcceptedEvidenceEvent'
        )
        AND lower(column_name) IN (
          'rating',
          'suggestedrating',
          'predictedrating',
          'rank',
          'productivityscore',
          'readinessscore',
          'manualpercent',
          'provideroverride',
          'modeloverride'
        )
    `;
    expect(forbidden).toEqual([]);
  });

  it("requires employee confirmation before accepted update and evidence events", async () => {
    const foreignKeys = await client.$queryRaw<
      Array<{ source_table: string; target_table: string }>
    >`
      SELECT
        source.relname AS source_table,
        target.relname AS target_table
      FROM pg_constraint constraint_row
      JOIN pg_class source ON source.oid = constraint_row.conrelid
      JOIN pg_class target ON target.oid = constraint_row.confrelid
      WHERE constraint_row.contype = 'f'
        AND source.relname IN ('AcceptedUpdateEvent', 'AcceptedEvidenceEvent')
      ORDER BY source.relname, target.relname
    `;
    expect(foreignKeys).toEqual(
      expect.arrayContaining([
        { source_table: "AcceptedEvidenceEvent", target_table: "EvidenceConfirmation" },
        { source_table: "AcceptedUpdateEvent", target_table: "UpdateConfirmation" },
      ]),
    );
  });
});
