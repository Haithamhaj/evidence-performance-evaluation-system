import { databaseAuditWriter } from "@evaluation/audit";
import {
  PROJECT_PROTECTED_SECTION_KEYS,
  WORKSTREAM_REQUIRED_SECTION_KEYS,
} from "@evaluation/contracts";
import { createDatabaseClient } from "@evaluation/database";
import { DocumentResourceReader } from "@evaluation/projects";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DocumentService } from "./document-service.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const reader = new DocumentResourceReader(database);
const now = new Date("2026-07-17T12:00:00Z");
const service = new DocumentService(database, reader, databaseAuditWriter as never, () => now);

let organizationId = "";
let departmentId = "";
let managerId = "";
let projectId = "";
let workstreamId = "";
let templateVersionId = "";
let workstreamTemplateVersionId = "";
let outsiderId = "";

beforeAll(async () => {
  const suffix = crypto.randomUUID();
  const organization = await database.organization.create({
    data: { key: `document-service-org-${suffix}`, name: "Document Organization" },
  });
  const department = await database.department.create({
    data: {
      key: `document-service-department-${suffix}`,
      name: "Document Department",
      organizationId: organization.id,
    },
  });
  const departmentScope = await database.authorizationScope.create({
    data: {
      key: `document-service-department-scope-${suffix}`,
      scopeType: "department",
      departmentId: department.id,
    },
  });
  const manager = await database.user.create({
    data: { email: `document-manager-${suffix}@example.invalid`, displayName: "Document Manager" },
  });
  const outsider = await database.user.create({
    data: { email: `document-outsider-${suffix}@example.invalid`, displayName: "Outsider" },
  });
  await database.roleAssignment.create({
    data: {
      userId: manager.id,
      role: "manager",
      scopeType: "department",
      scopeId: departmentScope.id,
    },
  });
  const projectScope = await database.authorizationScope.create({
    data: {
      key: `document-service-project-scope-${suffix}`,
      scopeType: "project",
      departmentId: department.id,
    },
  });
  const project = await database.project.create({
    data: {
      organizationId: organization.id,
      departmentId: department.id,
      authorizationScopeId: projectScope.id,
      authorizationScopeType: "project",
      name: "Document Project",
      description: "Versioned document fixture",
      status: "active",
      createdById: manager.id,
    },
  });
  const workstreamScope = await database.authorizationScope.create({
    data: {
      key: `document-service-workstream-scope-${suffix}`,
      scopeType: "workstream",
      departmentId: department.id,
    },
  });
  const workstream = await database.workstream.create({
    data: {
      projectId: project.id,
      authorizationScopeId: workstreamScope.id,
      authorizationScopeType: "workstream",
      name: "Document Workstream",
      description: "Shared workstream document fixture",
      status: "active",
      createdById: manager.id,
    },
  });
  const template = await database.documentTemplate.create({
    data: {
      organizationId: organization.id,
      departmentId: department.id,
      scopeType: "department",
      kind: "project",
      lockVersion: 2,
      createdById: manager.id,
      versions: {
        create: {
          version: 1,
          status: "active",
          reason: "Active project template",
          createdById: manager.id,
          activatedAt: now,
          sections: {
            create: PROJECT_PROTECTED_SECTION_KEYS.map((key, index) => ({
              key,
              position: index + 1,
              display: { en: { title: key } },
              required: true,
              protected: true,
            })),
          },
        },
      },
    },
    include: { versions: true },
  });
  const workstreamTemplate = await database.documentTemplate.create({
    data: {
      organizationId: organization.id,
      departmentId: department.id,
      scopeType: "department",
      kind: "workstream",
      lockVersion: 2,
      createdById: manager.id,
      versions: {
        create: {
          version: 1,
          status: "active",
          reason: "Active workstream template",
          createdById: manager.id,
          activatedAt: now,
          sections: {
            create: WORKSTREAM_REQUIRED_SECTION_KEYS.map((key, index) => ({
              key,
              position: index + 1,
              display: { en: { title: key } },
              required: true,
              protected: false,
            })),
          },
        },
      },
    },
    include: { versions: true },
  });
  organizationId = organization.id;
  departmentId = department.id;
  managerId = manager.id;
  projectId = project.id;
  workstreamId = workstream.id;
  templateVersionId = template.versions[0]!.id;
  workstreamTemplateVersionId = workstreamTemplate.versions[0]!.id;
  outsiderId = outsider.id;
});

afterAll(async () => database.$disconnect());

async function upload(label: string) {
  return database.uploadedSource.create({
    data: {
      organizationId,
      departmentId,
      projectId,
      originalFilename: `${label}.pdf`,
      objectKey: `documents/${organizationId}/project/${projectId}/${crypto.randomUUID()}`,
      detectedType: "pdf",
      detectedMime: "application/pdf",
      byteSize: 12,
      sha256: createHash("sha256").update(label).digest("hex"),
      createdById: managerId,
      reason: label,
    },
  });
}

function actor() {
  return { userId: managerId, active: true } as const;
}

