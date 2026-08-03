import { afterAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "./index.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

function databaseConstraint(error: unknown): boolean {
  if (error instanceof Error && /constraint|duplicate|foreign key|unique/iu.test(error.message)) {
    return true;
  }
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && ["P2002", "P2003", "P2010"].includes(String(error.code))) return true;
  if ("cause" in error) return databaseConstraint(error.cause);
  if ("meta" in error) return databaseConstraint(error.meta);
  return "driverAdapterError" in error && databaseConstraint(error.driverAdapterError);
}

type Fixture = Readonly<{
  ownerId: string;
  organizationId: string;
  departmentId: string;
  projectId: string;
  otherProjectId: string;
  installationId: string;
}>;

async function seedFixture(): Promise<Fixture> {
  const suffix = crypto.randomUUID();
  const owner = await client.user.create({
    data: {
      email: `github-integration-owner-${suffix}@example.invalid`,
      displayName: "GitHub Integration Owner",
    },
  });
  const organization = await client.organization.create({
    data: { key: `github-integration-organization-${suffix}`, name: "GitHub Integration" },
  });
  const department = await client.department.create({
    data: {
      key: `github-integration-department-${suffix}`,
      name: "GitHub Integration Department",
      organizationId: organization.id,
    },
  });
  const projectId = crypto.randomUUID();
  const otherProjectId = crypto.randomUUID();
  await client.authorizationScope.createMany({
    data: [
      {
        id: projectId,
        key: `github-integration-project-${suffix}`,
        scopeType: "project",
        departmentId: department.id,
      },
      {
        id: otherProjectId,
        key: `github-integration-other-project-${suffix}`,
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
        name: "GitHub Bound Project",
        description: "Schema fixture",
        status: "active",
        createdById: owner.id,
      },
      {
        id: otherProjectId,
        organizationId: organization.id,
        departmentId: department.id,
        authorizationScopeId: otherProjectId,
        authorizationScopeType: "project",
        name: "Other GitHub Bound Project",
        description: "Schema fixture",
        status: "active",
        createdById: owner.id,
      },
    ],
  });
  const installationId = crypto.randomUUID();
  await client.$executeRaw`
    INSERT INTO "GitHubAppInstallation" (
      "id", "installationId", "createdAt", "updatedAt"
    ) VALUES (
      ${installationId}::uuid, ${`github-installation-${suffix}`}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `;
  return {
    ownerId: owner.id,
    organizationId: organization.id,
    departmentId: department.id,
    projectId,
    otherProjectId,
    installationId,
  };
}

