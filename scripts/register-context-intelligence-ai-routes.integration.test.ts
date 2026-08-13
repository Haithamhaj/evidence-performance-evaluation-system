import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient, seedPilot, withTransaction } from "@evaluation/database";

import {
  changeAuthorizedAiRoute,
  registerAuthorizedAiProviderConfig,
} from "../apps/api/src/ai-routing/ai-routing.module.js";
import { registerContextIntelligenceAiRoutes } from "./register-context-intelligence-ai-routes.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? "";
const client = createDatabaseClient(databaseUrl);
let administratorId: string;
let systemScopeId: string;

beforeAll(async () => {
  await withTransaction(client, (transaction) =>
    seedPilot(transaction, {
      managerSubject: "pilot-manager",
      adminSubject: "system-admin",
    }),
  );
  const [administrator, scope] = await Promise.all([
    client.user.findUniqueOrThrow({ where: { pilotKey: "system-admin" } }),
    client.authorizationScope.findUniqueOrThrow({ where: { key: "system" } }),
  ]);
  administratorId = administrator.id;
  systemScopeId = scope.id;
  const principal = { userId: administratorId, active: true } as const;
  const provider = await registerAuthorizedAiProviderConfig(client, principal, {
    providerKey: `context-fixture-${crypto.randomUUID()}`,
    adapterKey: "fixture",
    modelKey: "deterministic-context-fixture",
    locality: "external",
    endpoint: "https://fixture.example.invalid/v1",
    reason: "Prepare governed Context Intelligence registration fixture",
    correlationId: crypto.randomUUID(),
  });
  await changeAuthorizedAiRoute(client, principal, {
    routeKey: "update.structure",
    level: "system",
    scopeId: systemScopeId,
    reason: "Expose an existing governed provider for Context Intelligence registration",
    correlationId: crypto.randomUUID(),
    providers: [{ providerConfigId: provider.id }],
  });
});

afterAll(async () => client.$disconnect());

describe("Context Intelligence production registration", () => {
  it("registers exact artifacts and system routes through authorized governance without a new provider", async () => {
    const providerCount = await client.aiProviderConfig.count();
    const result = await registerContextIntelligenceAiRoutes({
      dryRun: false,
      actorId: administratorId,
      correlationId: crypto.randomUUID(),
      systemScopeId,
      reason: "Register Context Intelligence governed routes",
      databaseUrl,
    });

    expect(result.routes.map(({ routeKey }) => routeKey)).toEqual([
      "context.summarize.v1",
      "context.project-match.v1",
      "task.draft.v1",
      "experience.prepare-next.v1",
      "experience.capture-understand.v1",
      "experience.task-assistant.v1",
    ]);
    await expect(client.aiProviderConfig.count()).resolves.toBe(providerCount);
    for (const route of result.routes) {
      await expect(
        client.aiOutputSchemaArtifact.findUnique({
          where: {
            routeKey_version: { routeKey: route.routeKey, version: route.outputSchemaVersion },
          },
        }),
      ).resolves.toMatchObject({ schemaHash: route.outputSchemaHash });
      await expect(
        client.analysisPromptArtifact.findUnique({
          where: { routeKey_version: { routeKey: route.routeKey, version: route.promptVersion } },
        }),
      ).resolves.toMatchObject({ bodyHash: route.promptHash });
      await expect(
        client.aiRoute.findUnique({
          where: {
            routeKey_level_scopeId: {
              routeKey: route.routeKey,
              level: "system",
              scopeId: systemScopeId,
            },
          },
        }),
      ).resolves.not.toBeNull();
    }
  });
});
