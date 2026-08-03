import { createDatabaseClient } from "@evaluation/database";
import { afterAll, describe, expect, it } from "vitest";

import { PrismaGitHubStore } from "./github-integration.module.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

async function seedFixture() {
  const suffix = crypto.randomUUID();
  const owner = await client.user.create({
    data: {
      email: `github-store-owner-${suffix}@example.invalid`,
      displayName: "GitHub Store Owner",
    },
  });
  const organization = await client.organization.create({
    data: { key: `github-store-org-${suffix}`, name: "GitHub Store" },
  });
  const department = await client.department.create({
    data: {
      key: `github-store-department-${suffix}`,
      name: "GitHub Store Department",
      organizationId: organization.id,
    },
  });
  const projectId = crypto.randomUUID();
  await client.authorizationScope.create({
    data: {
      id: projectId,
      key: `github-store-project-${suffix}`,
      scopeType: "project",
      departmentId: department.id,
    },
  });
  await client.project.create({
    data: {
      id: projectId,
      organizationId: organization.id,
      departmentId: department.id,
      authorizationScopeId: projectId,
      authorizationScopeType: "project",
      name: "GitHub Store Project",
      description: "GitHub store integration fixture",
      status: "active",
      createdById: owner.id,
    },
  });
  const installationRecordId = crypto.randomUUID();
  const bindingId = crypto.randomUUID();
  const repositoryId = `repository-${suffix}`;
  await client.$executeRaw`
    INSERT INTO "GitHubAppInstallation" ("id", "installationId", "createdAt", "updatedAt")
    VALUES (${installationRecordId}::uuid, ${`installation-${suffix}`}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;
  await client.$executeRaw`
    INSERT INTO "GitHubProjectBinding" (
      "id", "projectId", "installationId", "repositoryId", "boundAt", "createdAt", "updatedAt"
    ) VALUES (
      ${bindingId}::uuid, ${projectId}::uuid, ${installationRecordId}::uuid, ${repositoryId},
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `;
  return { bindingId, installationRecordId, projectId, repositoryId };
}

function receipt(fixture: Awaited<ReturnType<typeof seedFixture>>, deliveryId: string) {
  return {
    bindingId: fixture.bindingId,
    projectId: fixture.projectId,
    installationRecordId: fixture.installationRecordId,
    installationId: "provider-installation",
    repositoryId: fixture.repositoryId,
    deliveryId,
    eventType: "pull_request",
    sourceId: "PR_42",
    sourceUrl: "https://github.com/leapai/atlas/pull/42",
    occurredAt: "2026-08-03T10:00:00.000Z",
    governedFacts: [{ kind: "pull_request" as const, state: "open" as const }],
  };
}

afterAll(async () => client.$disconnect());

describe("Prisma GitHub receipt persistence", () => {
  it("persists one immutable event with its audit event atomically and treats a replay as duplicate", async () => {
    const fixture = await seedFixture();
    const command = receipt(fixture, `delivery-${crypto.randomUUID()}`);
    const store = new PrismaGitHubStore(client);

    await expect(store.receive(command)).resolves.toEqual({ receipt: "created" });
    await expect(store.receive(command)).resolves.toEqual({ receipt: "duplicate" });

    const [events, audits] = await Promise.all([
      client.gitHubSourceEvent.findMany({ where: { deliveryId: command.deliveryId } }),
      client.auditEvent.findMany({
        where: { eventType: "github.source_event.received", targetType: "github_source_event" },
      }),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      deliveryId: command.deliveryId,
      verificationState: "VERIFIED",
    });
    expect(audits.filter((audit) => audit.targetId === events[0]?.id)).toHaveLength(1);
  });

  it("rolls back the source event when append-only audit persistence fails", async () => {
    const fixture = await seedFixture();
    const command = receipt(fixture, `delivery-audit-failure-${crypto.randomUUID()}`);
    const store = new PrismaGitHubStore(client, {
      append: async () => {
        throw new Error("audit persistence unavailable");
      },
    } as never);

    await expect(store.receive(command)).rejects.toThrow("audit persistence unavailable");
    await expect(
      client.gitHubSourceEvent.findUnique({ where: { deliveryId: command.deliveryId } }),
    ).resolves.toBeNull();
  });
});
