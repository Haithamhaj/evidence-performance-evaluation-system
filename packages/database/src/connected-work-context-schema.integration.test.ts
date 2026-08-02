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
  employeeId: string;
  otherEmployeeId: string;
  projectId: string;
  otherProjectId: string;
  accountId: string;
}>;

async function seedFixture(): Promise<Fixture> {
  const suffix = crypto.randomUUID();
  const employee = await client.user.create({
    data: {
      email: `connected-context-owner-${suffix}@example.invalid`,
      displayName: "Connected Context Owner",
    },
  });
  const otherEmployee = await client.user.create({
    data: {
      email: `connected-context-other-${suffix}@example.invalid`,
      displayName: "Other Employee",
    },
  });
  const organization = await client.organization.create({
    data: {
      key: `connected-context-organization-${suffix}`,
      name: "Connected Context Organization",
    },
  });
  const department = await client.department.create({
    data: {
      key: `connected-context-department-${suffix}`,
      name: "Connected Context Department",
      organizationId: organization.id,
    },
  });
  const projectId = crypto.randomUUID();
  const otherProjectId = crypto.randomUUID();
  await client.authorizationScope.createMany({
    data: [
      {
        id: projectId,
        key: `connected-context-project-${suffix}`,
        scopeType: "project",
        departmentId: department.id,
      },
      {
        id: otherProjectId,
        key: `connected-context-other-project-${suffix}`,
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
        name: "Connected Context Project",
        description: "Schema fixture",
        status: "active",
        createdById: employee.id,
      },
      {
        id: otherProjectId,
        organizationId: organization.id,
        departmentId: department.id,
        authorizationScopeId: otherProjectId,
        authorizationScopeType: "project",
        name: "Other Connected Context Project",
        description: "Schema fixture",
        status: "active",
        createdById: employee.id,
      },
    ],
  });
  const accountId = crypto.randomUUID();
  await client.$executeRaw`
    INSERT INTO "ConnectedWorkAccount" (
      "id", "employeeId", "credentialRef", "connectedAt", "createdAt", "updatedAt"
    )
    VALUES (
      ${accountId}::uuid,
      ${employee.id}::uuid,
      ${`vault://google-workspace/${suffix}`},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;
  return {
    employeeId: employee.id,
    otherEmployeeId: otherEmployee.id,
    projectId,
    otherProjectId,
    accountId,
  };
}

