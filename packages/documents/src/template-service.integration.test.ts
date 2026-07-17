import { databaseAuditWriter } from "@evaluation/audit";
import {
  PROJECT_PROTECTED_SECTION_KEYS,
  WORKSTREAM_REQUIRED_SECTION_KEYS,
} from "@evaluation/contracts";
import { createDatabaseClient } from "@evaluation/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TemplateService } from "./template-service.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const now = new Date("2026-07-17T12:00:00Z");
let organizationId: string;
let departmentId: string;
let managerId: string;
let administratorId: string;

function section(key: string, position: number, protectedSection: boolean) {
  return {
    key,
    position,
    display: { en: { title: key.replaceAll("_", " ") } },
    required: true,
    protected: protectedSection,
  };
}

const projectSections = PROJECT_PROTECTED_SECTION_KEYS.map((key, index) =>
  section(key, index + 1, true),
);
const workstreamSections = WORKSTREAM_REQUIRED_SECTION_KEYS.map((key, index) =>
  section(key, index + 1, false),
);

beforeAll(async () => {
  const suffix = crypto.randomUUID();
  const organization = await client.organization.create({
    data: { key: `template-service-org-${suffix}`, name: "Template Organization" },
  });
  const department = await client.department.create({
    data: {
      key: `template-service-department-${suffix}`,
      name: "Template Department",
      organizationId: organization.id,
    },
  });
  const departmentScope = await client.authorizationScope.create({
    data: {
      key: `template-service-scope-${suffix}`,
      scopeType: "department",
      departmentId: department.id,
    },
  });
  const systemScope = await client.authorizationScope.create({
    data: { key: `template-service-system-${suffix}`, scopeType: "system" },
  });
  const manager = await client.user.create({
    data: { email: `template-manager-${suffix}@example.invalid`, displayName: "Manager" },
  });
  const administrator = await client.user.create({
    data: { email: `template-admin-${suffix}@example.invalid`, displayName: "Administrator" },
  });
  await client.roleAssignment.createMany({
    data: [
      { userId: manager.id, role: "manager", scopeType: "department", scopeId: departmentScope.id },
      {
        userId: administrator.id,
        role: "system_administrator",
        scopeType: "system",
        scopeId: systemScope.id,
      },
    ],
  });
  organizationId = organization.id;
  departmentId = department.id;
  managerId = manager.id;
  administratorId = administrator.id;
});

afterAll(async () => client.$disconnect());

function service() {
  return new TemplateService(client, databaseAuditWriter as never, () => now);
}

function command(actorId: string, input: Record<string, unknown>) {
  return { actor: { userId: actorId, active: true }, correlationId: crypto.randomUUID(), input };
}

describe("TemplateService", () => {
  it("creates and activates an organization project template", async () => {
    const created = await service().createVersion(
      command(administratorId, {
        expectedVersion: 0,
        scopeType: "organization",
        organizationId,
        kind: "project",
        sections: projectSections,
        reason: "Initial organization template",
      }),
    );
    const active = await service().activate({
      actor: { userId: administratorId, active: true },
      correlationId: crypto.randomUUID(),
      templateId: created.templateId,
      versionId: created.id,
      input: { expectedVersion: 1, reason: "Approved organization template" },
    });
    expect(active.status).toBe("active");
    await expect(
      client.auditEvent.findFirstOrThrow({
        where: { targetId: created.id, eventType: "document_template.version_activated" },
      }),
    ).resolves.toMatchObject({ actorId: administratorId });
  });

  it("retires the prior department workstream version atomically", async () => {
    const first = await service().createVersion(
      command(managerId, {
        expectedVersion: 0,
        scopeType: "department",
        organizationId,
        departmentId,
        kind: "workstream",
        sections: workstreamSections,
        reason: "Initial workstream template",
      }),
    );
    await service().activate({
      actor: { userId: managerId, active: true },
      correlationId: crypto.randomUUID(),
      templateId: first.templateId,
      versionId: first.id,
      input: { expectedVersion: 1, reason: "Activate first version" },
    });
    const second = await service().createVersion(
      command(managerId, {
        templateId: first.templateId,
        expectedVersion: 2,
        scopeType: "department",
        organizationId,
        departmentId,
        kind: "workstream",
        sections: workstreamSections,
        reason: "Second workstream template",
      }),
    );
    await service().activate({
      actor: { userId: managerId, active: true },
      correlationId: crypto.randomUUID(),
      templateId: first.templateId,
      versionId: second.id,
      input: { expectedVersion: 3, reason: "Activate second version" },
    });
    const versions = await client.documentTemplateVersion.findMany({
      where: { templateId: first.templateId },
      orderBy: { version: "asc" },
    });
    expect(versions.map(({ status }) => status)).toEqual(["retired", "active"]);
  });

  it("rejects incomplete activation and stale aggregate tokens without partial writes", async () => {
    const incomplete = await service().createVersion(
      command(managerId, {
        expectedVersion: 0,
        scopeType: "department",
        organizationId,
        departmentId,
        kind: "project",
        sections: projectSections.slice(1),
        reason: "Incomplete draft",
      }),
    );
    await expect(
      service().activate({
        actor: { userId: managerId, active: true },
        correlationId: crypto.randomUUID(),
        templateId: incomplete.templateId,
        versionId: incomplete.id,
        input: { expectedVersion: 1, reason: "Must fail" },
      }),
    ).rejects.toMatchObject({ code: "DOCUMENT_TEMPLATE_INVALID" });
    await expect(
      service().createVersion(
        command(managerId, {
          templateId: incomplete.templateId,
          expectedVersion: 2,
          scopeType: "department",
          organizationId,
          departmentId,
          kind: "project",
          sections: projectSections,
          reason: "Stale draft",
        }),
      ),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    await expect(
      client.documentTemplate.findUniqueOrThrow({ where: { id: incomplete.templateId } }),
    ).resolves.toMatchObject({ lockVersion: 1 });
  });

  it("allows only one concurrent edit for the same aggregate token", async () => {
    const suffix = crypto.randomUUID();
    const organization = await client.organization.create({
      data: { key: `template-concurrency-${suffix}`, name: "Concurrency Organization" },
    });
    const first = await service().createVersion(
      command(administratorId, {
        expectedVersion: 0,
        scopeType: "organization",
        organizationId: organization.id,
        kind: "workstream",
        sections: workstreamSections,
        reason: "Concurrency base",
      }),
    );
    const edit = (reason: string) =>
      service().createVersion(
        command(administratorId, {
          templateId: first.templateId,
          expectedVersion: 1,
          scopeType: "organization",
          organizationId: organization.id,
          kind: "workstream",
          sections: workstreamSections,
          reason,
        }),
      );
    const results = await Promise.allSettled([edit("Concurrent A"), edit("Concurrent B")]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toEqual([
      expect.objectContaining({ reason: expect.objectContaining({ code: "VERSION_CONFLICT" }) }),
    ]);
    await expect(
      client.documentTemplateVersion.count({ where: { templateId: first.templateId } }),
    ).resolves.toBe(2);
  });
});
