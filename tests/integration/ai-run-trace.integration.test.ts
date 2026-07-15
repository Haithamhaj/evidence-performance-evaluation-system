import { z } from "zod";
import { appendAuditEvent } from "../../packages/audit/src/index.js";
import {
  AiRouter,
  changeAiRouteWithAudit,
  FakeAiProviderAdapter,
  PrismaAiRoutingRepository,
} from "../../packages/ai-routing/src/index.js";
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
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  async function configure(routeKey: string, modelKey: string) {
    return changeAiRouteWithAudit(
      client,
      {
        routeKey,
        level: "system",
        scopeId: systemScopeId,
        reason: `Configure ${modelKey} for durable trace verification`,
        actor: { kind: "human", id: administratorId },
        effectiveSubjectId: administratorId,
        correlationId: crypto.randomUUID(),
        source: "api",
        providers: [{ providerKey: "fake", modelKey, locality: "local" }],
      },
      databaseWriter,
    );
  }

  function request(routeKey: string, correlationId: string) {
    return {
      routeKey,
      systemId: systemScopeId,
      input: { protectedContent: "never persist this input" },
      inputReference: "document-version:trace-source",
      inputSchemaVersion: "trace-input.v1",
      outputSchemaVersion: "trace-output.v1",
      promptTemplateVersion: "trace-prompt.v1",
      outputSchema: z.object({ summary: z.string() }).strict(),
      sourceReferences: ["document-version:trace-source", "evidence:trace-source"],
      classification: "confidential" as const,
      timeoutMs: 1_000,
      requiresHumanApproval: true,
      correlationId,
    };
  }

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
      outputReference: "analysis:first",
    }));
    const firstRun = await client.aiRun.findUniqueOrThrow({
      where: { correlationId: firstCorrelationId },
    });

    expect(firstRun).toMatchObject({
      routeId: firstConfig.routeId,
      routeConfigId: firstConfig.configId,
      routeConfigVersion: 1,
      providerKey: "fake",
      modelKey: "model-v1",
      classification: "confidential",
      state: "succeeded",
      humanApprovalState: "pending",
      inputReference: "document-version:trace-source",
      outputReference: "analysis:first",
      sourceReferences: ["document-version:trace-source", "evidence:trace-source"],
      usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
    });
    expect(firstRun.startedAt.toISOString()).toMatch(/Z$/u);
    expect(firstRun.completedAt.toISOString()).toMatch(/Z$/u);
    expect(firstRun.latencyMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(firstRun)).not.toContain("never persist this input");

    const secondConfig = await configure(routeKey, "model-v2");
    const secondCorrelationId = crypto.randomUUID();
    await router.run(request(routeKey, secondCorrelationId), async () => ({
      outputReference: "analysis:second",
    }));
    const secondRun = await client.aiRun.findUniqueOrThrow({
      where: { correlationId: secondCorrelationId },
    });

    expect(secondConfig.configVersion).toBe(2);
    expect(secondRun).toMatchObject({
      routeConfigId: secondConfig.configId,
      routeConfigVersion: 2,
      modelKey: "model-v2",
    });
    await expect(
      client.aiRun.update({ where: { id: firstRun.id }, data: { outputReference: "mutated" } }),
    ).rejects.toThrow(/AI run history is immutable/u);
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
    const run = await client.aiRun.findUniqueOrThrow({ where: { correlationId } });
    expect(run).toMatchObject({
      state: "quarantined",
      errorCategory: "invalid_output",
      outputReference: null,
    });
    expect(JSON.stringify(run)).not.toContain("do not persist");
  });
});
