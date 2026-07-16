import { z } from "zod";
import { appendAuditEvent } from "../../packages/audit/src/index.js";
import {
  AiRouter,
  changeAiRouteWithAudit,
  PrismaAiRoutingRepository,
  registerAiOutputSchemaArtifact,
  registerAiProviderConfig,
} from "../../packages/ai-routing/src/index.js";
import { FakeAiProviderAdapter } from "../../packages/ai-routing/src/adapters/fake.js";
import { createDatabaseClient } from "../../packages/database/src/index.js";
import { seedPilotWithAudit } from "../../scripts/seed-pilot.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type DatabaseClient = ReturnType<typeof createDatabaseClient>;
type DatabaseTransaction = Parameters<Parameters<DatabaseClient["$transaction"]>[0]>[0];
type AuditWriter<T> = import("../../packages/contracts/src/index.js").AuditWriter<T>;

const databaseWriter: AuditWriter<DatabaseTransaction> = { append: appendAuditEvent };

describe("AI run trace persistence contract", () => {
  it("provides the durable Prisma repository and router", () => {
    expect(PrismaAiRoutingRepository).toBeTypeOf("function");
    expect(AiRouter).toBeTypeOf("function");
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("durable AI run traces", () => {
  let client: DatabaseClient;
  let administratorId: string;
  let systemScopeId: string;
  let projectScopeId: string;
  let departmentScopeId: string;

  beforeAll(async () => {
    client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
    await seedPilotWithAudit(
      client,
      { managerSubject: "pilot-manager", adminSubject: "system-admin" },
      databaseWriter,
    );
    administratorId = (await client.user.findUniqueOrThrow({ where: { pilotKey: "system-admin" } }))
      .id;
    systemScopeId = (
      await client.authorizationScope.findUniqueOrThrow({ where: { key: "system" } })
    ).id;
    projectScopeId = (
      await client.authorizationScope.upsert({
        where: { key: "test-ai-run-project" },
        create: { key: "test-ai-run-project", scopeType: "project" },
        update: {},
      })
    ).id;
    const departmentId = (
      await client.department.findUniqueOrThrow({ where: { key: "ai-department" } })
    ).id;
    departmentScopeId = (
      await client.authorizationScope.upsert({
        where: { key: "test-ai-run-department" },
        create: { key: "test-ai-run-department", scopeType: "department", departmentId },
        update: {},
      })
    ).id;
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  async function configure(routeKey: string, modelKey: string) {
    const provider = await registerAiProviderConfig(client, {
      providerKey: "fake",
      adapterKey: "fake",
      modelKey,
      locality: "local",
      endpoint: "http://127.0.0.1:11434/v1/",
      reason: `Register ${modelKey} for durable trace verification`,
      createdById: administratorId,
    });
    await registerAiOutputSchemaArtifact(
      client,
      routeKey,
      "trace-output.v1",
      z.object({ summary: z.string() }).strict(),
    );
    return changeAiRouteWithAudit(
      client,
      {
        routeKey,
        level: "system",
        scopeId: systemScopeId,
        reason: `Configure ${modelKey} for durable trace verification`,
        correlationId: crypto.randomUUID(),
        providers: [{ providerConfigId: provider.id }],
      },
      { actorId: administratorId, effectiveSubjectId: administratorId, source: "api" },
      databaseWriter,
    );
  }

  function request(routeKey: string, correlationId: string, withInvocationScopes = false) {
    return {
      routeKey,
      ...(withInvocationScopes
        ? { projectId: projectScopeId, departmentId: departmentScopeId }
        : {}),
      systemId: systemScopeId,
      input: { protectedContent: "never persist this input" },
      inputReference: "document-version:00000000-0000-4000-8000-000000000101",
      inputSchemaVersion: "trace-input.v1",
      outputSchemaVersion: "trace-output.v1",
      promptTemplateVersion: "trace-prompt.v1",
      outputSchema: z.object({ summary: z.string() }).strict(),
      sourceReferences: [
        "document-version:00000000-0000-4000-8000-000000000101",
        "evidence:00000000-0000-4000-8000-000000000102",
      ],
      classification: "confidential" as const,
      timeoutMs: 1_000,
      requiresHumanApproval: true,
      correlationId,
    };
  }

  it("provides immutable provider/model and structured-output schema registries", async () => {
    const rows = await client.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('AiProviderConfig', 'AiRouteConfigProvider', 'AiOutputSchemaArtifact')
      ORDER BY table_name
    `;

    expect(rows.map(({ table_name }) => table_name)).toEqual([
      "AiOutputSchemaArtifact",
      "AiProviderConfig",
      "AiRouteConfigProvider",
    ]);
  });

  it("links each run to the exact immutable route/config version and sanitized metadata", async () => {
    const routeKey = `test.run-trace.${crypto.randomUUID()}`;
    const firstConfig = await configure(routeKey, "model-v1");
    const repository = new PrismaAiRoutingRepository(client);
    const adapter = new FakeAiProviderAdapter("fake", "local", {
      summary: "validated output",
      usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
      costUsd: 0.001,
    });
    const router = new AiRouter(repository, repository, [adapter]);
    const firstCorrelationId = crypto.randomUUID();

    await router.run(request(routeKey, firstCorrelationId), async () => ({
      outputReference: "analysis:1001",
    }));
    const firstRun = await client.aiRun.findFirstOrThrow({
      where: { correlationId: firstCorrelationId },
      include: { routeConfigProvider: { include: { providerConfig: true } } },
    });

    expect(firstRun).toMatchObject({
      routeId: firstConfig.routeId,
      routeConfigId: firstConfig.configId,
      routeConfigVersion: 1,
      classification: "confidential",
      state: "succeeded",
      humanApprovalState: "pending",
      inputReference: "document-version:00000000-0000-4000-8000-000000000101",
      outputReference: "analysis:1001",
      sourceReferences: [
        "document-version:00000000-0000-4000-8000-000000000101",
        "evidence:00000000-0000-4000-8000-000000000102",
      ],
      usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
    });
    expect(firstRun.startedAt.toISOString()).toMatch(/Z$/u);
    expect(firstRun.completedAt.toISOString()).toMatch(/Z$/u);
    expect(firstRun.latencyMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(firstRun)).not.toContain("never persist this input");
    expect(firstRun as unknown as Record<string, unknown>).toMatchObject({
      providerConfigId: expect.any(String),
      providerConfigVersion: expect.any(Number),
      outputSchemaArtifactId: expect.any(String),
      outputSchemaHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(firstRun.routeConfigProvider.providerConfig).toMatchObject({
      providerKey: "fake",
      modelKey: "model-v1",
      locality: "local",
      endpoint: "http://127.0.0.1:11434/v1/chat/completions",
    });

    const secondConfig = await configure(routeKey, "model-v2");
    const secondCorrelationId = crypto.randomUUID();
    await router.run(request(routeKey, secondCorrelationId), async () => ({
      outputReference: "analysis:1002",
    }));
    const secondRun = await client.aiRun.findFirstOrThrow({
      where: { correlationId: secondCorrelationId },
      include: { routeConfigProvider: { include: { providerConfig: true } } },
    });

    expect(secondConfig.configVersion).toBe(2);
    expect(secondRun).toMatchObject({
      routeConfigId: secondConfig.configId,
      routeConfigVersion: 2,
    });
    expect(secondRun.routeConfigProvider.providerConfig.modelKey).toBe("model-v2");
    await expect(
      client.aiRun.update({ where: { id: firstRun.id }, data: { outputReference: "mutated" } }),
    ).rejects.toThrow(/AI history is immutable/u);
  });

  it("durably records quarantine without storing invalid raw output", async () => {
    const routeKey = `test.run-quarantine.${crypto.randomUUID()}`;
    await configure(routeKey, "model-quarantine");
    const repository = new PrismaAiRoutingRepository(client);
    const router = new AiRouter(repository, repository, [
      new FakeAiProviderAdapter("fake", "local", { unsafeRawValue: "do not persist" }),
    ]);
    const correlationId = crypto.randomUUID();

    await expect(
      router.run(request(routeKey, correlationId), async () => ({ outputReference: "never" })),
    ).rejects.toMatchObject({
      code: "AI_OUTPUT_QUARANTINED",
    });
    const run = await client.aiRun.findFirstOrThrow({ where: { correlationId } });
    expect(run).toMatchObject({
      state: "quarantined",
      errorCategory: "invalid_output",
      outputReference: null,
    });
    expect(JSON.stringify(run)).not.toContain("do not persist");
  });

  it("commits feature output and success trace together and rolls both back on blank reference", async () => {
    const routeKey = `test.atomic-output.${crypto.randomUUID()}`;
    await configure(routeKey, "model-atomic");
    const repository = new PrismaAiRoutingRepository(client);
    const router = new AiRouter(repository, repository, [
      new FakeAiProviderAdapter("fake", "local", { summary: "validated" }),
    ]);
    const correlationId = crypto.randomUUID();
    const featureCorrelationId = crypto.randomUUID();

    await expect(
      router.run(request(routeKey, correlationId), async (transaction: DatabaseTransaction) => {
        await appendAuditEvent(transaction, {
          eventType: "ai.feature.persisted",
          actor: { kind: "human", id: administratorId },
          effectiveSubjectId: administratorId,
          scopeType: "system",
          scopeId: systemScopeId,
          targetType: "ai_feature_output",
          targetId: administratorId,
          correlationId: featureCorrelationId,
          source: "worker",
        });
        return { outputReference: " " };
      }),
    ).rejects.toMatchObject({ code: "AI_OUTPUT_REFERENCE_INVALID" });

    await expect(
      client.auditEvent.count({ where: { correlationId: featureCorrelationId } }),
    ).resolves.toBe(0);
    const failedRun = await client.aiRun.findFirstOrThrow({ where: { correlationId } });
    expect(failedRun).toMatchObject({ state: "failed", errorCategory: "persistence" });
  });

  it("rolls back feature output and durably traces a callback failure", async () => {
    const routeKey = `test.callback-failure.${crypto.randomUUID()}`;
    await configure(routeKey, "model-callback-failure");
    const repository = new PrismaAiRoutingRepository(client);
    const router = new AiRouter(repository, repository, [
      new FakeAiProviderAdapter("fake", "local", { summary: "validated" }),
    ]);
    const correlationId = crypto.randomUUID();
    const featureCorrelationId = crypto.randomUUID();

    await expect(
      router.run(request(routeKey, correlationId), async (transaction: DatabaseTransaction) => {
        await appendAuditEvent(transaction, {
          eventType: "ai.feature.persisted",
          actor: { kind: "human", id: administratorId },
          effectiveSubjectId: administratorId,
          scopeType: "system",
          scopeId: systemScopeId,
          targetType: "ai_feature_output",
          targetId: administratorId,
          correlationId: featureCorrelationId,
          source: "worker",
        });
        throw new Error("feature persistence failed");
      }),
    ).rejects.toMatchObject({ code: "AI_RUN_PERSISTENCE_FAILED" });
    await expect(
      client.auditEvent.count({ where: { correlationId: featureCorrelationId } }),
    ).resolves.toBe(0);
    await expect(
      client.aiRun.findFirstOrThrow({ where: { correlationId } }),
    ).resolves.toMatchObject({ state: "failed", errorCategory: "persistence" });
  });

  it("allows multiple durable runs to share one request correlation ID", async () => {
    const routeKey = `test.shared-correlation.${crypto.randomUUID()}`;
    await configure(routeKey, "model-shared-correlation");
    const repository = new PrismaAiRoutingRepository(client);
    const router = new AiRouter(repository, repository, [
      new FakeAiProviderAdapter("fake", "local", { invalid: "quarantine" }),
    ]);
    const correlationId = crypto.randomUUID();

    for (let index = 0; index < 2; index += 1) {
      await expect(
        router.run(request(routeKey, correlationId), async () => ({ outputReference: "never" })),
      ).rejects.toMatchObject({ code: "AI_OUTPUT_QUARANTINED" });
    }
    await expect(client.aiRun.count({ where: { correlationId } })).resolves.toBe(2);
  });

  it("persists project and department invocation scope independently of resolved route scope", async () => {
    const routeKey = `test.invocation-scopes.${crypto.randomUUID()}`;
    await configure(routeKey, "model-scopes");
    const repository = new PrismaAiRoutingRepository(client);
    const router = new AiRouter(repository, repository, [
      new FakeAiProviderAdapter("fake", "local", { summary: "scoped" }),
    ]);
    const correlationId = crypto.randomUUID();

    await router.run(request(routeKey, correlationId, true), async () => ({
      outputReference: "analysis:1003",
    }));
    const run = (await client.aiRun.findFirstOrThrow({
      where: { correlationId },
    })) as unknown as Record<string, unknown>;
    expect(run).toMatchObject({ projectScopeId, departmentScopeId });
  });

  it("rejects an AiRun whose denormalized route or provider identity contradicts its config", async () => {
    const routeKey = `test.trace-integrity.${crypto.randomUUID()}`;
    await configure(routeKey, "model-integrity");
    const repository = new PrismaAiRoutingRepository(client);
    const router = new AiRouter(repository, repository, [
      new FakeAiProviderAdapter("fake", "local", { summary: "integrity" }),
    ]);
    const correlationId = crypto.randomUUID();
    await router.run(request(routeKey, correlationId), async () => ({
      outputReference: "analysis:1004",
    }));
    const existing = await client.aiRun.findFirstOrThrow({ where: { correlationId } });
    const copy = { ...existing } as Partial<typeof existing>;
    delete copy.id;
    delete copy.createdAt;

    await expect(
      client.aiRun.create({
        data: {
          ...copy,
          routeKey: "contradictory.route",
          correlationId: crypto.randomUUID(),
        } as never,
      }),
    ).rejects.toThrow();
  });
});