async function insertSourceItem(
  fixture: Fixture,
  overrides: Partial<{
    id: string;
    employeeId: string;
    provider: "GOOGLE_GMAIL" | "GOOGLE_CALENDAR";
    providerSourceId: string;
  }> = {},
): Promise<string> {
  const id = overrides.id ?? crypto.randomUUID();
  const employeeId = overrides.employeeId ?? fixture.employeeId;
  const provider = overrides.provider ?? "GOOGLE_GMAIL";
  const providerSourceId = overrides.providerSourceId ?? `source-${crypto.randomUUID()}`;
  await client.$executeRaw`
    INSERT INTO "ConnectedSourceItem" (
      "id",
      "connectedWorkAccountId",
      "employeeId",
      "provider",
      "providerSourceId",
      "occurredAt",
      "titleCiphertext",
      "titleKeyVersion",
      "summaryCiphertext",
      "summaryKeyVersion",
      "sourceUrl",
      "privacy",
      "reviewState",
      "excluded",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${id}::uuid,
      ${fixture.accountId}::uuid,
      ${employeeId}::uuid,
      ${provider}::"ConnectedSourceProvider",
      ${providerSourceId},
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
  return id;
}

afterAll(async () => client.$disconnect());

describe("connected work context schema", () => {
  it("stores only opaque credentials and encrypted sensitive source content", async () => {
    const columns = await client.$queryRaw<
      Array<{ table_name: string; column_name: string; is_nullable: string }>
    >`
      SELECT table_name, column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN (
          'ConnectedWorkAccount',
          'ConnectedSourceItem',
          'ConnectedSourceExclusion',
          'SourceProjectLink',
          'ConnectorSyncCursor'
        )
      ORDER BY table_name, ordinal_position
    `;
    const names = new Set(
      columns.map(({ table_name, column_name }) => `${table_name}.${column_name}`),
    );

    expect(names).toContain("ConnectedWorkAccount.credentialRef");
    expect(names).toContain("ConnectedSourceItem.titleCiphertext");
    expect(names).toContain("ConnectedSourceItem.titleKeyVersion");
    expect(names).toContain("ConnectedSourceItem.summaryCiphertext");
    expect(names).toContain("ConnectedSourceItem.summaryKeyVersion");
    expect(names).toContain("ConnectedSourceItem.retentionExpiresAt");
    expect(names).toContain("ConnectedWorkAccount.contentInaccessibleAt");
    expect(names).toContain("ConnectedWorkAccount.deletionDueAt");
    expect(names).toContain("ConnectorSyncCursor.cursorCiphertext");
    expect(names).toContain("ConnectorSyncCursor.cursorKeyVersion");

    for (const forbiddenColumn of [
      "ConnectedWorkAccount.accessToken",
      "ConnectedWorkAccount.refreshToken",
      "ConnectedWorkAccount.token",
      "ConnectedSourceItem.title",
      "ConnectedSourceItem.summary",
      "ConnectorSyncCursor.cursor",
    ]) {
      expect(names).not.toContain(forbiddenColumn);
    }

    const indexes = await client.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN (
          'ConnectedWorkAccount',
          'ConnectedSourceItem',
          'ConnectedSourceExclusion',
          'SourceProjectLink',
          'ConnectorSyncCursor'
        )
    `;
    const indexNames = new Set(indexes.map(({ indexname }) => indexname));
    expect(indexNames).toContain("ConnectedSourceItem_owner_review_time_idx");
    expect(indexNames).toContain("ConnectedSourceItem_retentionExpiresAt_deletedAt_idx");
    expect(indexNames).toContain("ConnectedWorkAccount_deletionDueAt_contentInaccessibleAt_idx");
  });

  it("enforces employee ownership and provider/source idempotency", async () => {
    const fixture = await seedFixture();
    const providerSourceId = `gmail-thread-${crypto.randomUUID()}`;
    await insertSourceItem(fixture, { providerSourceId });

    await expect(insertSourceItem(fixture, { providerSourceId })).rejects.toSatisfy(
      databaseConstraint,
    );
    await expect(
      insertSourceItem(fixture, {
        employeeId: fixture.otherEmployeeId,
        providerSourceId: `cross-owner-${crypto.randomUUID()}`,
      }),
    ).rejects.toSatisfy(databaseConstraint);
  });

  it("stores one protected cursor per account/provider and preserves exclusion history", async () => {
    const fixture = await seedFixture();
    const cursorId = crypto.randomUUID();
    await client.$executeRaw`
      INSERT INTO "ConnectorSyncCursor" (
        "id",
        "connectedWorkAccountId",
        "employeeId",
        "provider",
        "cursorCiphertext",
        "cursorKeyVersion",
        "lastSuccessfulSyncAt",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${cursorId}::uuid,
        ${fixture.accountId}::uuid,
        ${fixture.employeeId}::uuid,
        'GOOGLE_GMAIL'::"ConnectedSourceProvider",
        'sealed-cursor',
        'context-key-v1',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;
    await expect(
      client.$executeRaw`
        INSERT INTO "ConnectorSyncCursor" (
          "id",
          "connectedWorkAccountId",
          "employeeId",
          "provider",
          "cursorCiphertext",
          "cursorKeyVersion",
          "lastSuccessfulSyncAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${crypto.randomUUID()}::uuid,
          ${fixture.accountId}::uuid,
          ${fixture.employeeId}::uuid,
          'GOOGLE_GMAIL'::"ConnectedSourceProvider",
          'duplicate-cursor',
          'context-key-v1',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `,
    ).rejects.toSatisfy(databaseConstraint);

    const exclusionId = crypto.randomUUID();
    const providerExclusionId = `label-${crypto.randomUUID()}`;
    await client.$executeRaw`
      INSERT INTO "ConnectedSourceExclusion" (
        "id",
        "connectedWorkAccountId",
        "employeeId",
        "provider",
        "kind",
        "providerExclusionId",
        "createdAt"
      )
      VALUES (
        ${exclusionId}::uuid,
        ${fixture.accountId}::uuid,
        ${fixture.employeeId}::uuid,
        'GOOGLE_GMAIL'::"ConnectedSourceProvider",
        'GMAIL_LABEL'::"ConnectedSourceExclusionKind",
        ${providerExclusionId},
        CURRENT_TIMESTAMP
      )
    `;
    await expect(
      client.$executeRaw`
        INSERT INTO "ConnectedSourceExclusion" (
          "id",
          "connectedWorkAccountId",
          "employeeId",
          "provider",
          "kind",
          "providerExclusionId",
          "createdAt"
        )
        VALUES (
          ${crypto.randomUUID()}::uuid,
          ${fixture.accountId}::uuid,
          ${fixture.employeeId}::uuid,
          'GOOGLE_GMAIL'::"ConnectedSourceProvider",
          'GMAIL_LABEL'::"ConnectedSourceExclusionKind",
          ${providerExclusionId},
          CURRENT_TIMESTAMP
        )
      `,
    ).rejects.toSatisfy(databaseConstraint);
    await client.$executeRaw`
      UPDATE "ConnectedSourceExclusion"
      SET "revokedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${exclusionId}::uuid
    `;
    await client.$executeRaw`
      INSERT INTO "ConnectedSourceExclusion" (
        "id",
        "connectedWorkAccountId",
        "employeeId",
        "provider",
        "kind",
        "providerExclusionId",
        "createdAt"
      )
      VALUES (
        ${crypto.randomUUID()}::uuid,
        ${fixture.accountId}::uuid,
        ${fixture.employeeId}::uuid,
        'GOOGLE_GMAIL'::"ConnectedSourceProvider",
        'GMAIL_LABEL'::"ConnectedSourceExclusionKind",
        ${providerExclusionId},
        CURRENT_TIMESTAMP
      )
    `;
    const exclusions = await client.$queryRaw<Array<{ revokedAt: Date | null }>>`
      SELECT "revokedAt"
      FROM "ConnectedSourceExclusion"
      WHERE "providerExclusionId" = ${providerExclusionId}
      ORDER BY "createdAt"
    `;
    expect(exclusions).toHaveLength(2);
    expect(exclusions[0]?.revokedAt).toBeInstanceOf(Date);
    expect(exclusions[1]?.revokedAt).toBeNull();
  });

  it("unlinks and relinks a source without deleting link history", async () => {
    const fixture = await seedFixture();
    const sourceItemId = await insertSourceItem(fixture);
    const firstLinkId = crypto.randomUUID();
    await client.$executeRaw`
      INSERT INTO "SourceProjectLink" (
        "id",
        "sourceItemId",
        "employeeId",
        "projectId",
        "linkedById",
        "linkedAt"
      )
      VALUES (
        ${firstLinkId}::uuid,
        ${sourceItemId}::uuid,
        ${fixture.employeeId}::uuid,
        ${fixture.projectId}::uuid,
        ${fixture.employeeId}::uuid,
        CURRENT_TIMESTAMP
      )
    `;
    await expect(
      client.$executeRaw`
        INSERT INTO "SourceProjectLink" (
          "id",
          "sourceItemId",
          "employeeId",
          "projectId",
          "linkedById",
          "linkedAt"
        )
        VALUES (
          ${crypto.randomUUID()}::uuid,
          ${sourceItemId}::uuid,
          ${fixture.employeeId}::uuid,
          ${fixture.otherProjectId}::uuid,
          ${fixture.employeeId}::uuid,
          CURRENT_TIMESTAMP
        )
      `,
    ).rejects.toSatisfy(databaseConstraint);
    await client.$executeRaw`
      UPDATE "SourceProjectLink"
      SET
        "unlinkedAt" = CURRENT_TIMESTAMP,
        "unlinkedById" = ${fixture.employeeId}::uuid,
        "unlinkReason" = 'Employee corrected the Project link'
      WHERE "id" = ${firstLinkId}::uuid
    `;
    await client.$executeRaw`
      INSERT INTO "SourceProjectLink" (
        "id",
        "sourceItemId",
        "employeeId",
        "projectId",
        "linkedById",
        "linkedAt"
      )
      VALUES (
        ${crypto.randomUUID()}::uuid,
        ${sourceItemId}::uuid,
        ${fixture.employeeId}::uuid,
        ${fixture.otherProjectId}::uuid,
        ${fixture.employeeId}::uuid,
        CURRENT_TIMESTAMP
      )
    `;
    const links = await client.$queryRaw<Array<{ projectId: string; unlinkedAt: Date | null }>>`
      SELECT "projectId", "unlinkedAt"
      FROM "SourceProjectLink"
      WHERE "sourceItemId" = ${sourceItemId}::uuid
      ORDER BY "linkedAt", "id"
    `;
    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({
      projectId: fixture.projectId,
      unlinkedAt: expect.any(Date),
    });
    expect(links[1]).toMatchObject({
      projectId: fixture.otherProjectId,
      unlinkedAt: null,
    });
  });

  it("permits only one-way exclusion revocation and link closure updates", async () => {
    const fixture = await seedFixture();
    const sourceItemId = await insertSourceItem(fixture);
    const exclusionId = crypto.randomUUID();
    const linkId = crypto.randomUUID();
    await client.$executeRaw`
      INSERT INTO "ConnectedSourceExclusion" (
        "id",
        "connectedWorkAccountId",
        "employeeId",
        "provider",
        "kind",
        "providerExclusionId",
        "createdAt"
      )
      VALUES (
        ${exclusionId}::uuid,
        ${fixture.accountId}::uuid,
        ${fixture.employeeId}::uuid,
        'GOOGLE_GMAIL'::"ConnectedSourceProvider",
        'GMAIL_LABEL'::"ConnectedSourceExclusionKind",
        ${`protected-label-${crypto.randomUUID()}`},
        CURRENT_TIMESTAMP
      )
    `;
    await client.$executeRaw`
      INSERT INTO "SourceProjectLink" (
        "id",
        "sourceItemId",
        "employeeId",
        "projectId",
        "linkedById",
        "linkedAt"
      )
      VALUES (
        ${linkId}::uuid,
        ${sourceItemId}::uuid,
        ${fixture.employeeId}::uuid,
        ${fixture.projectId}::uuid,
        ${fixture.employeeId}::uuid,
        CURRENT_TIMESTAMP
      )
    `;

    await expect(
      client.$executeRaw`
        UPDATE "ConnectedSourceExclusion"
        SET "providerExclusionId" = 'silently-rewritten-label'
        WHERE "id" = ${exclusionId}::uuid
      `,
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      client.$executeRaw`
        UPDATE "SourceProjectLink"
        SET "projectId" = ${fixture.otherProjectId}::uuid
        WHERE "id" = ${linkId}::uuid
      `,
    ).rejects.toSatisfy(databaseConstraint);

    await client.$executeRaw`
      UPDATE "ConnectedSourceExclusion"
      SET "revokedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${exclusionId}::uuid
    `;
    await client.$executeRaw`
      UPDATE "SourceProjectLink"
      SET
        "unlinkedAt" = CURRENT_TIMESTAMP,
        "unlinkedById" = ${fixture.employeeId}::uuid,
        "unlinkReason" = 'Employee removed the link'
      WHERE "id" = ${linkId}::uuid
    `;

    await expect(
      client.$executeRaw`
        UPDATE "ConnectedSourceExclusion"
        SET "revokedAt" = NULL
        WHERE "id" = ${exclusionId}::uuid
      `,
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      client.$executeRaw`
        UPDATE "SourceProjectLink"
        SET
          "unlinkedAt" = NULL,
          "unlinkedById" = NULL,
          "unlinkReason" = NULL
        WHERE "id" = ${linkId}::uuid
      `,
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      client.$executeRaw`
        UPDATE "SourceProjectLink"
        SET "unlinkedAt" = "unlinkedAt" + INTERVAL '1 second'
        WHERE "id" = ${linkId}::uuid
      `,
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      client.$executeRaw`
        UPDATE "SourceProjectLink"
        SET "unlinkedById" = ${fixture.otherEmployeeId}::uuid
        WHERE "id" = ${linkId}::uuid
      `,
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      client.$executeRaw`
        UPDATE "SourceProjectLink"
        SET "unlinkReason" = 'Silently rewritten reason'
        WHERE "id" = ${linkId}::uuid
      `,
    ).rejects.toSatisfy(databaseConstraint);
  });

  it("prevents deletion of exclusion and Project-link history", async () => {
    const fixture = await seedFixture();
    const sourceItemId = await insertSourceItem(fixture);
    const exclusionId = crypto.randomUUID();
    const linkId = crypto.randomUUID();
    await client.$executeRaw`
      INSERT INTO "ConnectedSourceExclusion" (
        "id",
        "connectedWorkAccountId",
        "employeeId",
        "provider",
        "kind",
        "providerExclusionId",
        "createdAt"
      )
      VALUES (
        ${exclusionId}::uuid,
        ${fixture.accountId}::uuid,
        ${fixture.employeeId}::uuid,
        'GOOGLE_GMAIL'::"ConnectedSourceProvider",
        'GMAIL_LABEL'::"ConnectedSourceExclusionKind",
        ${`retained-label-${crypto.randomUUID()}`},
        CURRENT_TIMESTAMP
      )
    `;
    await client.$executeRaw`
      INSERT INTO "SourceProjectLink" (
        "id",
        "sourceItemId",
        "employeeId",
        "projectId",
        "linkedById",
        "linkedAt"
      )
      VALUES (
        ${linkId}::uuid,
        ${sourceItemId}::uuid,
        ${fixture.employeeId}::uuid,
        ${fixture.projectId}::uuid,
        ${fixture.employeeId}::uuid,
        CURRENT_TIMESTAMP
      )
    `;

    await expect(
      client.$executeRaw`
        DELETE FROM "ConnectedSourceExclusion"
        WHERE "id" = ${exclusionId}::uuid
      `,
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      client.$executeRaw`
        DELETE FROM "SourceProjectLink"
        WHERE "id" = ${linkId}::uuid
      `,
    ).rejects.toSatisfy(databaseConstraint);
  });
});
