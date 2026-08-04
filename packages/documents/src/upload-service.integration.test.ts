import { Readable } from "node:stream";

import { S3Client } from "@aws-sdk/client-s3";
import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient } from "@evaluation/database";
import { DocumentResourceReader } from "@evaluation/projects";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ClamAvScanner } from "./clamav-scanner.js";
import { parseDocumentRuntimeConfig } from "./document-config.js";
import { S3PrivateStorage } from "./s3-private-storage.js";
import { UploadService } from "./upload-service.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const config = parseDocumentRuntimeConfig(process.env);
const s3 = new S3Client({
  credentials: {
    accessKeyId: config.storage.accessKeyId,
    secretAccessKey: config.storage.secretAccessKey,
  },
  endpoint: config.storage.endpoint,
  forcePathStyle: true,
  region: config.storage.region,
});
const storage = new S3PrivateStorage(s3, config.storage.bucket);
const scanner = new ClamAvScanner(config.scanner);
const reader = new DocumentResourceReader(database);
const service = new UploadService(
  database,
  reader,
  storage,
  scanner,
  config.policy,
  databaseAuditWriter as never,
);

let managerId = "";
let projectId = "";
let objectKey = "";

beforeAll(async () => {
  const suffix = crypto.randomUUID();
  const organization = await database.organization.create({
    data: { key: `upload-service-org-${suffix}`, name: "Upload Organization" },
  });
  const department = await database.department.create({
    data: {
      key: `upload-service-department-${suffix}`,
      name: "Upload Department",
      organizationId: organization.id,
    },
  });
  const departmentScope = await database.authorizationScope.create({
    data: {
      key: `upload-service-department-scope-${suffix}`,
      scopeType: "department",
      departmentId: department.id,
    },
  });
  const manager = await database.user.create({
    data: { email: `upload-manager-${suffix}@example.invalid`, displayName: "Upload Manager" },
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
      key: `upload-service-project-scope-${suffix}`,
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
      name: "Upload Project",
      description: "Private upload integration fixture",
      status: "active",
      createdById: manager.id,
    },
  });
  managerId = manager.id;
  projectId = project.id;
});

afterAll(async () => {
  if (objectKey.length > 0) await storage.delete(objectKey);
  s3.destroy();
  await database.$disconnect();
});

describe("UploadService with PostgreSQL, MinIO, and ClamAV", () => {
  it("persists safe metadata, keeps the object private, and reauthorizes signed access", async () => {
    const bytes = Buffer.from("%PDF-1.7\nprivate integration source\n");
    const correlationId = crypto.randomUUID();
    const uploaded = await service.stage(
      {
        actor: { userId: managerId, active: true },
        correlationId,
        metadata: {
          kind: "project",
          resourceId: projectId,
          filename: "integration-report.pdf",
          declaredMime: "application/pdf",
          reason: "Approved integration source",
        },
      },
      Readable.from([bytes]),
    );
    const persisted = await database.uploadedSource.findUniqueOrThrow({
      where: { id: uploaded.id },
    });
    objectKey = persisted.objectKey;
    expect(persisted).toMatchObject({
      projectId,
      detectedType: "pdf",
      detectedMime: "application/pdf",
      byteSize: bytes.length,
      createdById: managerId,
    });
    expect(
      await fetch(`${config.storage.endpoint}/${config.storage.bucket}/${objectKey}`),
    ).toMatchObject({ status: 403 });

    const signed = await service.signRead({
      actor: { userId: managerId, active: true },
      correlationId: crypto.randomUUID(),
      uploadedSourceId: uploaded.id,
    });
    const response = await fetch(signed.url);
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe(bytes.toString("utf8"));
    await expect(
      database.auditEvent.count({
        where: {
          targetId: uploaded.id,
          eventType: { in: ["document.upload_staged", "document.upload_read_signed"] },
        },
      }),
    ).resolves.toBe(2);
  });
});
