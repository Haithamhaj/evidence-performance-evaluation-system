import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient } from "@evaluation/database";
import { afterAll, describe, expect, it } from "vitest";

import { ConnectedWorkConnectionService } from "./connection-service.js";
import { DevelopmentOnlyMemoryCredentialVault } from "./credential-vault.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const now = new Date("2026-07-20T09:00:00.000Z");

async function seedConnectionGraph() {
  const suffix = crypto.randomUUID();
  const organizationId = crypto.randomUUID();
  const departmentId = crypto.randomUUID();
  const employeeId = crypto.randomUUID();
  const otherEmployeeId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const otherProjectId = crypto.randomUUID();

  await client.organization.create({
    data: { id: organizationId, key: `context-org-${suffix}`, name: "Context" },
  });
  await client.department.create({
    data: {
      id: departmentId,
      key: `context-dept-${suffix}`,
      name: "Context",
      organizationId,
    },
  });
  await client.user.createMany({
    data: [
      {
        id: employeeId,
        email: `context-owner-${suffix}@example.invalid`,
        displayName: "Context Owner",
      },
      {
        id: otherEmployeeId,
        email: `context-other-${suffix}@example.invalid`,
        displayName: "Other Employee",
      },
    ],
  });
  await client.authorizationScope.createMany({
    data: [
      {
        id: projectId,
        key: `context-project-${suffix}`,
        scopeType: "project",
        departmentId,
      },
      {
        id: otherProjectId,
        key: `context-other-project-${suffix}`,
        scopeType: "project",
        departmentId,
      },
    ],
  });
  await client.project.createMany({
    data: [
      {
        id: projectId,
        organizationId,
        departmentId,
        authorizationScopeId: projectId,
        name: "Private context project",
        description: "",
        status: "active",
        createdById: employeeId,
      },
      {
        id: otherProjectId,
        organizationId,
        departmentId,
        authorizationScopeId: otherProjectId,
        name: "Corrected private context project",
        description: "",
        status: "active",
        createdById: employeeId,
      },
    ],
  });
  await client.projectMember.createMany({
    data: [projectId, otherProjectId].map((memberProjectId) => ({
      projectId: memberProjectId,
      employeeId,
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      reason: "Active contributor",
      createdById: employeeId,
    })),
  });

  return {
    organizationId,
    departmentId,
    employeeId,
    otherEmployeeId,
    projectId,
    otherProjectId,
  };
}

