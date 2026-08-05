import { afterAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "./index.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

const ownedTables = [
  "ResearchRecord",
  "ResearchRevision",
  "ResearchParticipantEvent",
  "ResearchTransition",
  "ResearchSourceReview",
  "ResearchSourceReviewRevision",
  "ResearchSourceReference",
  "ResearchProposal",
  "ResearchProposalTransition",
  "Experiment",
  "ExperimentMethodRevision",
  "ExperimentMeasure",
  "ExperimentTestCase",
  "ExperimentControl",
  "ExperimentRun",
  "ExperimentObservation",
  "ExperimentConclusion",
  "ResearchConclusion",
  "AppliedLearning",
  "ResearchEvidenceLink",
] as const;

const appendOnlyTables = [
  "ResearchRevision",
  "ResearchParticipantEvent",
  "ResearchTransition",
  "ResearchSourceReviewRevision",
  "ResearchProposalTransition",
  "ExperimentMethodRevision",
  "ExperimentMeasure",
  "ExperimentTestCase",
  "ExperimentControl",
  "ExperimentRun",
  "ExperimentObservation",
  "ExperimentConclusion",
  "ResearchConclusion",
  "AppliedLearning",
  "ResearchEvidenceLink",
] as const;

afterAll(async () => client.$disconnect());

describe("research and experiments schema", () => {
  it("creates the complete bounded schema with required and optional Project scope", async () => {
    const tables = await client.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY(${ownedTables}::text[])
      ORDER BY table_name
    `;
    const tableNames = tables.map(({ table_name }) => table_name);
    expect(new Set(tableNames)).toEqual(new Set(ownedTables));

    const scopeColumns = await client.$queryRaw<
      Array<{ table_name: string; column_name: string; is_nullable: "YES" | "NO" }>
    >`
      SELECT table_name, column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('ResearchRecord', 'ResearchSourceReview', 'Experiment')
        AND column_name IN ('projectId', 'workstreamId', 'workItemId')
      ORDER BY table_name, column_name
    `;
    expect(scopeColumns).toEqual([
      { table_name: "Experiment", column_name: "workItemId", is_nullable: "YES" },
      { table_name: "Experiment", column_name: "workstreamId", is_nullable: "YES" },
      { table_name: "ResearchRecord", column_name: "projectId", is_nullable: "NO" },
      { table_name: "ResearchRecord", column_name: "workItemId", is_nullable: "YES" },
      { table_name: "ResearchRecord", column_name: "workstreamId", is_nullable: "YES" },
      { table_name: "ResearchSourceReview", column_name: "projectId", is_nullable: "NO" },
      { table_name: "ResearchSourceReview", column_name: "workItemId", is_nullable: "YES" },
      { table_name: "ResearchSourceReview", column_name: "workstreamId", is_nullable: "YES" },
    ]);

    const normalizedChildren = await client.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'ExperimentMeasure' AND column_name = 'methodRevisionId')
          OR (table_name = 'ExperimentTestCase' AND column_name = 'methodRevisionId')
          OR (table_name = 'ExperimentControl' AND column_name = 'methodRevisionId')
          OR (table_name = 'ExperimentObservation' AND column_name = 'runId')
        )
      ORDER BY table_name
    `;
    expect(normalizedChildren.map(({ table_name }) => table_name)).toEqual([
      "ExperimentControl",
      "ExperimentMeasure",
      "ExperimentObservation",
      "ExperimentTestCase",
    ]);
  });

  it("enforces identity uniqueness and restrictive foreign keys", async () => {
    const indexes = await client.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'ResearchRevision_researchId_revision_key',
          'ExperimentMethodRevision_experimentId_revision_key',
          'ExperimentRun_experimentId_sequence_key',
          'ResearchSourceReview_owner_project_idempotency_key'
        )
      ORDER BY indexname
    `;
    expect(indexes.map(({ indexname }) => indexname)).toEqual([
      "ExperimentMethodRevision_experimentId_revision_key",
      "ExperimentRun_experimentId_sequence_key",
      "ResearchRevision_researchId_revision_key",
      "ResearchSourceReview_owner_project_idempotency_key",
    ]);

    const scopeIndexes = await client.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'ResearchRecord_projectId_state_createdAt_idx',
          'ResearchRecord_ownerId_state_createdAt_idx',
          'Experiment_researchId_state_createdAt_idx',
          'Experiment_workstreamId_createdAt_idx',
          'Experiment_workItemId_createdAt_idx'
        )
      ORDER BY indexname
    `;
    expect(scopeIndexes.map(({ indexname }) => indexname)).toEqual([
      "Experiment_researchId_state_createdAt_idx",
      "Experiment_workItemId_createdAt_idx",
      "Experiment_workstreamId_createdAt_idx",
      "ResearchRecord_ownerId_state_createdAt_idx",
      "ResearchRecord_projectId_state_createdAt_idx",
    ]);

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

  it("protects immutable history and excludes performance or progress-volume columns", async () => {
    const triggerEvents = await client.$queryRaw<
      Array<{ table_name: string; manipulation: string }>
    >`
      SELECT event_object_table AS table_name, event_manipulation AS manipulation
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

    const forbiddenColumns = await client.$queryRaw<
      Array<{ table_name: string; column_name: string }>
    >`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY(${ownedTables}::text[])
        AND (
          lower(column_name) IN (
            'rating',
            'suggestedrating',
            'predictedrating',
            'recommendedrating',
            'rank',
            'productivityscore',
            'performancescore',
            'readinessscore',
            'readinesspercent',
            'progresspercent',
            'experimentcount',
            'researchcount',
            'sourcecount',
            'runcount',
            'activitycount'
          )
          OR lower(column_name) ~ '(rating|rank|productivity|performance|readiness|progress).*(score|percent|count|volume)$'
        )
    `;
    expect(forbiddenColumns).toEqual([]);
  });

  it.each(["UPDATE", "DELETE"] as const)(
    "rejects %s attempts against append-only Research revisions",
    async (operation) => {
      await expect(
        client.$transaction(async (transaction) => {
          const organizationId = crypto.randomUUID();
          const departmentId = crypto.randomUUID();
          const ownerId = crypto.randomUUID();
          const scopeId = crypto.randomUUID();
          const projectId = crypto.randomUUID();
          const researchId = crypto.randomUUID();
          const revisionId = crypto.randomUUID();
          const uniqueKey = crypto.randomUUID();

          await transaction.$executeRaw`
            INSERT INTO "Organization" ("id", "key", "name", "updatedAt")
            VALUES (${organizationId}::uuid, ${`research-test-${uniqueKey}`}, 'Research test', CURRENT_TIMESTAMP)
          `;
          await transaction.$executeRaw`
            INSERT INTO "User" ("id", "email", "displayName", "updatedAt")
            VALUES (${ownerId}::uuid, ${`research-${uniqueKey}@example.test`}, 'Research owner', CURRENT_TIMESTAMP)
          `;
          await transaction.$executeRaw`
            INSERT INTO "Department" ("id", "key", "name", "organizationId", "updatedAt")
            VALUES (
              ${departmentId}::uuid,
              ${`research-department-${uniqueKey}`},
              'Research department',
              ${organizationId}::uuid,
              CURRENT_TIMESTAMP
            )
          `;
          await transaction.$executeRaw`
            INSERT INTO "AuthorizationScope" (
              "id", "key", "scopeType", "departmentId", "updatedAt"
            ) VALUES (
              ${scopeId}::uuid,
              ${`research-scope-${uniqueKey}`},
              'project',
              ${departmentId}::uuid,
              CURRENT_TIMESTAMP
            )
          `;
          await transaction.$executeRaw`
            INSERT INTO "Project" (
              "id", "organizationId", "departmentId", "authorizationScopeId",
              "authorizationScopeType", "name", "description", "createdById", "updatedAt"
            ) VALUES (
              ${projectId}::uuid,
              ${organizationId}::uuid,
              ${departmentId}::uuid,
              ${scopeId}::uuid,
              'project',
              'Research project',
              'Append-only verification fixture',
              ${ownerId}::uuid,
              CURRENT_TIMESTAMP
            )
          `;
          await transaction.$executeRaw`
            INSERT INTO "ResearchRecord" (
              "id", "idempotencyKey", "projectId", "ownerId"
            ) VALUES (
              ${researchId}::uuid,
              ${crypto.randomUUID()}::uuid,
              ${projectId}::uuid,
              ${ownerId}::uuid
            )
          `;
          await transaction.$executeRaw`
            INSERT INTO "ResearchRevision" (
              "id", "researchId", "revision", "origin", "problemStatement", "context",
              "question", "objective", "hypothesisKind", "hypothesisStatement", "assumptions",
              "constraints", "knownUncertainty", "alternatives", "decisionQuestion",
              "sourceReferences", "executionMode", "authorId"
            ) VALUES (
              ${revisionId}::uuid,
              ${researchId}::uuid,
              1,
              'EMPLOYEE',
              'Problem',
              'Context',
              'Question',
              'Objective',
              'TESTABLE',
              'Hypothesis',
              '[]'::jsonb,
              '[]'::jsonb,
              '[]'::jsonb,
              '[]'::jsonb,
              'Decision question',
              '[]'::jsonb,
              'manual',
              ${ownerId}::uuid
            )
          `;

          if (operation === "UPDATE") {
            await transaction.$executeRaw`
              UPDATE "ResearchRevision" SET "question" = 'Changed' WHERE "id" = ${revisionId}::uuid
            `;
          } else {
            await transaction.$executeRaw`
              DELETE FROM "ResearchRevision" WHERE "id" = ${revisionId}::uuid
            `;
          }
        }),
      ).rejects.toThrow(/history is append-only/iu);
    },
  );
});
