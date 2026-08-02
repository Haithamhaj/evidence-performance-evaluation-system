import { afterAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "./index.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

afterAll(async () => client.$disconnect());

const contextTables = [
  "ContextAnalysis",
  "ProjectLinkSuggestion",
  "TaskDraft",
  "SourceLinkCorrection",
] as const;

describe("context intelligence schema", () => {
  it("persists governed versions, AI route trace, sources, review status, and superseding revisions", async () => {
    const columns = await client.$queryRaw<
      Array<{ table_name: string; column_name: string; is_nullable: string }>
    >`
      SELECT table_name, column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN (
          'ContextAnalysis',
          'ProjectLinkSuggestion',
          'TaskDraft',
          'SourceLinkCorrection'
        )
      ORDER BY table_name, ordinal_position
    `;
    const names = new Set(
      columns.map(({ table_name, column_name }) => `${table_name}.${column_name}`),
    );

    for (const table of ["ContextAnalysis", "ProjectLinkSuggestion", "TaskDraft"] as const) {
      expect(names).toContain(`${table}.schemaVersion`);
      expect(names).toContain(`${table}.promptVersion`);
      expect(names).toContain(`${table}.aiRunTraceId`);
      expect(names).toContain(`${table}.sourceReferences`);
      expect(names).toContain(`${table}.reviewStatus`);
      expect(names).toContain(`${table}.revision`);
    }
    expect(names).toContain("ContextAnalysis.supersedesAnalysisId");
    expect(names).toContain("ProjectLinkSuggestion.supersedesSuggestionId");
    expect(names).toContain("TaskDraft.supersedesTaskDraftId");
    expect(names).toContain("SourceLinkCorrection.correctedById");
    expect(names).toContain("ContextAnalysis.outputCiphertext");
    expect(names).toContain("ContextAnalysis.outputKeyVersion");
    expect(names).toContain("ProjectLinkSuggestion.explanationCiphertext");
    expect(names).toContain("ProjectLinkSuggestion.explanationKeyVersion");
    expect(names).toContain("TaskDraft.draftCiphertext");
    expect(names).toContain("TaskDraft.draftKeyVersion");
    expect(names).toContain("SourceLinkCorrection.reasonCiphertext");
    expect(names).toContain("SourceLinkCorrection.reasonKeyVersion");
    expect(names).toContain("SourceLinkCorrection.supersedingSuggestionId");

    for (const forbiddenPlaintextColumn of [
      "ContextAnalysis.summary",
      "ContextAnalysis.uncertainties",
      "ProjectLinkSuggestion.explanation",
      "TaskDraft.title",
      "TaskDraft.description",
      "TaskDraft.acceptanceConditions",
      "TaskDraft.uncertainties",
      "SourceLinkCorrection.reason",
      "ContextAnalysis.correctionReason",
      "ProjectLinkSuggestion.correctionReason",
      "TaskDraft.correctionReason",
    ]) {
      expect(names).not.toContain(forbiddenPlaintextColumn);
    }
  });

  it("retains governed output and employee corrections as append-only history", async () => {
    const triggerEvents = await client.$queryRaw<
      Array<{ event_object_table: string; event_manipulation: string }>
    >`
      SELECT event_object_table, event_manipulation
      FROM information_schema.triggers
      WHERE event_object_schema = 'public'
        AND event_object_table IN (
          'ContextAnalysis',
          'ProjectLinkSuggestion',
          'TaskDraft',
          'SourceLinkCorrection'
        )
        AND event_manipulation IN ('UPDATE', 'DELETE')
      ORDER BY event_object_table, event_manipulation
    `;

    for (const table of contextTables) {
      expect(
        triggerEvents
          .filter(({ event_object_table }) => event_object_table === table)
          .map(({ event_manipulation }) => event_manipulation),
      ).toEqual(["DELETE", "UPDATE"]);
    }
  });

  it("uses restrictive foreign keys and employee-owned correction constraints", async () => {
    const foreignKeys = await client.$queryRaw<Array<{ table_name: string; delete_rule: string }>>`
      SELECT tc.table_name, rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_schema = tc.constraint_schema
       AND rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_schema = 'public'
        AND tc.table_name IN (
          'ContextAnalysis',
          'ProjectLinkSuggestion',
          'TaskDraft',
          'SourceLinkCorrection'
        )
    `;
    expect(foreignKeys.length).toBeGreaterThanOrEqual(16);
    expect(foreignKeys.every(({ delete_rule }) => delete_rule === "RESTRICT")).toBe(true);

    const constraints = await client.$queryRaw<Array<{ constraint_name: string }>>`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND constraint_name IN (
          'ContextAnalysis_nonempty_sources',
          'ProjectLinkSuggestion_nonempty_sources',
          'TaskDraft_nonempty_sources',
          'SourceLinkCorrection_employee_owned',
          'SourceLinkCorrection_nonempty_sources'
        )
      ORDER BY constraint_name
    `;
    expect(constraints).toHaveLength(5);
  });

  it("contains no rating, ranking, productivity, or employee-judgment columns", async () => {
    const forbiddenColumns = await client.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN (
          'ContextAnalysis',
          'ProjectLinkSuggestion',
          'TaskDraft',
          'SourceLinkCorrection'
        )
        AND column_name ~* '(rating|rank|productivity|employee.?judg)'
    `;
    expect(forbiddenColumns).toEqual([]);
  });
});
