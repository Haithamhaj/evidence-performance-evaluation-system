import { randomUUID } from "node:crypto";

import { AdminCommandService } from "@evaluation/administration";
import { createDatabaseClient } from "@evaluation/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { executeAiRouteAdminCommand } from "../../apps/api/src/ai-routing/admin-composition.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const administratorId = randomUUID();
let systemScopeId = randomUUID();
const providerId = randomUUID();

beforeAll(async () => {
  await database.user.create({
    data: { id: administratorId, email: `${administratorId}@example.test`, displayName: "Admin" },
  });
  const systemScope = await database.authorizationScope.upsert({
    where: { key: "system" },
    create: { id: systemScopeId, key: "system", scopeType: "system" },
    update: {},
  });
  systemScopeId = systemScope.id;
  await database.roleAssignment.create({
    data: {
      userId: administratorId,
      role: "system_administrator",
      scopeType: "system",
      scopeId: systemScopeId,
    },
  });
  await database.aiProviderConfig.create({
    data: {
      id: providerId,
      providerKey: `operations-${providerId}`,
      version: 1,
      adapterKey: "openai-responses",
      modelKey: "gpt-test",
      locality: "external",
      endpoint: "https://api.openai.com/v1/responses",
      endpointProtocol: "https",
      endpointHost: "api.openai.com",
      reason: "Deterministic owner-composition fixture.",
      createdById: administratorId,
    },
  });
});
afterAll(async () => database.$disconnect());

describe("operations admin owner composition", () => {
  it("delegates an AI route mutation to its owner with atomic audit and optimistic version", async () => {
    const service = new AdminCommandService(
      database,
      { isSystemAdministrator: async (actorId) => actorId === administratorId },
      { AI_ROUTES_MANAGE: { execute: (command) => executeAiRouteAdminCommand(database, command) } },
    );
    const payload = {
      routeKey: `operations.acceptance-${providerId}`,
      level: "system",
      scopeId: systemScopeId,
      providers: [{ providerConfigId: providerId }],
    };
    const receipt = await service.execute({
      schemaVersion: 1,
      idempotencyKey: randomUUID(),
      actorId: administratorId,
      capability: "AI_ROUTES_MANAGE",
      expectedVersion: 1,
      reason: "Activate a versioned route through its authoritative owner.",
      payload,
    });
    expect(receipt).toMatchObject({ capability: "AI_ROUTES_MANAGE", ownerDomain: "ai-routing" });
    await expect(
      database.auditEvent.findFirst({
        where: { eventType: "ai.route.changed", targetId: receipt.ownerReceiptId },
      }),
    ).resolves.toMatchObject({ actorId: administratorId });
    await expect(
      service.execute({
        schemaVersion: 1,
        idempotencyKey: randomUUID(),
        actorId: administratorId,
        capability: "AI_ROUTES_MANAGE",
        expectedVersion: 1,
        reason: "Reject this stale expected version.",
        payload,
      }),
    ).rejects.toMatchObject({ code: "ADMIN_VERSION_CONFLICT", status: 409 });
  });
});
