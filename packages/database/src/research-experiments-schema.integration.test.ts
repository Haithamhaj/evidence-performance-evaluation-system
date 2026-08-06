import { afterAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "./index.js";

type DatabaseTransaction = import("./index.js").DatabaseTransaction;

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
  "ExperimentAiDraft",
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
  "ExperimentAiDraft",
  "ExperimentConclusion",
  "ResearchConclusion",
  "AppliedLearning",
  "ResearchEvidenceLink",
  "ResearchSourceReference",
] as const;

afterAll(async () => client.$disconnect());

async function createProjectFixture(transaction: DatabaseTransaction) {
  const organizationId = crypto.randomUUID();
  const departmentId = crypto.randomUUID();
  const ownerId = crypto.randomUUID();
  const scopeId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
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
      'Research schema verification fixture',
      ${ownerId}::uuid,
      CURRENT_TIMESTAMP
    )
  `;

  return { ownerId, projectId };
}

async function createResearchFixture(
  transaction: DatabaseTransaction,
  fixture: { ownerId: string; projectId: string },
) {
  const researchId = crypto.randomUUID();
  await transaction.$executeRaw`
    INSERT INTO "ResearchRecord" ("id", "idempotencyKey", "projectId", "ownerId")
    VALUES (
      ${researchId}::uuid,
      ${crypto.randomUUID()}::uuid,
      ${fixture.projectId}::uuid,
      ${fixture.ownerId}::uuid
    )
  `;
  return researchId;
}

async function createExperimentFixture(transaction: DatabaseTransaction, researchId: string) {
  const experimentId = crypto.randomUUID();
  await transaction.$executeRaw`
    INSERT INTO "Experiment" ("id", "researchId", "idempotencyKey", "title")
    VALUES (
      ${experimentId}::uuid,
      ${researchId}::uuid,
      ${crypto.randomUUID()}::uuid,
      'Experiment fixture'
    )
  `;
  return experimentId;
}

async function createMethodFixture(
  transaction: DatabaseTransaction,
  input: { experimentId: string; authorId: string; revision?: number },
) {
  const methodRevisionId = crypto.randomUUID();
  await transaction.$executeRaw`
    INSERT INTO "ExperimentMethodRevision" (
      "id", "experimentId", "revision", "question", "baselineDescription",
      "conditions", "reproducibilityInstructions", "knownRisks", "failureCases",
      "sourceReferences", "executionMode", "origin", "authorId"
    ) VALUES (
      ${methodRevisionId}::uuid,
      ${input.experimentId}::uuid,
      ${input.revision ?? 1},
      'Method question',
      'Method baseline',
      '["condition"]'::jsonb,
      'Repeat the method',
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      'manual',
      'EMPLOYEE',
      ${input.authorId}::uuid
    )
  `;
  return methodRevisionId;
}

async function createRunFixture(
  transaction: DatabaseTransaction,
  input: {
    experimentId: string;
    methodRevisionId: string;
    executorId: string;
    sequence?: number;
  },
) {
  const runId = crypto.randomUUID();
  await transaction.$executeRaw`
    INSERT INTO "ExperimentRun" (
      "id", "experimentId", "methodRevisionId", "sequence", "executorId",
      "startedAt", "completedAt", "resultStatus", "environment", "inputs",
      "modelConfigurations", "unexpectedConditions", "executionNotes", "sourceReferences"
    ) VALUES (
      ${runId}::uuid,
      ${input.experimentId}::uuid,
      ${input.methodRevisionId}::uuid,
      ${input.sequence ?? 1},
      ${input.executorId}::uuid,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      'COMPLETED',
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      'Execution notes',
      '[]'::jsonb
    )
  `;
  return runId;
}

async function createEvidenceFixture(
  transaction: DatabaseTransaction,
  fixture: { ownerId: string; projectId: string },
) {
  const evidenceId = crypto.randomUUID();
  const evidenceRevisionId = crypto.randomUUID();
  await transaction.$executeRaw`
    INSERT INTO "EvidenceRecord" (
      "id", "idempotencyKey", "projectId", "employeeId", "updatedAt"
    ) VALUES (
      ${evidenceId}::uuid,
      ${crypto.randomUUID()}::uuid,
      ${fixture.projectId}::uuid,
      ${fixture.ownerId}::uuid,
      CURRENT_TIMESTAMP
    )
  `;
  await transaction.$executeRaw`
    INSERT INTO "EvidenceRevision" (
      "id", "evidenceId", "revision", "revisionKind", "sourceKind", "sourceText",
      "supportedClaim", "contributionContext", "executionMode", "createdById"
    ) VALUES (
      ${evidenceRevisionId}::uuid,
      ${evidenceId}::uuid,
      1,
      'manual_draft',
      'pasted_text',
      'Evidence source',
      'Supported claim',
      'Evidence context',
      'manual',
      ${fixture.ownerId}::uuid
    )
  `;
  return { evidenceId, evidenceRevisionId };
}

describe("research and experiments schema", () => {
  it("creates the complete bounded schema with required and optional Project scope", async () => {
    const tables = await client.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (
          table_name LIKE 'Research%'
          OR table_name LIKE 'Experiment%'
          OR table_name = 'AppliedLearning'
        )
      ORDER BY table_name
    `;
    const tableNames = tables.map(({ table_name }) => table_name);
    expect(new Set(tableNames)).toEqual(new Set(ownedTables));
    expect(tableNames).not.toContain("ExperimentTransition");

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

  it("keeps PostgreSQL lifecycle enum labels aligned with the Task 1 contracts", async () => {
    const labels = await client.$queryRaw<Array<{ enum_name: string; enum_label: string }>>`
      SELECT type.typname AS enum_name, value.enumlabel AS enum_label
      FROM pg_type type
      JOIN pg_enum value ON value.enumtypid = type.oid
      JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
      WHERE namespace.nspname = 'public'
        AND type.typname IN (
          'ResearchState',
          'ExperimentState',
          'ResearchSourceReviewState'
        )
      ORDER BY type.typname, value.enumsortorder
    `;
    expect(labels).toEqual([
      { enum_name: "ExperimentState", enum_label: "DRAFT" },
      { enum_name: "ExperimentState", enum_label: "READY" },
      { enum_name: "ExperimentState", enum_label: "RUNNING" },
      { enum_name: "ExperimentState", enum_label: "RESULT_RECORDED" },
      { enum_name: "ExperimentState", enum_label: "CONCLUDED" },
      { enum_name: "ExperimentState", enum_label: "ABANDONED" },
      { enum_name: "ExperimentState", enum_label: "SUPERSEDED" },
      { enum_name: "ResearchSourceReviewState", enum_label: "PENDING_RETRIEVAL" },
      { enum_name: "ResearchSourceReviewState", enum_label: "READY_FOR_REVIEW" },
      { enum_name: "ResearchSourceReviewState", enum_label: "PARTIAL" },
      { enum_name: "ResearchSourceReviewState", enum_label: "BLOCKED" },
      { enum_name: "ResearchSourceReviewState", enum_label: "CONFIRMED" },
      { enum_name: "ResearchSourceReviewState", enum_label: "DISMISSED" },
      { enum_name: "ResearchSourceReviewState", enum_label: "STALE" },
      { enum_name: "ResearchState", enum_label: "DRAFT" },
      { enum_name: "ResearchState", enum_label: "ACTIVE" },
      { enum_name: "ResearchState", enum_label: "CONCLUDED" },
      { enum_name: "ResearchState", enum_label: "CANCELLED" },
      { enum_name: "ResearchState", enum_label: "SUPERSEDED" },
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

  it("rejects a run whose method belongs to another Experiment", async () => {
    await expect(
      client.$transaction(async (transaction) => {
        const project = await createProjectFixture(transaction);
        const researchId = await createResearchFixture(transaction, project);
        const firstExperimentId = await createExperimentFixture(transaction, researchId);
        const secondExperimentId = await createExperimentFixture(transaction, researchId);
        const firstMethodId = await createMethodFixture(transaction, {
          experimentId: firstExperimentId,
          authorId: project.ownerId,
        });
        await createRunFixture(transaction, {
          experimentId: secondExperimentId,
          methodRevisionId: firstMethodId,
          executorId: project.ownerId,
        });
      }),
    ).rejects.toThrow(/foreign key constraint/iu);
  });

  it("rejects observations whose measure or test case belongs to another method", async () => {
    await expect(
      client.$transaction(async (transaction) => {
        const project = await createProjectFixture(transaction);
        const researchId = await createResearchFixture(transaction, project);
        const experimentId = await createExperimentFixture(transaction, researchId);
        const firstMethodId = await createMethodFixture(transaction, {
          experimentId,
          authorId: project.ownerId,
        });
        const secondMethodId = await createMethodFixture(transaction, {
          experimentId,
          authorId: project.ownerId,
          revision: 2,
        });
        const runId = await createRunFixture(transaction, {
          experimentId,
          methodRevisionId: firstMethodId,
          executorId: project.ownerId,
        });
        const measureId = crypto.randomUUID();
        const testCaseId = crypto.randomUUID();
        await transaction.$executeRaw`
          INSERT INTO "ExperimentMeasure" (
            "id", "methodRevisionId", "stableId", "name", "kind", "direction",
            "interpretationRule"
          ) VALUES (
            ${measureId}::uuid,
            ${secondMethodId}::uuid,
            'quality',
            'Quality',
            'QUALITATIVE',
            'DESCRIPTIVE',
            'Describe the result'
          )
        `;
        await transaction.$executeRaw`
          INSERT INTO "ExperimentTestCase" (
            "id", "methodRevisionId", "inputIdentity", "category", "inclusionReason"
          ) VALUES (
            ${testCaseId}::uuid,
            ${secondMethodId}::uuid,
            'Sample',
            'Boundary',
            'Covers the boundary'
          )
        `;
        await transaction.$executeRaw`
          INSERT INTO "ExperimentObservation" (
            "id", "runId", "measureId", "testCaseId", "observedValue"
          ) VALUES (
            ${crypto.randomUUID()}::uuid,
            ${runId}::uuid,
            ${measureId}::uuid,
            ${testCaseId}::uuid,
            'Observed'
          )
        `;
      }),
    ).rejects.toThrow(/foreign key constraint/iu);
  });

  it("rejects an observation that supersedes an observation from another run", async () => {
    await expect(
      client.$transaction(async (transaction) => {
        const project = await createProjectFixture(transaction);
        const researchId = await createResearchFixture(transaction, project);
        const experimentId = await createExperimentFixture(transaction, researchId);
        const methodId = await createMethodFixture(transaction, {
          experimentId,
          authorId: project.ownerId,
        });
        const firstRunId = await createRunFixture(transaction, {
          experimentId,
          methodRevisionId: methodId,
          executorId: project.ownerId,
        });
        const secondRunId = await createRunFixture(transaction, {
          experimentId,
          methodRevisionId: methodId,
          executorId: project.ownerId,
          sequence: 2,
        });
        const measureId = crypto.randomUUID();
        const firstObservationId = crypto.randomUUID();
        await transaction.$executeRaw`
          INSERT INTO "ExperimentMeasure" (
            "id", "methodRevisionId", "stableId", "name", "kind", "direction",
            "interpretationRule"
          ) VALUES (
            ${measureId}::uuid,
            ${methodId}::uuid,
            'quality',
            'Quality',
            'QUALITATIVE',
            'DESCRIPTIVE',
            'Describe the result'
          )
        `;
        await transaction.$executeRaw`
          INSERT INTO "ExperimentObservation" (
            "id", "runId", "measureId", "observedValue"
          ) VALUES (
            ${firstObservationId}::uuid,
            ${firstRunId}::uuid,
            ${measureId}::uuid,
            'Original'
          )
        `;
        await transaction.$executeRaw`
          INSERT INTO "ExperimentObservation" (
            "id", "runId", "measureId", "observedValue", "supersedesObservationId",
            "correctionReason"
          ) VALUES (
            ${crypto.randomUUID()}::uuid,
            ${secondRunId}::uuid,
            ${measureId}::uuid,
            'Correction',
            ${firstObservationId}::uuid,
            'Corrected input'
          )
        `;
      }),
    ).rejects.toThrow(/foreign key constraint/iu);
  });

  it("rejects Applied Learning linked to a conclusion from another Research Record", async () => {
    await expect(
      client.$transaction(async (transaction) => {
        const project = await createProjectFixture(transaction);
        const firstResearchId = await createResearchFixture(transaction, project);
        const secondResearchId = await createResearchFixture(transaction, project);
        const conclusionId = crypto.randomUUID();
        await transaction.$executeRaw`
          INSERT INTO "ResearchConclusion" (
            "id", "researchId", "synthesis", "answer", "remainingUncertainty",
            "decision", "rationale", "nextAction", "sourceReferences", "experimentIds",
            "confirmerId", "confirmedAt"
          ) VALUES (
            ${conclusionId}::uuid,
            ${secondResearchId}::uuid,
            'Synthesis',
            'Answer',
            '[]'::jsonb,
            'ADOPT',
            'Rationale',
            'Next action',
            '["source"]'::jsonb,
            '[]'::jsonb,
            ${project.ownerId}::uuid,
            CURRENT_TIMESTAMP
          )
        `;
        await transaction.$executeRaw`
          INSERT INTO "AppliedLearning" (
            "id", "researchId", "researchConclusionId", "targetKind", "targetId",
            "targetResearchId", "whatChanged", "causalRationale", "confirmerId", "confirmedAt"
          ) VALUES (
            ${crypto.randomUUID()}::uuid,
            ${firstResearchId}::uuid,
            ${conclusionId}::uuid,
            'RESEARCH',
            ${firstResearchId}::uuid,
            ${firstResearchId}::uuid,
            'Changed the approach',
            'The conclusion caused the change',
            ${project.ownerId}::uuid,
            CURRENT_TIMESTAMP
          )
        `;
      }),
    ).rejects.toThrow(/foreign key constraint/iu);
  });

  it("rejects Applied Learning whose Experiment target belongs to another Project", async () => {
    await expect(
      client.$transaction(async (transaction) => {
        const sourceProject = await createProjectFixture(transaction);
        const targetProject = await createProjectFixture(transaction);
        const sourceResearchId = await createResearchFixture(transaction, sourceProject);
        const targetResearchId = await createResearchFixture(transaction, targetProject);
        const targetExperimentId = await createExperimentFixture(transaction, targetResearchId);
        const conclusionId = crypto.randomUUID();
        await transaction.$executeRaw`
          INSERT INTO "ResearchConclusion" (
            "id", "researchId", "synthesis", "answer", "remainingUncertainty",
            "decision", "rationale", "nextAction", "sourceReferences", "experimentIds",
            "confirmerId", "confirmedAt"
          ) VALUES (
            ${conclusionId}::uuid,
            ${sourceResearchId}::uuid,
            'Synthesis',
            'Answer',
            '[]'::jsonb,
            'ADOPT',
            'Rationale',
            'Next action',
            '["source"]'::jsonb,
            '[]'::jsonb,
            ${sourceProject.ownerId}::uuid,
            CURRENT_TIMESTAMP
          )
        `;
        await transaction.$executeRaw`
          INSERT INTO "AppliedLearning" (
            "id", "researchId", "researchConclusionId", "targetKind", "targetId",
            "targetExperimentId", "whatChanged", "causalRationale", "confirmerId",
            "confirmedAt"
          ) VALUES (
            ${crypto.randomUUID()}::uuid,
            ${sourceResearchId}::uuid,
            ${conclusionId}::uuid,
            'EXPERIMENT',
            ${targetExperimentId}::uuid,
            ${targetExperimentId}::uuid,
            'Changed the Experiment',
            'The conclusion caused the change',
            ${sourceProject.ownerId}::uuid,
            CURRENT_TIMESTAMP
          )
        `;
      }),
    ).rejects.toThrow(/foreign key constraint/iu);
  });

  it("rejects a Research Evidence link whose Evidence belongs to another Project", async () => {
    await expect(
      client.$transaction(async (transaction) => {
        const firstProject = await createProjectFixture(transaction);
        const secondProject = await createProjectFixture(transaction);
        const researchId = await createResearchFixture(transaction, firstProject);
        const evidence = await createEvidenceFixture(transaction, secondProject);
        await transaction.$executeRaw`
          INSERT INTO "ResearchEvidenceLink" (
            "id", "researchId", "evidenceId", "evidenceRevisionId", "supportedClaim",
            "confirmerId", "confirmedAt"
          ) VALUES (
            ${crypto.randomUUID()}::uuid,
            ${researchId}::uuid,
            ${evidence.evidenceId}::uuid,
            ${evidence.evidenceRevisionId}::uuid,
            'Cross-project claim',
            ${firstProject.ownerId}::uuid,
            CURRENT_TIMESTAMP
          )
        `;
      }),
    ).rejects.toThrow(/foreign key constraint/iu);
  });

  it("rejects Research Evidence Experiment links from another Research Record", async () => {
    await expect(
      client.$transaction(async (transaction) => {
        const project = await createProjectFixture(transaction);
        const firstResearchId = await createResearchFixture(transaction, project);
        const secondResearchId = await createResearchFixture(transaction, project);
        const secondExperimentId = await createExperimentFixture(transaction, secondResearchId);
        const evidence = await createEvidenceFixture(transaction, project);
        await transaction.$executeRaw`
          INSERT INTO "ResearchEvidenceLink" (
            "id", "researchId", "evidenceId", "evidenceRevisionId", "supportedClaim",
            "experimentId", "confirmerId", "confirmedAt"
          ) VALUES (
            ${crypto.randomUUID()}::uuid,
            ${firstResearchId}::uuid,
            ${evidence.evidenceId}::uuid,
            ${evidence.evidenceRevisionId}::uuid,
            'Cross-research Experiment claim',
            ${secondExperimentId}::uuid,
            ${project.ownerId}::uuid,
            CURRENT_TIMESTAMP
          )
        `;
      }),
    ).rejects.toThrow(/foreign key constraint/iu);
  });

  it("rejects Research Evidence run and conclusion links from another Experiment", async () => {
    await expect(
      client.$transaction(async (transaction) => {
        const project = await createProjectFixture(transaction);
        const researchId = await createResearchFixture(transaction, project);
        const firstExperimentId = await createExperimentFixture(transaction, researchId);
        const secondExperimentId = await createExperimentFixture(transaction, researchId);
        const secondMethodId = await createMethodFixture(transaction, {
          experimentId: secondExperimentId,
          authorId: project.ownerId,
        });
        const secondRunId = await createRunFixture(transaction, {
          experimentId: secondExperimentId,
          methodRevisionId: secondMethodId,
          executorId: project.ownerId,
        });
        const secondConclusionId = crypto.randomUUID();
        await transaction.$executeRaw`
          INSERT INTO "ExperimentConclusion" (
            "id", "experimentId", "outcome", "summary", "runIds", "measureStableIds",
            "limitations", "confidenceDescription", "decisionRelevance", "nextStep",
            "confirmerId", "confirmedAt"
          ) VALUES (
            ${secondConclusionId}::uuid,
            ${secondExperimentId}::uuid,
            'SUPPORTED',
            'Summary',
            ${JSON.stringify([secondRunId])}::jsonb,
            '["quality"]'::jsonb,
            '[]'::jsonb,
            'Human confidence description',
            'Relevant to the decision',
            'Next step',
            ${project.ownerId}::uuid,
            CURRENT_TIMESTAMP
          )
        `;
        const evidence = await createEvidenceFixture(transaction, project);
        await transaction.$executeRaw`
          INSERT INTO "ResearchEvidenceLink" (
            "id", "researchId", "evidenceId", "evidenceRevisionId", "supportedClaim",
            "experimentId", "experimentRunId", "experimentConclusionId", "confirmerId",
            "confirmedAt"
          ) VALUES (
            ${crypto.randomUUID()}::uuid,
            ${researchId}::uuid,
            ${evidence.evidenceId}::uuid,
            ${evidence.evidenceRevisionId}::uuid,
            'Cross-Experiment run and conclusion claim',
            ${firstExperimentId}::uuid,
            ${secondRunId}::uuid,
            ${secondConclusionId}::uuid,
            ${project.ownerId}::uuid,
            CURRENT_TIMESTAMP
          )
        `;
      }),
    ).rejects.toThrow(/foreign key constraint/iu);
  });

  it("accepts same-lineage Experiment history, Evidence links, and Applied Learning", async () => {
    await expect(
      client.$transaction(async (transaction) => {
        const project = await createProjectFixture(transaction);
        const researchId = await createResearchFixture(transaction, project);
        const experimentId = await createExperimentFixture(transaction, researchId);
        const methodId = await createMethodFixture(transaction, {
          experimentId,
          authorId: project.ownerId,
        });
        const runId = await createRunFixture(transaction, {
          experimentId,
          methodRevisionId: methodId,
          executorId: project.ownerId,
        });
        const measureId = crypto.randomUUID();
        const testCaseId = crypto.randomUUID();
        await transaction.$executeRaw`
          INSERT INTO "ExperimentMeasure" (
            "id", "methodRevisionId", "stableId", "name", "kind", "direction",
            "interpretationRule"
          ) VALUES (
            ${measureId}::uuid,
            ${methodId}::uuid,
            'quality',
            'Quality',
            'QUALITATIVE',
            'DESCRIPTIVE',
            'Describe the result'
          )
        `;
        await transaction.$executeRaw`
          INSERT INTO "ExperimentTestCase" (
            "id", "methodRevisionId", "inputIdentity", "category", "inclusionReason"
          ) VALUES (
            ${testCaseId}::uuid,
            ${methodId}::uuid,
            'Sample',
            'Boundary',
            'Covers the boundary'
          )
        `;
        await transaction.$executeRaw`
          INSERT INTO "ExperimentObservation" (
            "id", "runId", "measureId", "testCaseId", "observedValue"
          ) VALUES (
            ${crypto.randomUUID()}::uuid,
            ${runId}::uuid,
            ${measureId}::uuid,
            ${testCaseId}::uuid,
            'Observed'
          )
        `;

        const experimentConclusionId = crypto.randomUUID();
        await transaction.$executeRaw`
          INSERT INTO "ExperimentConclusion" (
            "id", "experimentId", "outcome", "summary", "runIds", "measureStableIds",
            "limitations", "confidenceDescription", "decisionRelevance", "nextStep",
            "confirmerId", "confirmedAt"
          ) VALUES (
            ${experimentConclusionId}::uuid,
            ${experimentId}::uuid,
            'SUPPORTED',
            'Summary',
            ${JSON.stringify([runId])}::jsonb,
            '["quality"]'::jsonb,
            '[]'::jsonb,
            'Human confidence description',
            'Relevant to the decision',
            'Next step',
            ${project.ownerId}::uuid,
            CURRENT_TIMESTAMP
          )
        `;
        const evidence = await createEvidenceFixture(transaction, project);
        await transaction.$executeRaw`
          INSERT INTO "ResearchEvidenceLink" (
            "id", "researchId", "evidenceId", "evidenceRevisionId", "supportedClaim",
            "experimentId", "experimentRunId", "experimentConclusionId", "confirmerId",
            "confirmedAt"
          ) VALUES (
            ${crypto.randomUUID()}::uuid,
            ${researchId}::uuid,
            ${evidence.evidenceId}::uuid,
            ${evidence.evidenceRevisionId}::uuid,
            'Same-lineage claim',
            ${experimentId}::uuid,
            ${runId}::uuid,
            ${experimentConclusionId}::uuid,
            ${project.ownerId}::uuid,
            CURRENT_TIMESTAMP
          )
        `;

        const researchConclusionId = crypto.randomUUID();
        await transaction.$executeRaw`
          INSERT INTO "ResearchConclusion" (
            "id", "researchId", "synthesis", "answer", "remainingUncertainty",
            "decision", "rationale", "nextAction", "sourceReferences", "experimentIds",
            "confirmerId", "confirmedAt"
          ) VALUES (
            ${researchConclusionId}::uuid,
            ${researchId}::uuid,
            'Synthesis',
            'Answer',
            '[]'::jsonb,
            'ADOPT',
            'Rationale',
            'Next action',
            '["source"]'::jsonb,
            ${JSON.stringify([experimentId])}::jsonb,
            ${project.ownerId}::uuid,
            CURRENT_TIMESTAMP
          )
        `;
        await transaction.$executeRaw`
          INSERT INTO "AppliedLearning" (
            "id", "researchId", "researchConclusionId", "targetKind", "targetId",
            "targetResearchId", "whatChanged", "causalRationale", "confirmerId", "confirmedAt"
          ) VALUES (
            ${crypto.randomUUID()}::uuid,
            ${researchId}::uuid,
            ${researchConclusionId}::uuid,
            'RESEARCH',
            ${researchId}::uuid,
            ${researchId}::uuid,
            'Changed the approach',
            'The conclusion caused the change',
            ${project.ownerId}::uuid,
            CURRENT_TIMESTAMP
          )
        `;

        throw new Error("ROLLBACK_AFTER_ACCEPTED_LINEAGE");
      }),
    ).rejects.toThrow("ROLLBACK_AFTER_ACCEPTED_LINEAGE");
  });

  it.each(["UPDATE", "DELETE"] as const)(
    "rejects %s attempts against append-only Research source references",
    async (operation) => {
      await expect(
        client.$transaction(async (transaction) => {
          const project = await createProjectFixture(transaction);
          const researchId = await createResearchFixture(transaction, project);
          const sourceReferenceId = crypto.randomUUID();
          await transaction.$executeRaw`
            INSERT INTO "ResearchSourceReference" (
              "id", "researchId", "kind", "title", "relevanceNote", "credibilityNote",
              "retrievalState", "citedLocations", "addedById"
            ) VALUES (
              ${sourceReferenceId}::uuid,
              ${researchId}::uuid,
              'LINK',
              'Source title',
              'Relevant source',
              'Credibility note',
              'RETRIEVED',
              '[]'::jsonb,
              ${project.ownerId}::uuid
            )
          `;

          if (operation === "UPDATE") {
            await transaction.$executeRaw`
              UPDATE "ResearchSourceReference"
              SET "title" = 'Changed source'
              WHERE "id" = ${sourceReferenceId}::uuid
            `;
          } else {
            await transaction.$executeRaw`
              DELETE FROM "ResearchSourceReference" WHERE "id" = ${sourceReferenceId}::uuid
            `;
          }
        }),
      ).rejects.toThrow(/history is append-only/iu);
    },
  );

  it("rejects persisted source-review output without complete AI provenance", async () => {
    await expect(
      client.$transaction(async (transaction) => {
        const project = await createProjectFixture(transaction);
        const reviewId = crypto.randomUUID();
        await transaction.$executeRaw`
          INSERT INTO "ResearchSourceReview" (
            "id", "projectId", "ownerId", "idempotencyKey", "sourceKind", "sealedSource",
            "currentRevision", "updatedAt"
          ) VALUES (
            ${reviewId}::uuid,
            ${project.projectId}::uuid,
            ${project.ownerId}::uuid,
            ${crypto.randomUUID()}::uuid,
            'URL',
            '{"ciphertext":"source"}'::jsonb,
            1,
            CURRENT_TIMESTAMP
          )
        `;
        await transaction.$executeRaw`
          INSERT INTO "ResearchSourceReviewRevision" (
            "id", "reviewId", "revision", "retrievalState", "sealedOutput", "citations",
            "createdById"
          ) VALUES (
            ${crypto.randomUUID()}::uuid,
            ${reviewId}::uuid,
            1,
            'RETRIEVED',
            'sealed-ai-output',
            '[]'::jsonb,
            ${project.ownerId}::uuid
          )
        `;
      }),
    ).rejects.toThrow(/check constraint/iu);
  });

  it("accepts a pending source-review revision with no output or AI provenance", async () => {
    await expect(
      client.$transaction(async (transaction) => {
        const project = await createProjectFixture(transaction);
        const reviewId = crypto.randomUUID();
        await transaction.$executeRaw`
          INSERT INTO "ResearchSourceReview" (
            "id", "projectId", "ownerId", "idempotencyKey", "sourceKind", "sealedSource",
            "currentRevision", "updatedAt"
          ) VALUES (
            ${reviewId}::uuid,
            ${project.projectId}::uuid,
            ${project.ownerId}::uuid,
            ${crypto.randomUUID()}::uuid,
            'URL',
            '{"ciphertext":"source"}'::jsonb,
            1,
            CURRENT_TIMESTAMP
          )
        `;
        await transaction.$executeRaw`
          INSERT INTO "ResearchSourceReviewRevision" (
            "id", "reviewId", "revision", "retrievalState", "citations", "createdById"
          ) VALUES (
            ${crypto.randomUUID()}::uuid,
            ${reviewId}::uuid,
            1,
            'PENDING',
            '[]'::jsonb,
            ${project.ownerId}::uuid
          )
        `;
        throw new Error("ROLLBACK_AFTER_ACCEPTED_PENDING_REVIEW");
      }),
    ).rejects.toThrow("ROLLBACK_AFTER_ACCEPTED_PENDING_REVIEW");
  });
});
