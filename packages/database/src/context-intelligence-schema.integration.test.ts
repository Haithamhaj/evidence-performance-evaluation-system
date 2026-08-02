import { afterAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "./index.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

afterAll(async () => client.$disconnect());

const contextTables = [
  "ContextAnalysis",
  "ProjectLinkSuggestion",
  "TaskDraft",
  "SourceLinkCorrection",
] as const;

function databaseConstraint(error: unknown): boolean {
  if (error instanceof Error && /constraint|foreign key|invalid|lineage/iu.test(error.message)) {
    return true;
  }
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && ["P2003", "P2010"].includes(String(error.code))) return true;
  if ("cause" in error) return databaseConstraint(error.cause);
  if ("meta" in error) return databaseConstraint(error.meta);
  return "driverAdapterError" in error && databaseConstraint(error.driverAdapterError);
}

type Fixture = Readonly<{
  employeeId: string;
  projectId: string;
  correctedProjectId: string;
  sourceItemId: string;
  analysisRunId: string;
  suggestionRunId: string;
  taskDraftRunId: string;
}>;

const outputVersions = {
  analysis: {
    schemaVersion: "context-analysis-output.v1",
    promptVersion: "context-summary-prompt.v1",
  },
  suggestion: {
    schemaVersion: "project-link-suggestion-output.v1",
    promptVersion: "context-project-match-prompt.v1",
  },
  taskDraft: {
    schemaVersion: "task-draft-output.v1",
    promptVersion: "task-draft-prompt.v1",
  },
} as const;

