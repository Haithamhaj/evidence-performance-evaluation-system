import { afterAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "./index.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

const ownedTables = [
  "ManagerEvaluationTemplate",
  "ManagerEvaluationTemplateVersion",
  "ManagerEvaluationCriterion",
  "ManagerEvaluationVisibilityPolicy",
  "ManagerEvaluationCycle",
  "ManagerEvaluationCycleSnapshot",
  "ManagerEvaluatorEligibility",
  "ManagerEvaluatorEligibilityDecision",
  "ManagerEvaluationCycleTransition",
  "ManagerEvaluationResponse",
  "ManagerCriterionResponse",
  "ManagerEvaluationSummaryRevision",
  "ManagerEvaluationSummarySource",
  "ManagerEvaluationPrivateIdentityLink",
] as const;

const appendOnlyTables = [
  "ManagerEvaluationCriterion",
  "ManagerEvaluationCycleSnapshot",
  "ManagerEvaluatorEligibilityDecision",
  "ManagerEvaluationCycleTransition",
  "ManagerEvaluationResponse",
  "ManagerCriterionResponse",
  "ManagerEvaluationSummaryRevision",
  "ManagerEvaluationSummarySource",
  "ManagerEvaluationPrivateIdentityLink",
] as const;

afterAll(async () => client.$disconnect());

describe("manager evaluation schema", () => {
  it("creates the bounded template, cycle, eligibility, response, summary, and future-mode records", async () => {
    const tables = await client.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY(${ownedTables}::text[])
      ORDER BY table_name
    `;

    expect(tables.map(({ table_name }) => table_name)).toEqual(
      expect.arrayContaining([...ownedTables]),
    );
  });

  it("freezes the pilot to IDENTIFIED while retaining disabled future policy contracts", async () => {
    const enumValues = await client.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel
      FROM pg_enum
      JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
      WHERE pg_type.typname = 'ManagerEvaluationVisibilityMode'
      ORDER BY enumsortorder
    `;
    expect(enumValues.map(({ enumlabel }) => enumlabel)).toEqual([
      "IDENTIFIED",
      "MANAGER_BLINDED",
      "ANONYMOUS_AGGREGATED",
    ]);

    const constraints = await client.$queryRaw<Array<{ definition: string }>>`
      SELECT pg_get_constraintdef(pg_constraint.oid) AS definition
      FROM pg_constraint
      JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
      WHERE pg_class.relname IN (
        'ManagerEvaluationVisibilityPolicy',
        'ManagerEvaluationCycle',
        'ManagerEvaluationCycleSnapshot',
        'ManagerEvaluationPrivateIdentityLink'
      )
        AND pg_constraint.contype = 'c'
    `;
    const definitions = constraints.map(({ definition }) => definition).join("\n");
    expect(definitions).toContain("IDENTIFIED");
    expect(definitions).toContain("MANAGER_BLINDED");
    expect(definitions).toContain("ANONYMOUS_AGGREGATED");
    expect(definitions).toContain("enabled");
  });

  it("enforces one immutable identified response and exactly five criterion responses", async () => {
    const responseIndexes = await client.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'ManagerEvaluationResponse_cycleId_evaluatorId_key',
          'ManagerCriterionResponse_responseId_criterionId_key',
          'ManagerCriterionResponse_responseId_position_key'
        )
      ORDER BY indexname
    `;
    expect(responseIndexes.map(({ indexname }) => indexname)).toEqual([
      "ManagerCriterionResponse_responseId_criterionId_key",
      "ManagerCriterionResponse_responseId_position_key",
      "ManagerEvaluationResponse_cycleId_evaluatorId_key",
    ]);

    const triggerEvents = await client.$queryRaw<
      Array<{ table_name: string; manipulation: string }>
    >`
      SELECT DISTINCT event_object_table AS table_name, event_manipulation AS manipulation
      FROM information_schema.triggers
      WHERE event_object_schema = 'public'
        AND event_object_table = ANY(${appendOnlyTables}::text[])
        AND event_manipulation IN ('UPDATE', 'DELETE')
      ORDER BY event_object_table, event_manipulation
    `;
    for (const table of appendOnlyTables) {
      expect(
        triggerEvents
          .filter(({ table_name }) => table_name === table)
          .map(({ manipulation }) => manipulation),
      ).toEqual(["DELETE", "UPDATE"]);
    }

    const exactCountTriggers = await client.$queryRaw<Array<{ trigger_name: string }>>`
      SELECT DISTINCT trigger_name
      FROM information_schema.triggers
      WHERE event_object_schema = 'public'
        AND trigger_name IN (
          'ManagerEvaluationTemplateVersion_exact_five_criteria',
          'ManagerEvaluationResponse_exact_five_criteria',
          'ManagerCriterionResponse_exact_five_criteria'
        )
      ORDER BY trigger_name
    `;
    expect(exactCountTriggers.map(({ trigger_name }) => trigger_name)).toEqual([
      "ManagerCriterionResponse_exact_five_criteria",
      "ManagerEvaluationResponse_exact_five_criteria",
      "ManagerEvaluationTemplateVersion_exact_five_criteria",
    ]);
  });

  it("keeps every historical reference restrictive", async () => {
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
});