async function seedSuggestionLineage(
  graph: Awaited<ReturnType<typeof seedConnectionGraph>>,
  sourceItemId: string,
  suggestionIds: readonly [string, string],
) {
  const suffix = crypto.randomUUID();
  const systemScope = await client.authorizationScope.create({
    data: { key: `context-link-system-${suffix}`, scopeType: "system" },
  });
  const routeKey = `context.link.fixture.${suffix}`;
  const route = await client.aiRoute.create({
    data: { routeKey, level: "system", scopeId: systemScope.id },
  });
  const routeConfig = await client.aiRouteConfig.create({
    data: {
      routeId: route.id,
      version: 1,
      reason: "Derived-link fixture",
      createdById: graph.employeeId,
    },
  });
  const provider = await client.aiProviderConfig.create({
    data: {
      providerKey: `context-link-provider-${suffix}`,
      version: 1,
      adapterKey: "fixture",
      modelKey: "fixture-model",
      locality: "external",
      endpoint: "https://provider.example.invalid/v1/chat/completions",
      endpointProtocol: "https",
      endpointHost: "provider.example.invalid",
      reason: "Derived-link fixture",
      createdById: graph.employeeId,
    },
  });
  const routeProvider = await client.aiRouteConfigProvider.create({
    data: {
      routeConfigId: routeConfig.id,
      position: 0,
      providerConfigId: provider.id,
      providerConfigVersion: provider.version,
    },
  });
  const schemaVersion = "context-link-fixture-output.v1";
  const promptVersion = "context-link-fixture-prompt.v1";
  const artifact = await client.aiOutputSchemaArtifact.create({
    data: {
      routeKey,
      version: schemaVersion,
      schemaHash: "a".repeat(64),
      schemaArtifact: {},
      reason: "Derived-link fixture",
      expectedBehavior: "Provides governed lineage for a derived-link integration fixture.",
      evaluationEvidenceReferences: [`ai-eval:${crypto.randomUUID()}`],
      humanApprovalPolicy: "feature_defined",
      createdById: graph.employeeId,
    },
  });
  const run = await client.aiRun.create({
    data: {
      routeKey,
      routeId: route.id,
      routeConfigId: routeConfig.id,
      routeConfigVersion: routeConfig.version,
      routeLevel: "system",
      scopeId: systemScope.id,
      routeConfigProviderId: routeProvider.id,
      providerConfigId: provider.id,
      providerConfigVersion: provider.version,
      classification: "confidential",
      inputReference: `connected-source:${sourceItemId}`,
      inputSchemaVersion: "context-input.v1",
      outputSchemaVersion: schemaVersion,
      outputSchemaArtifactId: artifact.id,
      outputSchemaHash: artifact.schemaHash,
      promptTemplateVersion: promptVersion,
      sourceReferences: [`connected-source:${sourceItemId}`],
      outputReference: `context-output:${crypto.randomUUID()}`,
      startedAt: now,
      completedAt: now,
      latencyMs: 0,
      state: "succeeded",
      fallbackChain: [],
      humanApprovalState: "pending",
      correlationId: crypto.randomUUID(),
      validationIssueCodes: [],
    },
  });
  const analysis = await client.contextAnalysis.create({
    data: {
      sourceItemId,
      employeeId: graph.employeeId,
      revision: 1,
      schemaVersion,
      promptVersion,
      aiRunTraceId: run.id,
      outputCiphertext: "protected-analysis",
      outputKeyVersion: "test-only",
      sourceReferences: [`connected-source:${sourceItemId}`],
      reviewStatus: "PENDING",
      revisionOrigin: "AI",
      createdById: graph.employeeId,
    },
  });
  await client.projectLinkSuggestion.createMany({
    data: [
      {
        id: suggestionIds[0],
        analysisId: analysis.id,
        sourceItemId,
        employeeId: graph.employeeId,
        projectId: null,
        decision: "NO_MATCH",
        explanationCiphertext: "protected-suggestion-one",
        explanationKeyVersion: "test-only",
        anchors: [],
        revision: 1,
        schemaVersion,
        promptVersion,
        aiRunTraceId: run.id,
        sourceReferences: [`connected-source:${sourceItemId}`],
        reviewStatus: "PENDING",
        revisionOrigin: "AI",
        createdById: graph.employeeId,
      },
      {
        id: suggestionIds[1],
        analysisId: analysis.id,
        sourceItemId,
        employeeId: graph.employeeId,
        projectId: null,
        decision: "NO_MATCH",
        explanationCiphertext: "protected-suggestion-two",
        explanationKeyVersion: "test-only",
        anchors: [],
        revision: 2,
        schemaVersion,
        promptVersion,
        aiRunTraceId: run.id,
        sourceReferences: [`connected-source:${sourceItemId}`],
        reviewStatus: "PENDING",
        revisionOrigin: "AI",
        supersedesSuggestionId: suggestionIds[0],
        createdById: graph.employeeId,
      },
    ],
  });
}

function projectAuthorization() {
  return {
    canLink: async (employeeId: string, projectId: string, at: Date) =>
      (await client.projectMember.count({
        where: {
          employeeId,
          projectId,
          startsAt: { lte: at },
          OR: [{ endsAt: null }, { endsAt: { gt: at } }],
        },
      })) > 0,
  };
}

afterAll(async () => client.$disconnect());