async function seedFixture(): Promise<Fixture> {
  const suffix = crypto.randomUUID();
  const employee = await client.user.create({
    data: {
      email: `context-intelligence-${suffix}@example.invalid`,
      displayName: "Context Intelligence Employee",
    },
  });
  const organization = await client.organization.create({
    data: { key: `context-intelligence-org-${suffix}`, name: "Context Intelligence Org" },
  });
  const department = await client.department.create({
    data: {
      key: `context-intelligence-dept-${suffix}`,
      name: "Context Intelligence Department",
      organizationId: organization.id,
    },
  });
  const systemScope = await client.authorizationScope.create({
    data: { key: `context-intelligence-system-${suffix}`, scopeType: "system" },
  });
  const projectId = crypto.randomUUID();
  const correctedProjectId = crypto.randomUUID();
  await client.authorizationScope.createMany({
    data: [
      {
        id: projectId,
        key: `context-intelligence-project-${suffix}`,
        scopeType: "project",
        departmentId: department.id,
      },
      {
        id: correctedProjectId,
        key: `context-intelligence-corrected-project-${suffix}`,
        scopeType: "project",
        departmentId: department.id,
      },
    ],
  });
  await client.project.createMany({
    data: [
      {
        id: projectId,
        organizationId: organization.id,
        departmentId: department.id,
        authorizationScopeId: projectId,
        authorizationScopeType: "project",
        name: "Original Context Project",
        description: "Context Intelligence fixture",
        status: "active",
        createdById: employee.id,
      },
      {
        id: correctedProjectId,
        organizationId: organization.id,
        departmentId: department.id,
        authorizationScopeId: correctedProjectId,
        authorizationScopeType: "project",
        name: "Corrected Context Project",
        description: "Context Intelligence fixture",
        status: "active",
        createdById: employee.id,
      },
    ],
  });

  const accountId = crypto.randomUUID();
  const sourceItemId = crypto.randomUUID();
  await client.$executeRaw`
    INSERT INTO "ConnectedWorkAccount" (
      "id", "employeeId", "credentialRef", "connectedAt", "createdAt", "updatedAt"
    ) VALUES (
      ${accountId}::uuid,
      ${employee.id}::uuid,
      ${`vault://context-intelligence/${suffix}`},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;
  await client.$executeRaw`
    INSERT INTO "ConnectedSourceItem" (
      "id", "connectedWorkAccountId", "employeeId", "provider", "providerSourceId",
      "occurredAt", "titleCiphertext", "titleKeyVersion", "summaryCiphertext",
      "summaryKeyVersion", "sourceUrl", "privacy", "reviewState", "excluded",
      "createdAt", "updatedAt"
    ) VALUES (
      ${sourceItemId}::uuid,
      ${accountId}::uuid,
      ${employee.id}::uuid,
      'GOOGLE_GMAIL'::"ConnectedSourceProvider",
      ${`source-${suffix}`},
      CURRENT_TIMESTAMP,
      'sealed-title',
      'context-key-v1',
      'sealed-summary',
      'context-key-v1',
      'https://workspace.google.com/source',
      'PRIVATE'::"ConnectedSourcePrivacy",
      'pending'::"ConnectedSourceReviewState",
      false,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;

  const routeKey = `context.fixture.${suffix}`;
  const route = await client.aiRoute.create({
    data: { routeKey, level: "system", scopeId: systemScope.id },
  });
  const routeConfig = await client.aiRouteConfig.create({
    data: { routeId: route.id, version: 1, reason: "Context fixture", createdById: employee.id },
  });
  const provider = await client.aiProviderConfig.create({
    data: {
      providerKey: `context-fixture-${suffix}`,
      version: 1,
      adapterKey: "fixture",
      modelKey: "fixture-model",
      locality: "external",
      endpoint: "https://provider.example.invalid/v1/chat/completions",
      endpointProtocol: "https",
      endpointHost: "provider.example.invalid",
      reason: "Context fixture",
      createdById: employee.id,
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

  const runIds = {} as Record<keyof typeof outputVersions, string>;
  for (const [kind, versions] of Object.entries(outputVersions) as Array<
    [keyof typeof outputVersions, (typeof outputVersions)[keyof typeof outputVersions]]
  >) {
    const artifact = await client.aiOutputSchemaArtifact.create({
      data: {
        routeKey,
        version: versions.schemaVersion,
        schemaHash: kind
          .repeat(64)
          .slice(0, 64)
          .replaceAll(/[^a-f0-9]/gu, "a"),
        schemaArtifact: {},
        reason: "Context fixture schema",
        expectedBehavior: "Produces one governed Context Intelligence fixture output.",
        evaluationEvidenceReferences: [`ai-eval:${crypto.randomUUID()}`],
        humanApprovalPolicy: "feature_defined",
        createdById: employee.id,
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
        outputSchemaVersion: versions.schemaVersion,
        outputSchemaArtifactId: artifact.id,
        outputSchemaHash: artifact.schemaHash,
        promptTemplateVersion: versions.promptVersion,
        sourceReferences: [`connected-source:${sourceItemId}`],
        outputReference: `context-output:${crypto.randomUUID()}`,
        startedAt: new Date(),
        completedAt: new Date(),
        latencyMs: 0,
        state: "succeeded",
        fallbackChain: [],
        humanApprovalState: "pending",
        correlationId: crypto.randomUUID(),
        validationIssueCodes: [],
      },
    });
    runIds[kind] = run.id;
  }

  return {
    employeeId: employee.id,
    projectId,
    correctedProjectId,
    sourceItemId,
    analysisRunId: runIds.analysis,
    suggestionRunId: runIds.suggestion,
    taskDraftRunId: runIds.taskDraft,
  };
}

async function insertAnalysis(
  fixture: Fixture,
  overrides: Partial<{ id: string; schemaVersion: string; promptVersion: string }> = {},
): Promise<string> {
  const id = overrides.id ?? crypto.randomUUID();
  await client.$executeRaw`
    INSERT INTO "ContextAnalysis" (
      "id", "sourceItemId", "employeeId", "revision", "schemaVersion", "promptVersion",
      "aiRunTraceId", "outputCiphertext", "outputKeyVersion", "sourceReferences",
      "reviewStatus", "revisionOrigin", "createdById"
    ) VALUES (
      ${id}::uuid,
      ${fixture.sourceItemId}::uuid,
      ${fixture.employeeId}::uuid,
      1,
      ${overrides.schemaVersion ?? outputVersions.analysis.schemaVersion},
      ${overrides.promptVersion ?? outputVersions.analysis.promptVersion},
      ${fixture.analysisRunId}::uuid,
      'sealed-analysis',
      'context-key-v1',
      ${JSON.stringify([`connected-source:${fixture.sourceItemId}`])}::jsonb,
      'PENDING'::"ContextIntelligenceReviewStatus",
      'AI'::"ContextIntelligenceRevisionOrigin",
      ${fixture.employeeId}::uuid
    )
  `;
  return id;
}

async function insertSuggestion(
  fixture: Fixture,
  analysisId: string,
  input: Readonly<{
    id?: string;
    projectId?: string;
    anchors?: unknown;
    revision?: number;
    supersedesSuggestionId?: string | null;
    schemaVersion?: string;
    promptVersion?: string;
  }> = {},
): Promise<string> {
  const id = input.id ?? crypto.randomUUID();
  const projectId = input.projectId ?? fixture.projectId;
  const anchors = input.anchors ?? [
    {
      kind: "EXPLICIT_USER_MAPPING",
      reference: `connected-source:${fixture.sourceItemId}`,
      conflicts: false,
    },
  ];
  await client.$executeRaw`
    INSERT INTO "ProjectLinkSuggestion" (
      "id", "analysisId", "sourceItemId", "employeeId", "projectId", "decision",
      "explanationCiphertext", "explanationKeyVersion", "anchors", "revision",
      "schemaVersion", "promptVersion", "aiRunTraceId", "sourceReferences", "reviewStatus",
      "revisionOrigin", "supersedesSuggestionId", "createdById"
    ) VALUES (
      ${id}::uuid,
      ${analysisId}::uuid,
      ${fixture.sourceItemId}::uuid,
      ${fixture.employeeId}::uuid,
      ${projectId}::uuid,
      'AUTO_LINK'::"ProjectLinkDecision",
      'sealed-explanation',
      'context-key-v1',
      ${JSON.stringify(anchors)}::jsonb,
      ${input.revision ?? 1},
      ${input.schemaVersion ?? outputVersions.suggestion.schemaVersion},
      ${input.promptVersion ?? outputVersions.suggestion.promptVersion},
      ${fixture.suggestionRunId}::uuid,
      ${JSON.stringify([`connected-source:${fixture.sourceItemId}`])}::jsonb,
      'PENDING'::"ContextIntelligenceReviewStatus",
      'AI'::"ContextIntelligenceRevisionOrigin",
      ${input.supersedesSuggestionId ?? null}::uuid,
      ${fixture.employeeId}::uuid
    )
  `;
  return id;
}

describe("context intelligence schema", () => {
  it("persists governed versions, AI route trace, sources, review status, and superseding revisions", async () => {
    const columns = await client.$queryRaw<
      Array<{ table_name: string; column_name: string; is_nullable: string }>
    >`
      SELECT table_name, column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN (
          'ContextAnalysis',
          'ProjectLinkSuggestion',
          'TaskDraft',
          'SourceLinkCorrection'
        )
      ORDER BY table_name, ordinal_position
    `;
    const names = new Set(
      columns.map(({ table_name, column_name }) => `${table_name}.${column_name}`),
    );

    for (const table of ["ContextAnalysis", "ProjectLinkSuggestion", "TaskDraft"] as const) {
      expect(names).toContain(`${table}.schemaVersion`);
      expect(names).toContain(`${table}.promptVersion`);
      expect(names).toContain(`${table}.aiRunTraceId`);
      expect(names).toContain(`${table}.sourceReferences`);
      expect(names).toContain(`${table}.reviewStatus`);
      expect(names).toContain(`${table}.revision`);
    }
    expect(names).toContain("ContextAnalysis.supersedesAnalysisId");
    expect(names).toContain("ProjectLinkSuggestion.supersedesSuggestionId");
    expect(names).toContain("TaskDraft.supersedesTaskDraftId");
    expect(names).toContain("SourceLinkCorrection.correctedById");
    expect(names).toContain("ContextAnalysis.outputCiphertext");
    expect(names).toContain("ContextAnalysis.outputKeyVersion");
    expect(names).toContain("ProjectLinkSuggestion.explanationCiphertext");
    expect(names).toContain("ProjectLinkSuggestion.explanationKeyVersion");
    expect(names).toContain("TaskDraft.draftCiphertext");
    expect(names).toContain("TaskDraft.draftKeyVersion");
    expect(names).toContain("SourceLinkCorrection.reasonCiphertext");
    expect(names).toContain("SourceLinkCorrection.reasonKeyVersion");
    expect(names).toContain("SourceLinkCorrection.supersedingSuggestionId");

    for (const forbiddenPlaintextColumn of [
      "ContextAnalysis.summary",
      "ContextAnalysis.uncertainties",
      "ProjectLinkSuggestion.explanation",
      "TaskDraft.title",
      "TaskDraft.description",
      "TaskDraft.acceptanceConditions",
      "TaskDraft.uncertainties",
      "SourceLinkCorrection.reason",
      "ContextAnalysis.correctionReason",
      "ProjectLinkSuggestion.correctionReason",
      "TaskDraft.correctionReason",
    ]) {
      expect(names).not.toContain(forbiddenPlaintextColumn);
    }
  });

  it("retains governed output and employee corrections as append-only history", async () => {
    const triggerEvents = await client.$queryRaw<
      Array<{ event_object_table: string; event_manipulation: string }>
    >`
      SELECT event_object_table, event_manipulation
      FROM information_schema.triggers
      WHERE event_object_schema = 'public'
        AND event_object_table IN (
          'ContextAnalysis',
          'ProjectLinkSuggestion',
          'TaskDraft',
          'SourceLinkCorrection'
        )
        AND event_manipulation IN ('UPDATE', 'DELETE')
      ORDER BY event_object_table, event_manipulation
    `;

    for (const table of contextTables) {
      expect(
        triggerEvents
          .filter(({ event_object_table }) => event_object_table === table)
          .map(({ event_manipulation }) => event_manipulation),
      ).toEqual(["DELETE", "UPDATE"]);
    }
  });

  it("uses restrictive foreign keys and employee-owned correction constraints", async () => {
    const foreignKeys = await client.$queryRaw<Array<{ table_name: string; delete_rule: string }>>`
      SELECT tc.table_name, rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_schema = tc.constraint_schema
       AND rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_schema = 'public'
        AND tc.table_name IN (
          'ContextAnalysis',
          'ProjectLinkSuggestion',
          'TaskDraft',
          'SourceLinkCorrection'
        )
    `;
    expect(foreignKeys.length).toBeGreaterThanOrEqual(16);
    expect(foreignKeys.every(({ delete_rule }) => delete_rule === "RESTRICT")).toBe(true);

    const constraints = await client.$queryRaw<Array<{ constraint_name: string }>>`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND constraint_name IN (
          'ContextAnalysis_nonempty_sources',
          'ProjectLinkSuggestion_nonempty_sources',
          'TaskDraft_nonempty_sources',
          'SourceLinkCorrection_employee_owned',
          'SourceLinkCorrection_nonempty_sources'
        )
      ORDER BY constraint_name
    `;
    expect(constraints).toHaveLength(5);
  });

  it("contains no rating, ranking, productivity, or employee-judgment columns", async () => {
    const forbiddenColumns = await client.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN (
          'ContextAnalysis',
          'ProjectLinkSuggestion',
          'TaskDraft',
          'SourceLinkCorrection'
        )
        AND column_name ~* '(rating|rank|productivity|employee.?judg)'
    `;
    expect(forbiddenColumns).toEqual([]);
  });

  it("rejects malformed, duplicate, or conflicting AUTO_LINK anchors at the database boundary", async () => {
    const fixture = await seedFixture();
    const analysisId = await insertAnalysis(fixture);
    const reference = `connected-source:${fixture.sourceItemId}`;

    await expect(
      insertSuggestion(fixture, analysisId, {
        anchors: [
          { kind: "CALENDAR_CONTEXT", reference, conflicts: false },
          { kind: "CALENDAR_CONTEXT", reference, conflicts: false },
        ],
      }),
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      insertSuggestion(fixture, analysisId, {
        anchors: [
          { kind: "CALENDAR_CONTEXT", conflicts: false },
          { kind: "EXPLICIT_PROJECT_REFERENCE", reference, conflicts: false },
        ],
      }),
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      insertSuggestion(fixture, analysisId, {
        anchors: [
          { kind: "CALENDAR_CONTEXT", reference, conflicts: false },
          { kind: "EXPLICIT_PROJECT_REFERENCE", reference, conflicts: true },
        ],
      }),
    ).rejects.toSatisfy(databaseConstraint);

    await expect(
      insertSuggestion(fixture, analysisId, {
        anchors: [{ kind: "EXPLICIT_USER_MAPPING", reference, conflicts: false }],
      }),
    ).resolves.toEqual(expect.any(String));

    const independentFixture = await seedFixture();
    const independentAnalysisId = await insertAnalysis(independentFixture);
    const independentReference = `connected-source:${independentFixture.sourceItemId}`;
    await expect(
      insertSuggestion(independentFixture, independentAnalysisId, {
        anchors: [
          { kind: "CALENDAR_CONTEXT", reference: independentReference, conflicts: false },
          {
            kind: "EXPLICIT_PROJECT_REFERENCE",
            reference: independentReference,
            conflicts: false,
          },
        ],
      }),
    ).resolves.toEqual(expect.any(String));
  });

  it("binds every governed output schema and prompt version to its traced AI run", async () => {
    const fixture = await seedFixture();

    await expect(
      insertAnalysis(fixture, { schemaVersion: "context-analysis-output.v2" }),
    ).rejects.toSatisfy(databaseConstraint);
    const analysisId = await insertAnalysis(fixture);

    await expect(
      insertSuggestion(fixture, analysisId, { promptVersion: "context-project-match-prompt.v2" }),
    ).rejects.toSatisfy(databaseConstraint);
    await expect(insertSuggestion(fixture, analysisId)).resolves.toEqual(expect.any(String));

    await expect(
      client.$executeRaw`
        INSERT INTO "TaskDraft" (
          "id", "sourceItemId", "employeeId", "draftCiphertext", "draftKeyVersion",
          "revision", "schemaVersion", "promptVersion", "aiRunTraceId", "sourceReferences",
          "reviewStatus", "revisionOrigin", "createdById"
        ) VALUES (
          ${crypto.randomUUID()}::uuid,
          ${fixture.sourceItemId}::uuid,
          ${fixture.employeeId}::uuid,
          'sealed-draft',
          'context-key-v1',
          1,
          ${outputVersions.taskDraft.schemaVersion},
          'task-draft-prompt.v2',
          ${fixture.taskDraftRunId}::uuid,
          ${JSON.stringify([`connected-source:${fixture.sourceItemId}`])}::jsonb,
          'PENDING'::"ContextIntelligenceReviewStatus",
          'AI'::"ContextIntelligenceRevisionOrigin",
          ${fixture.employeeId}::uuid
        )
      `,
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      client.$executeRaw`
        INSERT INTO "TaskDraft" (
          "id", "sourceItemId", "employeeId", "draftCiphertext", "draftKeyVersion",
          "revision", "schemaVersion", "promptVersion", "aiRunTraceId", "sourceReferences",
          "reviewStatus", "revisionOrigin", "createdById"
        ) VALUES (
          ${crypto.randomUUID()}::uuid,
          ${fixture.sourceItemId}::uuid,
          ${fixture.employeeId}::uuid,
          'sealed-draft',
          'context-key-v1',
          1,
          ${outputVersions.taskDraft.schemaVersion},
          ${outputVersions.taskDraft.promptVersion},
          ${fixture.taskDraftRunId}::uuid,
          ${JSON.stringify([`connected-source:${fixture.sourceItemId}`])}::jsonb,
          'PENDING'::"ContextIntelligenceReviewStatus",
          'AI'::"ContextIntelligenceRevisionOrigin",
          ${fixture.employeeId}::uuid
        )
      `,
    ).resolves.toBe(1);
  });

  it("proves a correction's superseding suggestion is the direct later revision and target", async () => {
    const fixture = await seedFixture();
    const analysisId = await insertAnalysis(fixture);
    const originalSuggestionId = await insertSuggestion(fixture, analysisId);
    const directSuggestionId = await insertSuggestion(fixture, analysisId, {
      projectId: fixture.correctedProjectId,
      revision: 2,
      supersedesSuggestionId: originalSuggestionId,
    });
    const laterSuggestionId = await insertSuggestion(fixture, analysisId, {
      projectId: fixture.correctedProjectId,
      revision: 3,
      supersedesSuggestionId: directSuggestionId,
    });

    const insertCorrection = (
      supersedingSuggestionId: string,
      correctedProjectId: string,
    ): Promise<number> =>
      client.$executeRaw`
        INSERT INTO "SourceLinkCorrection" (
          "id", "suggestionId", "sourceItemId", "employeeId", "previousProjectId",
          "correctedProjectId", "action", "reasonCiphertext", "reasonKeyVersion",
          "sourceReferences", "supersedingSuggestionId", "correctedById"
        ) VALUES (
          ${crypto.randomUUID()}::uuid,
          ${originalSuggestionId}::uuid,
          ${fixture.sourceItemId}::uuid,
          ${fixture.employeeId}::uuid,
          ${fixture.projectId}::uuid,
          ${correctedProjectId}::uuid,
          'CORRECT'::"SourceLinkCorrectionAction",
          'sealed-correction-reason',
          'context-key-v1',
          ${JSON.stringify([`connected-source:${fixture.sourceItemId}`])}::jsonb,
          ${supersedingSuggestionId}::uuid,
          ${fixture.employeeId}::uuid
        )
      `;

    await expect(insertCorrection(originalSuggestionId, fixture.projectId)).rejects.toSatisfy(
      databaseConstraint,
    );
    await expect(insertCorrection(laterSuggestionId, fixture.correctedProjectId)).rejects.toSatisfy(
      databaseConstraint,
    );
    await expect(insertCorrection(directSuggestionId, fixture.projectId)).rejects.toSatisfy(
      databaseConstraint,
    );
    await expect(insertCorrection(directSuggestionId, fixture.correctedProjectId)).resolves.toBe(1);
  });
});
