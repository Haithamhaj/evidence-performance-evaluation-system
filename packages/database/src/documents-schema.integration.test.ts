import { afterAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "./index.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

type Graph = Readonly<{
  organizationId: string;
  departmentId: string;
  actorId: string;
  projectId: string;
  workstreamId: string;
  templateId: string;
  templateVersionId: string;
}>;

async function seedGraph(): Promise<Graph> {
  const suffix = crypto.randomUUID();
  const actor = await client.user.create({
    data: { email: `document-schema-${suffix}@example.invalid`, displayName: "Schema Actor" },
  });
  const organization = await client.organization.create({
    data: { key: `document-schema-org-${suffix}`, name: "Schema Organization" },
  });
  const department = await client.department.create({
    data: {
      key: `document-schema-department-${suffix}`,
      name: "Schema Department",
      organizationId: organization.id,
    },
  });
  const projectId = crypto.randomUUID();
  const workstreamId = crypto.randomUUID();
  await client.authorizationScope.createMany({
    data: [
      {
        id: projectId,
        key: `document-schema-project-${suffix}`,
        scopeType: "project",
        departmentId: department.id,
      },
      {
        id: workstreamId,
        key: `document-schema-workstream-${suffix}`,
        scopeType: "workstream",
        departmentId: department.id,
      },
    ],
  });
  await client.project.create({
    data: {
      id: projectId,
      organizationId: organization.id,
      departmentId: department.id,
      authorizationScopeId: projectId,
      authorizationScopeType: "project",
      name: "Schema Project",
      description: "Document schema fixture",
      status: "active",
      createdById: actor.id,
    },
  });
  await client.workstream.create({
    data: {
      id: workstreamId,
      projectId,
      authorizationScopeId: workstreamId,
      authorizationScopeType: "workstream",
      name: "Schema Workstream",
      description: "Document schema child fixture",
      status: "active",
      createdById: actor.id,
    },
  });
  const template = await client.documentTemplate.create({
    data: {
      organizationId: organization.id,
      departmentId: department.id,
      scopeType: "department",
      kind: "project",
      lockVersion: 1,
      createdById: actor.id,
      versions: {
        create: {
          version: 1,
          status: "active",
          reason: "Initial schema template",
          createdById: actor.id,
          activatedAt: new Date(),
          sections: {
            create: {
              key: "project_definition_and_ownership",
              position: 1,
              display: { en: { title: "Project Definition and Ownership" } },
              required: true,
              protected: true,
            },
          },
        },
      },
    },
    include: { versions: true },
  });
  return {
    organizationId: organization.id,
    departmentId: department.id,
    actorId: actor.id,
    projectId,
    workstreamId,
    templateId: template.id,
    templateVersionId: template.versions[0]!.id,
  };
}

function databaseConstraint(error: unknown): boolean {
  if (error instanceof Error && /immutable|constraint|unique/iu.test(error.message)) return true;
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && ["P2002", "P2003", "P2010"].includes(String(error.code))) return true;
  if ("cause" in error) return databaseConstraint(error.cause);
  if ("meta" in error) return databaseConstraint(error.meta);
  return "driverAdapterError" in error && databaseConstraint(error.driverAdapterError);
}

afterAll(async () => client.$disconnect());

describe("documents schema", () => {
  it("enforces exactly one stable document for a project", async () => {
    const graph = await seedGraph();
    const create = () =>
      client.documentRecord.create({
        data: {
          organizationId: graph.organizationId,
          departmentId: graph.departmentId,
          projectId: graph.projectId,
          templateVersionId: graph.templateVersionId,
          currentVersion: 0,
          createdById: graph.actorId,
        },
      });
    await create();
    await expect(create()).rejects.toSatisfy(databaseConstraint);
  });

  it("enforces one active template per governed scope and kind", async () => {
    const graph = await seedGraph();
    await expect(
      client.documentTemplateVersion.create({
        data: {
          templateId: graph.templateId,
          version: 2,
          status: "active",
          reason: "Conflicting active template",
          createdById: graph.actorId,
          activatedAt: new Date(),
        },
      }),
    ).rejects.toSatisfy(databaseConstraint);
  });

  it("rejects skipped aggregate versions and deletion of historical roots", async () => {
    const graph = await seedGraph();
    const document = await client.documentRecord.create({
      data: {
        organizationId: graph.organizationId,
        departmentId: graph.departmentId,
        projectId: graph.projectId,
        templateVersionId: graph.templateVersionId,
        currentVersion: 0,
        createdById: graph.actorId,
      },
    });
    await expect(
      client.documentTemplate.update({
        where: { id: graph.templateId },
        data: { lockVersion: 3 },
      }),
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      client.documentRecord.update({ where: { id: document.id }, data: { currentVersion: 2 } }),
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      client.documentTemplate.delete({ where: { id: graph.templateId } }),
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      client.documentRecord.delete({ where: { id: document.id } }),
    ).rejects.toSatisfy(databaseConstraint);
  });

  it("retains every document version and source row", async () => {
    const graph = await seedGraph();
    const uploaded = await client.uploadedSource.create({
      data: {
        organizationId: graph.organizationId,
        departmentId: graph.departmentId,
        projectId: graph.projectId,
        originalFilename: "definition.pdf",
        objectKey: `documents/${graph.organizationId}/project/${graph.projectId}/${crypto.randomUUID()}`,
        detectedType: "pdf",
        detectedMime: "application/pdf",
        byteSize: 12,
        sha256: "a".repeat(64),
        createdById: graph.actorId,
        reason: "Initial source",
      },
    });
    const document = await client.documentRecord.create({
      data: {
        organizationId: graph.organizationId,
        departmentId: graph.departmentId,
        projectId: graph.projectId,
        templateVersionId: graph.templateVersionId,
        currentVersion: 0,
        createdById: graph.actorId,
      },
    });
    const version = await client.documentVersion.create({
      data: {
        documentId: document.id,
        version: 1,
        templateVersionId: graph.templateVersionId,
        createdById: graph.actorId,
        reason: "Initial version",
        sources: {
          create: { position: 1, sourceType: "upload", uploadedSourceId: uploaded.id },
        },
      },
      include: { sources: true },
    });
    const section = await client.documentTemplateSection.findFirstOrThrow({
      where: { templateVersionId: graph.templateVersionId },
    });
    await expect(
      client.documentTemplateVersion.update({
        where: { id: graph.templateVersionId },
        data: { reason: "Silent template overwrite" },
      }),
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      client.documentTemplateSection.delete({ where: { id: section.id } }),
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      client.documentVersion.update({
        where: { id: version.id },
        data: { reason: "Silent overwrite" },
      }),
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      client.documentVersionSource.delete({ where: { id: version.sources[0]!.id } }),
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      client.documentVersion.delete({ where: { id: version.id } }),
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      client.uploadedSource.delete({ where: { id: uploaded.id } }),
    ).rejects.toSatisfy(databaseConstraint);
    await expect(
      client.documentTemplateVersion.delete({ where: { id: graph.templateVersionId } }),
    ).rejects.toSatisfy(databaseConstraint);
  });
});
