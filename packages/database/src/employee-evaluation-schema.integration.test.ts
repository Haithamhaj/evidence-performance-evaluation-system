import { afterAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "./index.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const forbiddenRatingColumn = ["suggested", "Rating"].join("");

const ownedTables = [
  "EvaluationTemplate",
  "EvaluationTemplateVersion",
  "EvaluationTemplateItem",
  "EvaluationTemplateItemLocale",
  "EmployeeEvaluationCycle",
  "EmployeeEvaluationCycleSnapshot",
  "EvaluationAssignment",
  "EvaluationEligibilityDecision",
  "EmployeeEvaluationCycleTransition",
  "Assessment",
  "AssessmentRevision",
  "AssessmentSubmission",
  "EvaluationDiscussionEntry",
  "FinalEvaluationDecision",
  "FinalEvaluationSnapshot",
  "EvaluationAcknowledgment",
] as const;

afterAll(async () => client.$disconnect());

describe("employee evaluation schema", () => {
  it("creates the forward-only template, cycle, assessment, and finalization records", async () => {
    const tables = await client.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY(${ownedTables}::text[])
      ORDER BY table_name
    `;
    const tableNames = tables.map(({ table_name }) => table_name);

    expect(tableNames).toEqual(expect.arrayContaining([...ownedTables]));

    const columns = await client.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY(${ownedTables}::text[])
    `;
    const columnNames = columns.map(({ column_name }) => column_name);
    expect(columnNames).not.toContain(forbiddenRatingColumn);
  });

  it("enforces stable identities and one assessment submission per assignment and kind", async () => {
    const indexes = await client.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'EvaluationTemplateItem_versionId_stableCriterionId_key',
          'EvaluationAssignment_cycleId_employeeId_key',
          'Assessment_assignmentId_kind_key',
          'AssessmentSubmission_assignmentId_kind_key',
          'AssessmentRevision_assessmentId_revision_key',
          'EmployeeEvaluationCycleTransition_cycleId_resultingVersion_key'
        )
      ORDER BY indexname
    `;
    expect(indexes.map(({ indexname }) => indexname)).toEqual([
      "AssessmentRevision_assessmentId_revision_key",
      "AssessmentSubmission_assignmentId_kind_key",
      "Assessment_assignmentId_kind_key",
      "EmployeeEvaluationCycleTransition_cycleId_resultingVersion_key",
      "EvaluationAssignment_cycleId_employeeId_key",
      "EvaluationTemplateItem_versionId_stableCriterionId_key",
    ]);
  });

  it("requires a versioned immutable report context on every final snapshot", async () => {
    const columns = await client.$queryRaw<
      Array<{
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
      }>
    >`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'FinalEvaluationSnapshot'
        AND column_name IN ('reportSnapshot', 'schemaVersion')
      ORDER BY column_name
    `;

    expect(columns).toEqual([
      {
        column_name: "reportSnapshot",
        data_type: "jsonb",
        is_nullable: "NO",
        column_default: null,
      },
      {
        column_name: "schemaVersion",
        data_type: "integer",
        is_nullable: "NO",
        column_default: "2",
      },
    ]);
  });

  it("keeps all historical references restrictive", async () => {
    const foreignKeys = await client.$queryRaw<Array<{ delete_rule: string }>>`
      SELECT rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_schema = tc.constraint_schema
       AND rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_schema = 'public'
        AND tc.table_name = ANY(${ownedTables}::text[])
    `;
    expect(foreignKeys.length).toBeGreaterThan(0);
    expect(foreignKeys.every(({ delete_rule }) => delete_rule === "RESTRICT")).toBe(true);
  });

  it("protects active template versions and immutable completed records", async () => {
    const protectedTables = [
      "EvaluationTemplateVersion",
      "AssessmentSubmission",
      "FinalEvaluationSnapshot",
      "EvaluationAcknowledgment",
    ];
    const triggerEvents = await client.$queryRaw<
      Array<{ table_name: string; manipulation: string }>
    >`
      SELECT event_object_table AS table_name, event_manipulation AS manipulation
      FROM information_schema.triggers
      WHERE event_object_schema = 'public'
        AND event_object_table = ANY(${protectedTables}::text[])
        AND event_manipulation IN ('UPDATE', 'DELETE')
      ORDER BY event_object_table, event_manipulation
    `;

    for (const table of protectedTables) {
      expect(
        triggerEvents
          .filter(({ table_name }) => table_name === table)
          .map(({ manipulation }) => manipulation),
      ).toEqual(["DELETE", "UPDATE"]);
    }
  });
});
