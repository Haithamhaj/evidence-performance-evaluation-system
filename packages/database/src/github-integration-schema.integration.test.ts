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
  return { projectId, otherProjectId, installationId };
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
});