describe("DocumentService", () => {
  it("creates the sole shared workstream document owned by the workstream scope", async () => {
    const created = await service.create({
      actor: actor(),
      correlationId: crypto.randomUUID(),
      input: {
        kind: "workstream",
        resourceId: workstreamId,
        expectedVersion: 0,
        sources: [{ sourceType: "external_link", url: "https://example.invalid/workstream" }],
        reason: "Initial shared workstream document",
      },
    });
    expect(created).toMatchObject({
      kind: "workstream",
      resourceId: workstreamId,
      currentVersion: 1,
      templateVersionId: workstreamTemplateVersionId,
    });
  });

  it("creates one stable project document, pins the template, and retains every version", async () => {
    const firstSource = await upload("first-source");
    const secondSource = await upload("second-source");
    const created = await service.create({
      actor: actor(),
      correlationId: crypto.randomUUID(),
      input: {
        kind: "project",
        resourceId: projectId,
        expectedVersion: 0,
        sources: [{ sourceType: "upload", uploadedSourceId: firstSource.id }],
        reason: "Initial document",
      },
    });
    expect(created).toMatchObject({
      kind: "project",
      resourceId: projectId,
      currentVersion: 1,
      templateVersionId,
    });

    await expect(
      service.create({
        actor: actor(),
        correlationId: crypto.randomUUID(),
        input: {
          kind: "project",
          resourceId: projectId,
          expectedVersion: 0,
          sources: [{ sourceType: "external_link", url: "https://example.invalid/duplicate" }],
          reason: "Duplicate document",
        },
      }),
    ).rejects.toMatchObject({ code: "DOCUMENT_ALREADY_EXISTS" });

    const appended = await service.appendVersion({
      actor: actor(),
      correlationId: crypto.randomUUID(),
      documentId: created.id,
      input: {
        expectedVersion: 1,
        sources: [
          { sourceType: "upload", uploadedSourceId: secondSource.id },
          {
            sourceType: "github",
            url: "https://github.com/example/repository/pull/1",
            sourceId: "1",
          },
        ],
        reason: "Approved update",
      },
    });
    expect(appended).toMatchObject({
      id: created.id,
      currentVersion: 2,
      templateVersionId,
    });

    await expect(
      service.appendVersion({
        actor: actor(),
        correlationId: crypto.randomUUID(),
        documentId: created.id,
        input: {
          expectedVersion: 1,
          sources: [{ sourceType: "external_link", url: "https://example.invalid/stale" }],
          reason: "Stale update",
        },
      }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });

    const detail = await service.get({
      actor: actor(),
      correlationId: crypto.randomUUID(),
      documentId: created.id,
    });
    expect(detail.versions.map(({ version }) => version)).toEqual([1, 2]);
    expect(detail.versions.map(({ templateVersionId: pinned }) => pinned)).toEqual([
      templateVersionId,
      templateVersionId,
    ]);
    expect(JSON.stringify(detail)).not.toContain("objectKey");
    await expect(
      database.auditEvent.count({
        where: {
          targetId: created.id,
          eventType: { in: ["document.created", "document.version_created"] },
        },
      }),
    ).resolves.toBe(2);
  });

  it("authorizes exact resource lookup before returning a document or null", async () => {
    await expect(
      service.getByResource({
        actor: actor(),
        correlationId: crypto.randomUUID(),
        kind: "project",
        resourceId: projectId,
      }),
    ).resolves.toMatchObject({ kind: "project", resourceId: projectId });
    await expect(
      service.getByResource({
        actor: { userId: outsiderId, active: true },
        correlationId: crypto.randomUUID(),
        kind: "project",
        resourceId: projectId,
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_SCOPE_MISMATCH" });

    const emptyScope = await database.authorizationScope.create({
      data: {
        key: `document-empty-workstream-${crypto.randomUUID()}`,
        scopeType: "workstream",
        departmentId,
      },
    });
    const empty = await database.workstream.create({
      data: {
        projectId,
        authorizationScopeId: emptyScope.id,
        authorizationScopeType: "workstream",
        name: "No document",
        description: "Authorized absence",
        status: "active",
        createdById: managerId,
      },
    });
    await expect(
      service.getByResource({
        actor: actor(),
        correlationId: crypto.randomUUID(),
        kind: "workstream",
        resourceId: empty.id,
      }),
    ).resolves.toBeNull();
  });

  it("permits only one concurrent append for the same optimistic token", async () => {
    const document = await database.documentRecord.findUniqueOrThrow({ where: { projectId } });
    const sourceA = await upload("concurrent-a");
    const sourceB = await upload("concurrent-b");
    const append = (uploadedSourceId: string, reason: string) =>
      service.appendVersion({
        actor: actor(),
        correlationId: crypto.randomUUID(),
        documentId: document.id,
        input: {
          expectedVersion: 2,
          sources: [{ sourceType: "upload", uploadedSourceId }],
          reason,
        },
      });
    const results = await Promise.allSettled([
      append(sourceA.id, "Concurrent A"),
      append(sourceB.id, "Concurrent B"),
    ]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toEqual([
      expect.objectContaining({ reason: expect.objectContaining({ code: "VERSION_CONFLICT" }) }),
    ]);
    await expect(
      database.documentVersion.count({ where: { documentId: document.id } }),
    ).resolves.toBe(3);
  });
});
import { createHash } from "node:crypto";
