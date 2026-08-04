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
      UNION ALL
      SELECT to_regclass('"ProgressContractAiDraftAppliedComponent"')::text
    `;
    expect(tables.map(({ name }) => name)).not.toContain(null);

    const foreignKeys = await client.$queryRaw<Array<{ table_name: string; delete_rule: string }>>`
      SELECT tc.table_name, rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_schema = tc.constraint_schema
       AND rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_schema = 'public'
        AND tc.table_name IN (
          'ProgressContractAiDraftRequest',
          'ProgressContractAiDraftRevision',
          'ProgressContractAiDraftAppliedComponent'
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
    expect(revisionTriggers.map(({ manipulation }) => manipulation)).toEqual(["DELETE", "UPDATE"]);

    const mappingTriggers = await client.$queryRaw<Array<{ manipulation: string }>>`
      SELECT event_manipulation AS manipulation
      FROM information_schema.triggers
      WHERE event_object_schema = 'public'
        AND event_object_table = 'ProgressContractAiDraftAppliedComponent'
        AND event_manipulation IN ('UPDATE', 'DELETE')
      ORDER BY event_manipulation
    `;
    expect(mappingTriggers.map(({ manipulation }) => manipulation)).toEqual(["DELETE", "UPDATE"]);

    const [requestGuard] = await client.$queryRaw<Array<{ definition: string }>>`
      SELECT pg_get_functiondef(p.oid) AS definition
      FROM pg_proc p
      WHERE p.proname = 'guard_progress_contract_ai_draft_request'
    `;
    expect(requestGuard?.definition).toMatch(
      /OLD\."aiRunTraceId" IS NOT NULL\s+AND NEW\."aiRunTraceId" IS DISTINCT FROM OLD\."aiRunTraceId"/u,
    );
  });

  it("pins idempotency and monotonically increasing revision numbers", async () => {
    const indexes = await client.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'ProgressContractAiDraftRequest_requestedById_idempotencyKey_key',
          'ProgressContractAiDraftRevision_requestId_revision_key',
          'ProgressContractAiDraftAppliedComponent_requestId_clientKey_key',
          'ProgressContractAiDraftAppliedComponent_componentId_key'
        )
      ORDER BY indexname
    `;
    expect(indexes).toHaveLength(4);
  });

  it("rejects replacing an established AI run trace link", async () => {
    await expect(
      client.$transaction(async (transaction) => {
        await transaction.$executeRaw`
          CREATE TEMPORARY TABLE "ProgressContractAiDraftRequestGuardFixture" (
            "id" UUID NOT NULL,
            "projectId" UUID NOT NULL,
            "documentId" UUID NOT NULL,
            "documentVersionId" UUID NOT NULL,
            "requestedById" UUID NOT NULL,
            "idempotencyKey" TEXT NOT NULL,
            "payloadHash" TEXT NOT NULL,
            "state" TEXT NOT NULL,
            "failureCode" TEXT,
            "sourceChecksum" TEXT NOT NULL,
            "routeKey" TEXT NOT NULL,
            "promptVersion" TEXT NOT NULL,
            "outputSchemaVersion" TEXT NOT NULL,
            "locale" TEXT NOT NULL,
            "timezone" TEXT NOT NULL,
            "effectiveAt" TIMESTAMPTZ NOT NULL,
            "aiRunTraceId" UUID,
            "appliedContractId" UUID,
            "createdAt" TIMESTAMPTZ NOT NULL
          ) ON COMMIT DROP
        `;
        await transaction.$executeRaw`
          CREATE TRIGGER "guard_fixture_update"
          BEFORE UPDATE ON "ProgressContractAiDraftRequestGuardFixture"
          FOR EACH ROW EXECUTE FUNCTION "guard_progress_contract_ai_draft_request"()
        `;
        const lineageId = crypto.randomUUID();
        const firstRunId = crypto.randomUUID();
        const replacementRunId = crypto.randomUUID();
        await transaction.$executeRaw`
          INSERT INTO "ProgressContractAiDraftRequestGuardFixture" (
            "id", "projectId", "documentId", "documentVersionId", "requestedById",
            "idempotencyKey", "payloadHash", "state", "sourceChecksum", "routeKey",
            "promptVersion", "outputSchemaVersion", "locale", "timezone", "effectiveAt",
            "aiRunTraceId", "createdAt"
          ) VALUES (
            ${lineageId}::uuid, ${crypto.randomUUID()}::uuid, ${crypto.randomUUID()}::uuid,
            ${crypto.randomUUID()}::uuid, ${crypto.randomUUID()}::uuid, 'fixture-key',
            'fixture-hash', 'ready', 'fixture-checksum', 'project.progress-contract.draft',
            'fixture-prompt', 'fixture-schema', 'en', 'Asia/Riyadh', CURRENT_TIMESTAMP,
            ${firstRunId}::uuid, CURRENT_TIMESTAMP
          )
        `;
        await transaction.$executeRaw`
          UPDATE "ProgressContractAiDraftRequestGuardFixture"
          SET "aiRunTraceId" = ${replacementRunId}::uuid
          WHERE "id" = ${lineageId}::uuid
        `;
      }),
    ).rejects.toThrow(/trace link is immutable once set/iu);
  });
});