async function insertBinding(
  fixture: Fixture,
  overrides: Partial<{
    id: string;
    projectId: string;
    repositoryId: string;
    boundAt: Date;
    unboundAt: Date | null;
  }> = {},
): Promise<string> {
  const id = overrides.id ?? crypto.randomUUID();
  await client.$executeRaw`
    INSERT INTO "GitHubProjectBinding" (
      "id", "projectId", "installationId", "repositoryId", "boundAt", "unboundAt", "createdAt", "updatedAt"
    ) VALUES (
      ${id}::uuid,
      ${overrides.projectId ?? fixture.projectId}::uuid,
      ${fixture.installationId}::uuid,
      ${overrides.repositoryId ?? "repository-42"},
      ${overrides.boundAt ?? new Date()},
      ${overrides.unboundAt ?? null},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;
  return id;
}

afterAll(async () => client.$disconnect());

describe("GitHub integration schema", () => {
  it("keeps one active Project/repository binding while retaining prior bindings", async () => {
    const fixture = await seedFixture();
    const repositoryId = `repository-${crypto.randomUUID()}`;
    const historicalBindingId = await insertBinding(fixture, {
      repositoryId,
      boundAt: new Date("2026-06-01T00:00:00.000Z"),
      unboundAt: new Date("2026-07-01T00:00:00.000Z"),
    });
    const activeBindingId = await insertBinding(fixture, { repositoryId });

    expect(historicalBindingId).not.toBe(activeBindingId);
    await expect(insertBinding(fixture, { repositoryId })).rejects.toSatisfy(databaseConstraint);
  });

  it("allows a binding to close once without allowing its history to be reopened", async () => {
    const fixture = await seedFixture();
    const bindingId = await insertBinding(fixture, {
      repositoryId: `repository-${crypto.randomUUID()}`,
    });

    await client.$executeRaw`
      UPDATE "GitHubProjectBinding"
      SET "unboundAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${bindingId}::uuid
    `;
    await expect(
      client.$executeRaw`
        UPDATE "GitHubProjectBinding"
        SET "unboundAt" = NULL
        WHERE "id" = ${bindingId}::uuid
      `,
    ).rejects.toSatisfy(databaseConstraint);
  });

  it("does not allow an event-free binding history row to be deleted", async () => {
    const fixture = await seedFixture();
    const bindingId = await insertBinding(fixture, {
      repositoryId: `repository-${crypto.randomUUID()}`,
    });

    await expect(
      client.$executeRaw`
        DELETE FROM "GitHubProjectBinding"
        WHERE "id" = ${bindingId}::uuid
      `,
    ).rejects.toSatisfy(databaseConstraint);
  });

  it("does not allow creation history to change while closing a binding", async () => {
    const fixture = await seedFixture();
    const bindingId = await insertBinding(fixture, {
      repositoryId: `repository-${crypto.randomUUID()}`,
    });

    await expect(
      client.$executeRaw`
        UPDATE "GitHubProjectBinding"
        SET "unboundAt" = CURRENT_TIMESTAMP,
            "createdAt" = CURRENT_TIMESTAMP + INTERVAL '1 hour'
        WHERE "id" = ${bindingId}::uuid
      `,
    ).rejects.toSatisfy(databaseConstraint);
  });

  it("makes deliveries idempotent and preserves source identity, URL, verification, and governed facts", async () => {
    const fixture = await seedFixture();
    const repositoryId = `repository-${crypto.randomUUID()}`;
    const bindingId = await insertBinding(fixture, { repositoryId });
    const deliveryId = `delivery-${crypto.randomUUID()}`;
    const sourceId = "PR_kwDOExample";
    const sourceUrl = "https://github.com/leapai/atlas/pull/42";

    await client.$executeRaw`
      INSERT INTO "GitHubSourceEvent" (
        "id", "bindingId", "installationId", "repositoryId", "deliveryId", "eventType", "sourceId", "sourceUrl",
        "occurredAt", "verificationState", "governedFacts", "createdAt"
      ) VALUES (
        ${crypto.randomUUID()}::uuid, ${bindingId}::uuid, ${fixture.installationId}::uuid, ${repositoryId},
        ${deliveryId}, 'pull_request', ${sourceId}, ${sourceUrl}, CURRENT_TIMESTAMP,
        'VERIFIED'::"GitHubEventVerificationState", ${JSON.stringify([{ kind: "pull_request", state: "open" }])}::jsonb,
        CURRENT_TIMESTAMP
      )
    `;

    const events = await client.$queryRaw<
      Array<{
        sourceId: string;
        sourceUrl: string;
        verificationState: string;
        governedFacts: unknown;
      }>
    >`
      SELECT "sourceId", "sourceUrl", "verificationState", "governedFacts"
      FROM "GitHubSourceEvent"
      WHERE "deliveryId" = ${deliveryId}
    `;
    expect(events).toEqual([
      {
        sourceId,
        sourceUrl,
        verificationState: "VERIFIED",
        governedFacts: [{ kind: "pull_request", state: "open" }],
      },
    ]);
    await expect(
      client.$executeRaw`
        INSERT INTO "GitHubSourceEvent" (
          "id", "bindingId", "installationId", "repositoryId", "deliveryId", "eventType", "sourceId", "sourceUrl",
          "occurredAt", "verificationState", "governedFacts", "createdAt"
        ) VALUES (
          ${crypto.randomUUID()}::uuid, ${bindingId}::uuid, ${fixture.installationId}::uuid, ${repositoryId},
          ${deliveryId}, 'pull_request', 'PR_duplicate', 'https://github.com/leapai/atlas/pull/43', CURRENT_TIMESTAMP,
          'REJECTED'::"GitHubEventVerificationState", '[]'::jsonb, CURRENT_TIMESTAMP
        )
      `,
    ).rejects.toSatisfy(databaseConstraint);
  });

  it("keeps one reconciliation cursor for each historical binding", async () => {
    const fixture = await seedFixture();
    const repositoryId = `repository-${crypto.randomUUID()}`;
    const bindingId = await insertBinding(fixture, { repositoryId });
    const cursorId = crypto.randomUUID();
    await client.$executeRaw`
      INSERT INTO "GitHubReconciliationCursor" (
        "id", "bindingId", "installationId", "repositoryId", "cursor", "lastReconciledAt", "createdAt", "updatedAt"
      ) VALUES (
        ${cursorId}::uuid, ${bindingId}::uuid, ${fixture.installationId}::uuid,
        ${repositoryId}, 'cursor-v1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `;
    await expect(
      client.$executeRaw`
        INSERT INTO "GitHubReconciliationCursor" (
          "id", "bindingId", "installationId", "repositoryId", "cursor", "lastReconciledAt", "createdAt", "updatedAt"
        ) VALUES (
          ${crypto.randomUUID()}::uuid, ${bindingId}::uuid, ${fixture.installationId}::uuid,
          ${repositoryId}, 'cursor-v2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `,
    ).rejects.toSatisfy(databaseConstraint);
  });

  it("preserves an employee evidence draft's immutable GitHub source-event provenance", async () => {
    const fixture = await seedFixture();
    const repositoryId = `repository-${crypto.randomUUID()}`;
    const bindingId = await insertBinding(fixture, { repositoryId });
    const sourceEventId = crypto.randomUUID();
    await client.$executeRaw`
      INSERT INTO "GitHubSourceEvent" (
        "id", "bindingId", "installationId", "repositoryId", "deliveryId", "eventType", "sourceId", "sourceUrl",
        "occurredAt", "verificationState", "governedFacts", "createdAt"
      ) VALUES (
        ${sourceEventId}::uuid, ${bindingId}::uuid, ${fixture.installationId}::uuid, ${repositoryId},
        ${`delivery-${crypto.randomUUID()}`}, 'pull_request', 'PR_42', 'https://github.com/leapai/atlas/pull/42',
        CURRENT_TIMESTAMP, 'VERIFIED'::"GitHubEventVerificationState", '[{"kind":"pull_request","state":"merged"}]'::jsonb,
        CURRENT_TIMESTAMP
      )
    `;
    const evidenceId = crypto.randomUUID();
    await client.$executeRaw`
      INSERT INTO "EvidenceRecord" (
        "id", "idempotencyKey", "projectId", "capturedFromWorkItem", "employeeId", "githubSourceEventId",
        "state", "version", "currentRevision", "createdAt", "updatedAt"
      ) VALUES (
        ${evidenceId}::uuid, ${crypto.randomUUID()}::uuid, ${fixture.projectId}::uuid, false,
        ${fixture.ownerId}::uuid, ${sourceEventId}::uuid, 'draft'::"EvidenceRecordState", 1, 1,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `;
    await expect(
      client.$queryRaw<Array<{ githubSourceEventId: string }>>`
        SELECT "githubSourceEventId" FROM "EvidenceRecord" WHERE "id" = ${evidenceId}::uuid
      `,
    ).resolves.toEqual([{ githubSourceEventId: sourceEventId }]);
    await expect(
      client.$executeRaw`
        UPDATE "EvidenceRecord"
        SET "githubSourceEventId" = NULL
        WHERE "id" = ${evidenceId}::uuid
      `,
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      client.$executeRaw`
        INSERT INTO "EvidenceRecord" (
          "id", "idempotencyKey", "projectId", "capturedFromWorkItem", "employeeId", "githubSourceEventId",
          "state", "version", "currentRevision", "createdAt", "updatedAt"
        ) VALUES (
          ${crypto.randomUUID()}::uuid, ${crypto.randomUUID()}::uuid, ${fixture.otherProjectId}::uuid, false,
          ${fixture.ownerId}::uuid, ${sourceEventId}::uuid, 'draft'::"EvidenceRecordState", 1, 1,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `,
    ).rejects.toSatisfy(databaseConstraint);
  });

  it("pins immutable deterministic GitHub rules to one binding, active contract version, component, source identity, and acceptance state", async () => {
    const fixture = await seedFixture();
    const bindingId = await insertBinding(fixture, {
      repositoryId: `repository-${crypto.randomUUID()}`,
    });
    const contract = await insertContract(fixture);
    const ruleId = crypto.randomUUID();
    await client.$executeRaw`
      INSERT INTO "GitHubContractRule" (
        "id", "bindingId", "contractId", "contractVersion", "componentId", "sourceId", "eventKind", "acceptanceState",
        "effectiveAt", "createdAt"
      ) VALUES (
        ${ruleId}::uuid, ${bindingId}::uuid, ${contract.id}::uuid, 1, ${contract.componentId}::uuid,
        'PR_42', 'pull_request', 'merged', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `;
    await expect(
      client.$queryRaw<Array<{ sourceId: string; eventKind: string; acceptanceState: string }>>`
        SELECT "sourceId", "eventKind", "acceptanceState"
        FROM "GitHubContractRule" WHERE "id" = ${ruleId}::uuid
      `,
    ).resolves.toEqual([
      { sourceId: "PR_42", eventKind: "pull_request", acceptanceState: "merged" },
    ]);
    await expect(
      client.$executeRaw`
        UPDATE "GitHubContractRule" SET "acceptanceState" = 'open' WHERE "id" = ${ruleId}::uuid
      `,
    ).rejects.toSatisfy(databaseConstraint);
  });

  it("appends immutable GitHub source evaluations so the latest sequence derives current state", async () => {
    const fixture = await seedFixture();
    const repositoryId = `repository-${crypto.randomUUID()}`;
    const bindingId = await insertBinding(fixture, { repositoryId });
    const sourceEventId = crypto.randomUUID();
    await client.$executeRaw`
      INSERT INTO "GitHubSourceEvent" (
        "id", "bindingId", "installationId", "repositoryId", "deliveryId", "eventType", "sourceId", "sourceUrl",
        "occurredAt", "verificationState", "governedFacts", "createdAt"
      ) VALUES (
        ${sourceEventId}::uuid, ${bindingId}::uuid, ${fixture.installationId}::uuid, ${repositoryId},
        ${`delivery-${crypto.randomUUID()}`}, 'pull_request', 'PR_unmatched', 'https://github.com/leapai/atlas/pull/99',
        CURRENT_TIMESTAMP, 'VERIFIED'::"GitHubEventVerificationState", '[{"kind":"pull_request","state":"merged"}]'::jsonb,
        CURRENT_TIMESTAMP
      )
    `;
    const reviewId = crypto.randomUUID();
    await client.$executeRaw`
      INSERT INTO "GitHubProgressReview" (
        "id", "sourceEventId", "bindingId", "projectId", "contractId", "contractVersion", "evaluationSequence", "disposition", "createdAt"
      ) VALUES (
        ${reviewId}::uuid, ${sourceEventId}::uuid, ${bindingId}::uuid, ${fixture.projectId}::uuid,
        NULL, NULL, 1, 'no_match'::"GitHubProgressReviewDisposition", CURRENT_TIMESTAMP
      ), (
        ${crypto.randomUUID()}::uuid, ${sourceEventId}::uuid, ${bindingId}::uuid, ${fixture.projectId}::uuid,
        NULL, NULL, 2, 'matched'::"GitHubProgressReviewDisposition", CURRENT_TIMESTAMP
      )
    `;
    await expect(
      client.$queryRaw<Array<{ evaluationSequence: number; disposition: string }>>`
        SELECT "evaluationSequence", "disposition"
        FROM "GitHubProgressReview"
        WHERE "sourceEventId" = ${sourceEventId}::uuid
        ORDER BY "evaluationSequence" ASC
      `,
    ).resolves.toEqual([
      { evaluationSequence: 1, disposition: "no_match" },
      { evaluationSequence: 2, disposition: "matched" },
    ]);
    await expect(
      client.$executeRaw`
        INSERT INTO "GitHubProgressReview" (
          "id", "sourceEventId", "bindingId", "projectId", "contractId", "contractVersion", "evaluationSequence", "disposition", "createdAt"
        ) VALUES (
          ${crypto.randomUUID()}::uuid, ${sourceEventId}::uuid, ${bindingId}::uuid, ${fixture.projectId}::uuid,
          NULL, NULL, 2, 'ambiguous'::"GitHubProgressReviewDisposition", CURRENT_TIMESTAMP
        )
      `,
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      client.$executeRaw`
        UPDATE "GitHubProgressReview" SET "disposition" = 'ambiguous'::"GitHubProgressReviewDisposition"
        WHERE "id" = ${reviewId}::uuid
      `,
    ).rejects.toSatisfy(databaseConstraint);
  });

  it("rejects cross-Project and cross-binding candidate rules through scoped relational links", async () => {
    const fixture = await seedFixture();
    const repositoryId = `repository-${crypto.randomUUID()}`;
    const bindingId = await insertBinding(fixture, { repositoryId });
    const sameProjectBindingId = await insertBinding(fixture, {
      repositoryId: `repository-${crypto.randomUUID()}`,
    });
    const otherProjectBindingId = await insertBinding(fixture, {
      projectId: fixture.otherProjectId,
      repositoryId: `repository-${crypto.randomUUID()}`,
    });
    const sourceEventId = crypto.randomUUID();
    await client.$executeRaw`
      INSERT INTO "GitHubSourceEvent" (
        "id", "bindingId", "installationId", "repositoryId", "deliveryId", "eventType", "sourceId", "sourceUrl",
        "occurredAt", "verificationState", "governedFacts", "createdAt"
      ) VALUES (
        ${sourceEventId}::uuid, ${bindingId}::uuid, ${fixture.installationId}::uuid, ${repositoryId},
        ${`delivery-${crypto.randomUUID()}`}, 'pull_request', 'PR_42', 'https://github.com/leapai/atlas/pull/42',
        CURRENT_TIMESTAMP, 'VERIFIED'::"GitHubEventVerificationState", '[{"kind":"pull_request","state":"merged"}]'::jsonb,
        CURRENT_TIMESTAMP
      )
    `;
    const contract = await insertContract(fixture);
    const otherContract = await insertContract(fixture, {
      projectId: fixture.otherProjectId,
      templateVersionId: contract.templateVersionId,
    });
    const reviewId = crypto.randomUUID();
    await client.$executeRaw`
      INSERT INTO "GitHubProgressReview" (
        "id", "sourceEventId", "bindingId", "projectId", "contractId", "contractVersion", "evaluationSequence", "disposition", "createdAt"
      ) VALUES (
        ${reviewId}::uuid, ${sourceEventId}::uuid, ${bindingId}::uuid, ${fixture.projectId}::uuid,
        ${contract.id}::uuid, 1, 1, 'ambiguous'::"GitHubProgressReviewDisposition", CURRENT_TIMESTAMP
      )
    `;
    const ruleId = crypto.randomUUID();
    const sameProjectRuleId = crypto.randomUUID();
    const otherProjectRuleId = crypto.randomUUID();
    for (const [id, candidateBindingId, candidateContract] of [
      [ruleId, bindingId, contract],
      [sameProjectRuleId, sameProjectBindingId, contract],
      [otherProjectRuleId, otherProjectBindingId, otherContract],
    ] as const) {
      await client.$executeRaw`
        INSERT INTO "GitHubContractRule" (
          "id", "bindingId", "contractId", "contractVersion", "componentId", "sourceId", "eventKind", "acceptanceState", "effectiveAt", "createdAt"
        ) VALUES (
          ${id}::uuid, ${candidateBindingId}::uuid, ${candidateContract.id}::uuid, 1, ${candidateContract.componentId}::uuid,
          'PR_42', 'pull_request', 'merged', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `;
    }
    await client.$executeRaw`
      INSERT INTO "GitHubProgressReviewCandidate" (
        "id", "reviewId", "sourceEventId", "bindingId", "projectId", "ruleId", "contractId", "contractVersion", "createdAt"
      ) VALUES (
        ${crypto.randomUUID()}::uuid, ${reviewId}::uuid, ${sourceEventId}::uuid, ${bindingId}::uuid, ${fixture.projectId}::uuid,
        ${ruleId}::uuid, ${contract.id}::uuid, 1, CURRENT_TIMESTAMP
      )
    `;
    await expect(
      client.$executeRaw`
        INSERT INTO "GitHubProgressReviewCandidate" (
          "id", "reviewId", "sourceEventId", "bindingId", "projectId", "ruleId", "contractId", "contractVersion", "createdAt"
        ) VALUES (
          ${crypto.randomUUID()}::uuid, ${reviewId}::uuid, ${sourceEventId}::uuid, ${sameProjectBindingId}::uuid, ${fixture.projectId}::uuid,
          ${sameProjectRuleId}::uuid, ${contract.id}::uuid, 1, CURRENT_TIMESTAMP
        )
      `,
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      client.$executeRaw`
        INSERT INTO "GitHubProgressReviewCandidate" (
          "id", "reviewId", "sourceEventId", "bindingId", "projectId", "ruleId", "contractId", "contractVersion", "createdAt"
        ) VALUES (
          ${crypto.randomUUID()}::uuid, ${reviewId}::uuid, ${sourceEventId}::uuid, ${otherProjectBindingId}::uuid, ${fixture.otherProjectId}::uuid,
          ${otherProjectRuleId}::uuid, ${otherContract.id}::uuid, 1, CURRENT_TIMESTAMP
        )
      `,
    ).rejects.toSatisfy(databaseConstraint);
  });
});

