import { appendAuditEvent } from "../../packages/audit/src/index.js";
import { createDatabaseClient } from "../../packages/database/src/index.js";
import { seedPilotWithAudit } from "../../scripts/seed-pilot.js";
import {
  changeAuthorizedAiRoute,
  registerAuthorizedAiLocalTrustPolicy,
  registerAuthorizedAiProviderConfig,
} from "../../apps/api/src/ai-routing/ai-routing.module.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

type DatabaseClient = ReturnType<typeof createDatabaseClient>;
type DatabaseTransaction = Parameters<Parameters<DatabaseClient["$transaction"]>[0]>[0];
type AuditWriter<T> = import("../../packages/contracts/src/index.js").AuditWriter<T>;

const databaseWriter: AuditWriter<DatabaseTransaction> = { append: appendAuditEvent };

describe("AI route audit composition contract", () => {
  it("provides the transaction-owning route change operation", () => {
    expect(changeAuthorizedAiRoute).toBeTypeOf("function");
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("transactionally audited AI route changes", () => {
  let client: DatabaseClient;
  let administratorId: string;
  let managerId: string;
  let systemScopeId: string;
  let localProviderConfigId: string;
  let externalProviderConfigId: string;
  let localTrustPolicy: Readonly<{ id: string; version: number }>;

  beforeAll(async () => {
    client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
    await seedPilotWithAudit(
      client,
      { managerSubject: "pilot-manager", adminSubject: "system-admin" },
      databaseWriter,
    );
    administratorId = (await client.user.findUniqueOrThrow({ where: { pilotKey: "system-admin" } }))
      .id;
    managerId = (await client.user.findUniqueOrThrow({ where: { pilotKey: "pilot-manager" } })).id;
    systemScopeId = (
      await client.authorizationScope.findUniqueOrThrow({ where: { key: "system" } })
    ).id;
    localTrustPolicy = await registerAuthorizedAiLocalTrustPolicy(
      client,
      { userId: administratorId, active: true },
      {
        policyKey: `route-test-${crypto.randomUUID()}`,
        allowedIps: ["127.0.0.1"],
        reason: "Trust loopback for route integration tests",
        correlationId: crypto.randomUUID(),
      },
      databaseWriter,
    );
    localProviderConfigId = (
      await registerAuthorizedAiProviderConfig(
        client,
        { userId: administratorId, active: true },
        {
          providerKey: `local-${crypto.randomUUID()}`,
          adapterKey: "openai-compatible",
          modelKey: "model-a",
          locality: "local",
          endpoint: "http://127.0.0.1:11434/v1/",
          localTrustPolicyId: localTrustPolicy.id,
          localTrustPolicyVersion: localTrustPolicy.version,
          localTrustAllowedIp: "127.0.0.1",
          reason: "Register local integration-test provider",
          correlationId: crypto.randomUUID(),
        },
        databaseWriter,
      )
    ).id;
    externalProviderConfigId = (
      await registerAuthorizedAiProviderConfig(
        client,
        { userId: administratorId, active: true },
        {
          providerKey: `external-${crypto.randomUUID()}`,
          adapterKey: "openai-compatible",
          modelKey: "model-b",
          locality: "external",
          endpoint: "https://provider.example.invalid/v1/",
          reason: "Register external integration-test provider",
          correlationId: crypto.randomUUID(),
        },
        databaseWriter,
      )
    ).id;
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  function change(routeKey: string, reason: string) {
    return {
      routeKey,
      level: "system" as const,
      scopeId: systemScopeId,
      reason,
      correlationId: crypto.randomUUID(),
      providers: [
        { providerConfigId: localProviderConfigId },
        { providerConfigId: externalProviderConfigId },
      ],
    };
  }

  function applyChange(input: unknown, writer: AuditWriter<DatabaseTransaction> = databaseWriter) {
    return changeAuthorizedAiRoute(
      client,
      { userId: administratorId, active: true },
      input,
      writer,
    );
  }

  it.each(["", "  ", "ab", ` ${"a".repeat(3)}`, `${"a".repeat(3)} `, "a".repeat(501)])(
    "rejects route creation with an invalid trimmed reason %#",
    async (reason) => {
      const routeKey = `test.invalid-reason.${crypto.randomUUID()}`;

      await expect(applyChange(change(routeKey, reason))).rejects.toThrow();
      await expect(client.aiRoute.count({ where: { routeKey } })).resolves.toBe(0);
      await expect(
        client.auditEvent.count({
          where: {
            eventType: "ai.route.changed",
            correlationId: change(routeKey, reason).correlationId,
          },
        }),
      ).resolves.toBe(0);
    },
  );

  it("commits a route configuration version and ai.route.changed audit together", async () => {
    const routeKey = `test.atomic-success.${crypto.randomUUID()}`;
    const request = change(routeKey, "Route required for local document processing");

    const result = await applyChange(request);
    const [route, config, audit] = await Promise.all([
      client.aiRoute.findUniqueOrThrow({ where: { id: result.routeId } }),
      client.aiRouteConfig.findUniqueOrThrow({ where: { id: result.configId } }),
      client.auditEvent.findFirstOrThrow({ where: { correlationId: request.correlationId } }),
    ]);

    expect(route).toMatchObject({ routeKey, level: "system", scopeId: systemScopeId });
    expect(config).toMatchObject({
      routeId: route.id,
      version: 1,
      reason: "Route required for local document processing",
      createdById: administratorId,
    });
    expect(audit).toMatchObject({
      eventType: "ai.route.changed",
      scopeType: "system",
      scopeId: systemScopeId,
      targetType: "ai_route_config",
      targetId: config.id,
      reason: "Route required for local document processing",
    });
  });

  it("rolls back both a new route and configuration version when audit append fails", async () => {
    const routeKey = `test.atomic-failure.${crypto.randomUUID()}`;
    const request = change(routeKey, "Route change with unavailable audit writer");
    const failingWriter: AuditWriter<DatabaseTransaction> = {
      append: vi.fn().mockRejectedValue(new Error("audit unavailable")),
    };

    await expect(applyChange(request, failingWriter)).rejects.toThrow("audit unavailable");
    await expect(client.aiRoute.count({ where: { routeKey } })).resolves.toBe(0);
    await expect(
      client.auditEvent.count({ where: { correlationId: request.correlationId } }),
    ).resolves.toBe(0);
  });

  it("rolls back only the attempted next version when audit append fails", async () => {
    const routeKey = `test.version-rollback.${crypto.randomUUID()}`;
    await applyChange(change(routeKey, "Initial safe route configuration"));
    const failingWriter: AuditWriter<DatabaseTransaction> = {
      append: vi.fn().mockRejectedValue(new Error("audit unavailable")),
    };

    await expect(
      applyChange(change(routeKey, "Attempted second route configuration"), failingWriter),
    ).rejects.toThrow("audit unavailable");

    const route = await client.aiRoute.findFirstOrThrow({ where: { routeKey } });
    await expect(
      client.aiRouteConfig.findMany({ where: { routeId: route.id } }),
    ).resolves.toHaveLength(1);
  });

  it("serializes concurrent changes into distinct immutable versions", async () => {
    const routeKey = `test.concurrent.${crypto.randomUUID()}`;

    await Promise.all([
      applyChange(change(routeKey, "Concurrent route change number one")),
      applyChange(change(routeKey, "Concurrent route change number two")),
    ]);

    const route = await client.aiRoute.findFirstOrThrow({ where: { routeKey } });
    const configs = await client.aiRouteConfig.findMany({
      where: { routeId: route.id },
      orderBy: { version: "asc" },
    });
    expect(configs.map(({ version }) => version)).toEqual([1, 2]);
    await expect(
      client.aiRouteConfig.update({ where: { id: configs[0]!.id }, data: { reason: "mutated" } }),
    ).rejects.toThrow(/AI history is immutable/u);
  });

  it("rejects a route whose scope UUID is missing or has the wrong scope type", async () => {
    const missing = change(`test.missing-scope.${crypto.randomUUID()}`, "Missing route scope test");
    const wrongType = {
      ...change(`test.wrong-scope.${crypto.randomUUID()}`, "Wrong route scope type test"),
      level: "department" as const,
    };

    await expect(applyChange({ ...missing, scopeId: crypto.randomUUID() })).rejects.toMatchObject({
      code: "AI_ROUTE_SCOPE_INVALID",
    });
    await expect(applyChange(wrongType)).rejects.toMatchObject({
      code: "AI_ROUTE_SCOPE_INVALID",
    });
  });

  it("accepts only authoritative provider-config IDs and ignores no caller locality claims", async () => {
    const routeKey = `test.authoritative-provider.${crypto.randomUUID()}`;
    const invalid = {
      ...change(routeKey, "Reject caller-authored provider locality"),
      providers: [
        {
          providerConfigId: localProviderConfigId,
          locality: "external",
          endpoint: "https://evil.invalid",
        },
      ],
    };

    await expect(applyChange(invalid)).rejects.toThrow();
    await expect(
      applyChange({
        ...change(routeKey, "Reject unknown provider configuration"),
        providers: [{ providerConfigId: crypto.randomUUID() }],
      }),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_CONFIG_INVALID" });
    await expect(client.aiRoute.count({ where: { routeKey } })).resolves.toBe(0);
  });

  it("rejects a remote endpoint registered as local before it can enter a route", async () => {
    const providerKey = `false-local-${crypto.randomUUID()}`;
    await expect(
      registerAuthorizedAiProviderConfig(
        client,
        { userId: administratorId, active: true },
        {
          providerKey,
          adapterKey: "openai-compatible",
          modelKey: "remote-model",
          locality: "local",
          endpoint: "https://198.51.100.20/v1/",
          localTrustPolicyId: localTrustPolicy.id,
          localTrustPolicyVersion: localTrustPolicy.version,
          localTrustAllowedIp: "127.0.0.1",
          reason: "Attempt to mislabel remote provider as local",
          correlationId: crypto.randomUUID(),
        },
        databaseWriter,
      ),
    ).rejects.toMatchObject({ code: "AI_ADAPTER_URL_INVALID" });
    await expect(client.aiProviderConfig.count({ where: { providerKey } })).resolves.toBe(0);
  });

  it("denies protected route management to a non-administrator before change or audit", async () => {
    const routeKey = `test.unauthorized.${crypto.randomUUID()}`;
    const request = change(routeKey, "Unauthorized manager route change attempt");

    await expect(
      changeAuthorizedAiRoute(client, { userId: managerId, active: true }, request, databaseWriter),
    ).rejects.toMatchObject({ code: "AUTHZ_ROLE_REQUIRED", status: 403 });
    await expect(client.aiRoute.count({ where: { routeKey } })).resolves.toBe(0);
    await expect(
      client.auditEvent.count({ where: { correlationId: request.correlationId } }),
    ).resolves.toBe(0);
  });

  it("derives actor, effective subject, and API audit source from the authenticated server context", async () => {
    const clientInput = change(
      `test.server-provenance.${crypto.randomUUID()}`,
      "Server-derived audit provenance verification",
    );
    const result = await changeAuthorizedAiRoute(
      client,
      { userId: administratorId, active: true },
      clientInput,
      databaseWriter,
    );
    const audit = await client.auditEvent.findFirstOrThrow({
      where: { targetId: result.configId },
    });

    expect(audit).toMatchObject({
      actorId: administratorId,
      effectiveSubjectId: administratorId,
      source: "api",
    });
  });

  it("records previous and new route context, affected data type, effective time, and administrator", async () => {
    const routeKey = `document.audit-context.${crypto.randomUUID()}`;
    const first = change(routeKey, "Initial provider route for audit context");
    const firstResult = await applyChange(first);
    const second = {
      ...change(routeKey, "Replace provider route with exact audit context"),
      providers: [{ providerConfigId: externalProviderConfigId }],
    };
    const secondResult = await applyChange(second);
    const audit = await client.auditEvent.findFirstOrThrow({
      where: { targetId: secondResult.configId },
    });

    expect(audit.safeDiff).toMatchObject({
      routeKey,
      affectedDataType: "document",
      administratorId,
      previous: { configId: firstResult.configId, version: 1 },
      next: { configId: secondResult.configId, version: 2 },
    });
    expect((audit.safeDiff as { effectiveAt?: unknown }).effectiveAt).toEqual(expect.any(String));
  });
});
