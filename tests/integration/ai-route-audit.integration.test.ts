import { appendAuditEvent } from "../../packages/audit/src/index.js";
import { changeAiRouteWithAudit } from "../../packages/ai-routing/src/index.js";
import { createDatabaseClient } from "../../packages/database/src/index.js";
import { seedPilotWithAudit } from "../../scripts/seed-pilot.js";
import { changeAuthorizedAiRoute } from "../../apps/api/src/ai-routing/ai-routing.module.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

type DatabaseClient = ReturnType<typeof createDatabaseClient>;
type DatabaseTransaction = Parameters<Parameters<DatabaseClient["$transaction"]>[0]>[0];
type AuditWriter<T> = import("../../packages/contracts/src/index.js").AuditWriter<T>;

const databaseWriter: AuditWriter<DatabaseTransaction> = { append: appendAuditEvent };

describe("AI route audit composition contract", () => {
  it("provides the transaction-owning route change operation", () => {
    expect(changeAiRouteWithAudit).toBeTypeOf("function");
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)("transactionally audited AI route changes", () => {
  let client: DatabaseClient;
  let administratorId: string;
  let managerId: string;
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
    managerId = (await client.user.findUniqueOrThrow({ where: { pilotKey: "pilot-manager" } })).id;
    systemScopeId = (
      await client.authorizationScope.findUniqueOrThrow({ where: { key: "system" } })
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
      actor: { kind: "human" as const, id: administratorId },
      effectiveSubjectId: administratorId,
      correlationId: crypto.randomUUID(),
      source: "api" as const,
      providers: [
        { providerKey: "local", modelKey: "model-a", locality: "local" as const },
        { providerKey: "external", modelKey: "model-b", locality: "external" as const },
      ],
    };
  }

  it.each(["", "  ", "ab", ` ${"a".repeat(3)}`, `${"a".repeat(3)} `, "a".repeat(501)])(
    "rejects route creation with an invalid trimmed reason %#",
    async (reason) => {
      const routeKey = `test.invalid-reason.${crypto.randomUUID()}`;

      await expect(
        changeAiRouteWithAudit(client, change(routeKey, reason), databaseWriter),
      ).rejects.toThrow();
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

    const result = await changeAiRouteWithAudit(client, request, databaseWriter);
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

    await expect(changeAiRouteWithAudit(client, request, failingWriter)).rejects.toThrow(
      "audit unavailable",
    );
    await expect(client.aiRoute.count({ where: { routeKey } })).resolves.toBe(0);
    await expect(
      client.auditEvent.count({ where: { correlationId: request.correlationId } }),
    ).resolves.toBe(0);
  });

  it("rolls back only the attempted next version when audit append fails", async () => {
    const routeKey = `test.version-rollback.${crypto.randomUUID()}`;
    await changeAiRouteWithAudit(
      client,
      change(routeKey, "Initial safe route configuration"),
      databaseWriter,
    );
    const failingWriter: AuditWriter<DatabaseTransaction> = {
      append: vi.fn().mockRejectedValue(new Error("audit unavailable")),
    };

    await expect(
      changeAiRouteWithAudit(
        client,
        change(routeKey, "Attempted second route configuration"),
        failingWriter,
      ),
    ).rejects.toThrow("audit unavailable");

    const route = await client.aiRoute.findFirstOrThrow({ where: { routeKey } });
    await expect(
      client.aiRouteConfig.findMany({ where: { routeId: route.id } }),
    ).resolves.toHaveLength(1);
  });

  it("serializes concurrent changes into distinct immutable versions", async () => {
    const routeKey = `test.concurrent.${crypto.randomUUID()}`;

    await Promise.all([
      changeAiRouteWithAudit(
        client,
        change(routeKey, "Concurrent route change number one"),
        databaseWriter,
      ),
      changeAiRouteWithAudit(
        client,
        change(routeKey, "Concurrent route change number two"),
        databaseWriter,
      ),
    ]);

    const route = await client.aiRoute.findFirstOrThrow({ where: { routeKey } });
    const configs = await client.aiRouteConfig.findMany({
      where: { routeId: route.id },
      orderBy: { version: "asc" },
    });
    expect(configs.map(({ version }) => version)).toEqual([1, 2]);
    await expect(
      client.aiRouteConfig.update({ where: { id: configs[0]!.id }, data: { reason: "mutated" } }),
    ).rejects.toThrow(/AI route configuration history is immutable/u);
  });

  it("rejects a route whose scope UUID is missing or has the wrong scope type", async () => {
    const missing = change(`test.missing-scope.${crypto.randomUUID()}`, "Missing route scope test");
    const wrongType = {
      ...change(`test.wrong-scope.${crypto.randomUUID()}`, "Wrong route scope type test"),
      level: "department" as const,
    };

    await expect(
      changeAiRouteWithAudit(client, { ...missing, scopeId: crypto.randomUUID() }, databaseWriter),
    ).rejects.toMatchObject({ code: "AI_ROUTE_SCOPE_INVALID" });
    await expect(changeAiRouteWithAudit(client, wrongType, databaseWriter)).rejects.toMatchObject({
      code: "AI_ROUTE_SCOPE_INVALID",
    });
  });

  it("denies protected route management to a non-administrator before change or audit", async () => {
    const routeKey = `test.unauthorized.${crypto.randomUUID()}`;
    const request = {
      ...change(routeKey, "Unauthorized manager route change attempt"),
      actor: { kind: "human" as const, id: managerId },
      effectiveSubjectId: managerId,
    };

    await expect(
      changeAuthorizedAiRoute(client, { userId: managerId, active: true }, request, databaseWriter),
    ).rejects.toMatchObject({ code: "AUTHZ_ROLE_REQUIRED", status: 403 });
    await expect(client.aiRoute.count({ where: { routeKey } })).resolves.toBe(0);
    await expect(
      client.auditEvent.count({ where: { correlationId: request.correlationId } }),
    ).resolves.toBe(0);
  });
});