async function insertContract(
  fixture: Fixture,
  overrides: Readonly<{ projectId?: string; templateVersionId?: string }> = {},
): Promise<{ id: string; componentId: string; templateVersionId: string }> {
  const projectId = overrides.projectId ?? fixture.projectId;
  const templateId = crypto.randomUUID();
  const templateVersionId = overrides.templateVersionId ?? crypto.randomUUID();
  const documentId = crypto.randomUUID();
  const documentVersionId = crypto.randomUUID();
  const contractId = crypto.randomUUID();
  const componentId = crypto.randomUUID();
  if (overrides.templateVersionId === undefined) {
    await client.$executeRaw`
    INSERT INTO "DocumentTemplate" (
      "id", "organizationId", "departmentId", "scopeType", "kind", "lockVersion", "createdById", "createdAt"
    ) VALUES (
      ${templateId}::uuid, ${fixture.organizationId}::uuid, ${fixture.departmentId}::uuid,
      'department'::"TemplateScopeType", 'project'::"DocumentKind", 1, ${fixture.ownerId}::uuid, CURRENT_TIMESTAMP
    )
    `;
    await client.$executeRaw`
    INSERT INTO "DocumentTemplateVersion" (
      "id", "templateId", "version", "status", "reason", "createdById", "activatedAt", "createdAt"
    ) VALUES (
      ${templateVersionId}::uuid, ${templateId}::uuid, 1, 'active'::"DocumentTemplateVersionStatus",
      'Schema fixture', ${fixture.ownerId}::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    `;
  }
  await client.$executeRaw`
    INSERT INTO "DocumentRecord" (
      "id", "organizationId", "departmentId", "projectId", "templateVersionId", "currentVersion", "createdById", "createdAt"
    ) VALUES (
      ${documentId}::uuid, ${fixture.organizationId}::uuid, ${fixture.departmentId}::uuid,
      ${projectId}::uuid, ${templateVersionId}::uuid, 1, ${fixture.ownerId}::uuid, CURRENT_TIMESTAMP
    )
  `;
  await client.$executeRaw`
    INSERT INTO "DocumentVersion" (
      "id", "documentId", "version", "templateVersionId", "createdById", "reason", "createdAt"
    ) VALUES (
      ${documentVersionId}::uuid, ${documentId}::uuid, 1, ${templateVersionId}::uuid,
      ${fixture.ownerId}::uuid, 'Schema fixture', CURRENT_TIMESTAMP
    )
  `;
  await client.$executeRaw`
    INSERT INTO "ProgressContract" (
      "id", "scopeKind", "projectId", "sourceDocumentId", "sourceDocumentVersionId", "sourceDocumentVersionNo",
      "calculationKind", "calculationSchemaVersion", "contractVersion", "version", "state", "ownerId", "approverId",
      "effectiveAt", "approvedAt", "createdById", "createdAt", "updatedAt"
    ) VALUES (
      ${contractId}::uuid, 'project'::"ProgressScopeKind", ${projectId}::uuid,
      ${documentId}::uuid, ${documentVersionId}::uuid, 1, 'weighted'::"ProgressCalculationKind", '1.0.0',
      1, 1, 'active'::"ProgressContractState", ${fixture.ownerId}::uuid, ${fixture.ownerId}::uuid,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ${fixture.ownerId}::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `;
  await client.$executeRaw`
    INSERT INTO "ProgressContractComponent" (
      "id", "contractId", "position", "kind", "name", "description", "weight", "acceptanceConditions", "requiredEvidence",
      "confirmationMode", "createdAt"
    ) VALUES (
      ${componentId}::uuid, ${contractId}::uuid, 1, 'milestone'::"ProgressComponentKind", 'Release',
      'Schema fixture', 100, '["Merged"]'::jsonb, '["PR"]'::jsonb, 'deterministic'::"ProgressConfirmationMode", CURRENT_TIMESTAMP
    )
  `;
  return { id: contractId, componentId, templateVersionId };
}