describe("connected work connection commands", () => {
  it("replaces and removes only derived Project links while preserving manual mappings", async () => {
    const graph = await seedConnectionGraph();
    const vault = new DevelopmentOnlyMemoryCredentialVault({ runtimeMode: "development" });
    const service = new ConnectedWorkConnectionService({
      database: client,
      credentialVault: vault,
      auditWriter: databaseAuditWriter,
      projectAuthorization: projectAuthorization(),
      clock: () => now,
    });
    const actor = { userId: graph.employeeId, active: true };
    const credentialRef = (
      await vault.put({
        credential: { accessToken: "derived-link", refreshToken: null, expiresAt: null },
      })
    ).credentialRef;
    const account = await client.connectedWorkAccount.create({
      data: { employeeId: graph.employeeId, credentialRef, connectedAt: now },
    });
    const [derivedSource, manualSource] = await Promise.all(
      ["derived-source", "manual-source"].map((providerSourceId) =>
        client.connectedSourceItem.create({
          data: {
            connectedWorkAccountId: account.id,
            employeeId: graph.employeeId,
            provider: "GOOGLE_GMAIL",
            providerSourceId,
            occurredAt: now,
            titleCiphertext: "protected",
            titleKeyVersion: "test-only",
          },
        }),
      ),
    );
    if (derivedSource === undefined || manualSource === undefined) {
      throw new Error("Connected Context source fixture is incomplete");
    }
    const firstSuggestionId = crypto.randomUUID();
    const correctedSuggestionId = crypto.randomUUID();
    await seedSuggestionLineage(graph, derivedSource.id, [
      firstSuggestionId,
      correctedSuggestionId,
    ]);
    type DerivedLinkCommands = {
      confirmSuggestedProject(
        transaction: import("@evaluation/database").DatabaseTransaction,
        command: Record<string, unknown>,
      ): Promise<unknown>;
      replaceSuggestedProject(
        transaction: import("@evaluation/database").DatabaseTransaction,
        command: Record<string, unknown>,
      ): Promise<unknown>;
      removeSuggestedProject(
        transaction: import("@evaluation/database").DatabaseTransaction,
        command: Record<string, unknown>,
      ): Promise<unknown>;
    };
    const derivedCommands = service as unknown as DerivedLinkCommands;

    await client.$transaction((transaction) =>
      derivedCommands.confirmSuggestedProject(transaction, {
        actor,
        correlationId: crypto.randomUUID(),
        sourceItemId: derivedSource.id,
        projectId: graph.projectId,
        suggestionId: firstSuggestionId,
      }),
    );
    await client.$transaction((transaction) =>
      derivedCommands.replaceSuggestedProject(transaction, {
        actor,
        correlationId: crypto.randomUUID(),
        sourceItemId: derivedSource.id,
        expectedSuggestionId: firstSuggestionId,
        replacementSuggestionId: correctedSuggestionId,
        projectId: graph.otherProjectId,
      }),
    );
    await expect(
      client.sourceProjectLink.findFirstOrThrow({
        where: { sourceItemId: derivedSource.id, unlinkedAt: null },
      }),
    ).resolves.toMatchObject({
      projectId: graph.otherProjectId,
      origin: "CONTEXT_SUGGESTION",
      contextSuggestionId: correctedSuggestionId,
    });
    await client.$transaction((transaction) =>
      derivedCommands.removeSuggestedProject(transaction, {
        actor,
        correlationId: crypto.randomUUID(),
        sourceItemId: derivedSource.id,
        expectedSuggestionId: correctedSuggestionId,
      }),
    );
    await expect(
      client.sourceProjectLink.count({
        where: { sourceItemId: derivedSource.id, unlinkedAt: null },
      }),
    ).resolves.toBe(0);

    const manual = await service.linkProject({
      actor,
      correlationId: crypto.randomUUID(),
      sourceItemId: manualSource.id,
      projectId: graph.projectId,
      reason: "Employee selected this mapping manually",
    });
    await client.$transaction((transaction) =>
      derivedCommands.replaceSuggestedProject(transaction, {
        actor,
        correlationId: crypto.randomUUID(),
        sourceItemId: manualSource.id,
        expectedSuggestionId: firstSuggestionId,
        replacementSuggestionId: correctedSuggestionId,
        projectId: graph.otherProjectId,
      }),
    );
    await client.$transaction((transaction) =>
      derivedCommands.removeSuggestedProject(transaction, {
        actor,
        correlationId: crypto.randomUUID(),
        sourceItemId: manualSource.id,
        expectedSuggestionId: correctedSuggestionId,
      }),
    );
    await expect(
      client.sourceProjectLink.findUniqueOrThrow({ where: { id: manual.id } }),
    ).resolves.toMatchObject({ projectId: graph.projectId, unlinkedAt: null });
  });

  it("audits connection, exclusions, reversible Project links, disconnection, and credential revocation without private content", async () => {
    const graph = await seedConnectionGraph();
    const vault = new DevelopmentOnlyMemoryCredentialVault({ runtimeMode: "development" });
    const service = new ConnectedWorkConnectionService({
      database: client,
      credentialVault: vault,
      auditWriter: databaseAuditWriter,
      projectAuthorization: projectAuthorization(),
      clock: () => now,
    });
    const accessToken = "private-access-value";
    const refreshToken = "private-refresh-value";
    const privateExclusionId = "private-label-identifier";
    const privateTitle = "Private customer meeting";
    const privateSummary = "Confidential follow-up";
    const privateSourceUrl = "https://mail.example.invalid/private/thread";
    const privateProviderSourceId = "private-provider-source-id";
    const privateLinkReason = "Private customer details drove this choice";
    const privateUnlinkReason = "Private customer context changed";
    const actor = { userId: graph.employeeId, active: true };

    const connection = await service.connect({
      actor,
      correlationId: crypto.randomUUID(),
      credential: {
        accessToken,
        refreshToken,
        expiresAt: "2026-07-20T10:00:00.000Z",
      },
    });
    const stored = await client.connectedWorkAccount.findUniqueOrThrow({
      where: { id: connection.id },
    });
    expect(stored.credentialRef).not.toContain(accessToken);
    expect(stored.credentialRef).not.toContain(refreshToken);

    const sourceItem = await client.connectedSourceItem.create({
      data: {
        connectedWorkAccountId: connection.id,
        employeeId: graph.employeeId,
        provider: "GOOGLE_GMAIL",
        providerSourceId: privateProviderSourceId,
        occurredAt: now,
        titleCiphertext: privateTitle,
        titleKeyVersion: "test-only",
        summaryCiphertext: privateSummary,
        summaryKeyVersion: "test-only",
        sourceUrl: privateSourceUrl,
      },
    });

    await service.setSourceExclusion({
      actor,
      correlationId: crypto.randomUUID(),
      provider: "GOOGLE_GMAIL",
      kind: "GMAIL_LABEL",
      providerExclusionId: privateExclusionId,
      excluded: true,
    });
    await service.setSourceExclusion({
      actor,
      correlationId: crypto.randomUUID(),
      provider: "GOOGLE_GMAIL",
      kind: "GMAIL_LABEL",
      providerExclusionId: privateExclusionId,
      excluded: true,
    });
    await service.setItemExclusion({
      actor,
      correlationId: crypto.randomUUID(),
      sourceItemId: sourceItem.id,
      excluded: true,
    });
    const link = await service.linkProject({
      actor,
      correlationId: crypto.randomUUID(),
      sourceItemId: sourceItem.id,
      projectId: graph.projectId,
      reason: privateLinkReason,
    });
    await service.linkProject({
      actor,
      correlationId: crypto.randomUUID(),
      sourceItemId: sourceItem.id,
      projectId: graph.projectId,
      reason: privateLinkReason,
    });
    await service.unlinkProject({
      actor,
      correlationId: crypto.randomUUID(),
      sourceItemId: sourceItem.id,
      reason: privateUnlinkReason,
    });
    await service.disconnect({ actor, correlationId: crypto.randomUUID() });

    await expect(vault.use(stored.credentialRef, async () => "available")).rejects.toMatchObject({
      code: "CREDENTIAL_REVOKED",
    });
    await expect(
      client.connectedWorkAccount.findUniqueOrThrow({ where: { id: connection.id } }),
    ).resolves.toMatchObject({
      disconnectedAt: now,
      contentInaccessibleAt: now,
    });
    await expect(
      client.sourceProjectLink.findUniqueOrThrow({ where: { id: link.id } }),
    ).resolves.toMatchObject({ unlinkedAt: now, unlinkedById: graph.employeeId });

    const auditRows = await client.auditEvent.findMany({
      where: { effectiveSubjectId: graph.employeeId },
      orderBy: { createdAt: "asc" },
      select: { eventType: true, reason: true, safeDiff: true },
    });
    expect(auditRows.map((row) => row.eventType)).toEqual([
      "connected_work_context.connected",
      "connected_work_context.source_exclusion_changed",
      "connected_work_context.item_exclusion_changed",
      "connected_work_context.project_linked",
      "connected_work_context.project_unlinked",
      "connected_work_context.disconnected",
      "connected_work_context.credential_revoked",
    ]);
    const serializedAudit = JSON.stringify(auditRows);
    for (const privateValue of [
      accessToken,
      refreshToken,
      privateExclusionId,
      privateTitle,
      privateSummary,
      privateSourceUrl,
      privateProviderSourceId,
      privateLinkReason,
      privateUnlinkReason,
    ]) {
      expect(serializedAudit).not.toContain(privateValue);
    }
  });

  it("denies another employee changes to an owner's exclusions and links", async () => {
    const graph = await seedConnectionGraph();
    const vault = new DevelopmentOnlyMemoryCredentialVault({ runtimeMode: "development" });
    const service = new ConnectedWorkConnectionService({
      database: client,
      credentialVault: vault,
      auditWriter: databaseAuditWriter,
      projectAuthorization: projectAuthorization(),
      clock: () => now,
    });
    const credentialRef = (
      await vault.put({
        credential: { accessToken: "owner-only", refreshToken: null, expiresAt: null },
      })
    ).credentialRef;
    const account = await client.connectedWorkAccount.create({
      data: {
        employeeId: graph.employeeId,
        credentialRef,
        connectedAt: now,
      },
    });
    await client.connectedWorkAccount.create({
      data: {
        employeeId: graph.otherEmployeeId,
        credentialRef: `vault://${crypto.randomUUID()}`,
        connectedAt: now,
      },
    });
    const sourceItem = await client.connectedSourceItem.create({
      data: {
        connectedWorkAccountId: account.id,
        employeeId: graph.employeeId,
        provider: "GOOGLE_CALENDAR",
        providerSourceId: "owner-event",
        occurredAt: now,
        titleCiphertext: "protected",
        titleKeyVersion: "test-only",
      },
    });
    const otherActor = { userId: graph.otherEmployeeId, active: true };

    await expect(
      service.setItemExclusion({
        actor: otherActor,
        correlationId: crypto.randomUUID(),
        sourceItemId: sourceItem.id,
        excluded: true,
      }),
    ).rejects.toMatchObject({ code: "CONNECTED_CONTEXT_FORBIDDEN" });
    await expect(
      service.linkProject({
        actor: otherActor,
        correlationId: crypto.randomUUID(),
        sourceItemId: sourceItem.id,
        projectId: graph.projectId,
        reason: "Not the owner",
      }),
    ).rejects.toMatchObject({ code: "CONNECTED_CONTEXT_FORBIDDEN" });
    await expect(
      client.connectedSourceItem.findUniqueOrThrow({ where: { id: sourceItem.id } }),
    ).resolves.toMatchObject({ excluded: false });
    await expect(
      client.sourceProjectLink.count({ where: { sourceItemId: sourceItem.id } }),
    ).resolves.toBe(0);
  });
});
