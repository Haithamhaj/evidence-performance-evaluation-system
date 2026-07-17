import { databaseAuditWriter } from "@evaluation/audit";
import { PROJECT_PROTECTED_SECTION_KEYS } from "@evaluation/contracts";
import { createDatabaseClient } from "@evaluation/database";
import { DocumentService, TemplateService } from "@evaluation/documents";
import { createProjectService, DocumentResourceReader } from "@evaluation/projects";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  AUTH_DATABASE,
  AUTH_TOKEN_VALIDATOR,
  AUTH_USER_SYNCHRONIZER,
  AUTH_VALIDATION_CONFIG,
  AuthGuard,
} from "../auth/auth.guard.js";
import { AppErrorFilter } from "../platform/error.filter.js";
import { DocumentsAuthenticationGuard } from "./documents-authentication.guard.js";
import { DocumentsController } from "./documents.controller.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const now = new Date("2026-07-17T12:00:00Z");
let app: import("@nestjs/common").INestApplication | undefined;
let baseUrl = "";

type Fixture = Readonly<{
  projectId: string;
  managerId: string;
  otherManagerId: string;
  contributorId: string;
}>;

let fixture: Fixture;

async function seedFixture(): Promise<Fixture> {
  const suffix = crypto.randomUUID();
  const organization = await client.organization.create({
    data: { key: `documents-e2e-org-${suffix}`, name: "Documents E2E Organization" },
  });
  const department = await client.department.create({
    data: {
      key: `documents-e2e-department-${suffix}`,
      name: "Documents E2E Department",
      organizationId: organization.id,
    },
  });
  const otherDepartment = await client.department.create({
    data: {
      key: `documents-e2e-other-${suffix}`,
      name: "Other Documents Department",
      organizationId: organization.id,
    },
  });
  const departmentScope = await client.authorizationScope.create({
    data: {
      key: `documents-e2e-scope-${suffix}`,
      scopeType: "department",
      departmentId: department.id,
    },
  });
  const otherDepartmentScope = await client.authorizationScope.create({
    data: {
      key: `documents-e2e-other-scope-${suffix}`,
      scopeType: "department",
      departmentId: otherDepartment.id,
    },
  });
  const createUser = (key: string) =>
    client.user.create({
      data: { email: `${key}-${suffix}@example.invalid`, displayName: key },
    });
  const [manager, otherManager, owner, contributor] = await Promise.all([
    createUser("documents-manager"),
    createUser("documents-other-manager"),
    createUser("documents-owner"),
    createUser("documents-contributor"),
  ]);
  await client.roleAssignment.createMany({
    data: [
      {
        userId: manager.id,
        role: "manager",
        scopeType: "department",
        scopeId: departmentScope.id,
      },
      {
        userId: otherManager.id,
        role: "manager",
        scopeType: "department",
        scopeId: otherDepartmentScope.id,
      },
      ...[owner, contributor].map((user) => ({
        userId: user.id,
        role: "employee" as const,
        scopeType: "department" as const,
        scopeId: departmentScope.id,
      })),
    ],
  });

  const projects = createProjectService(client, databaseAuditWriter as never, () => now);
  const project = await projects.createProject({
    actor: { userId: manager.id, active: true },
    correlationId: crypto.randomUUID(),
    input: {
      departmentId: department.id,
      name: "Versioned Project Document",
      description: "Document HTTP integration fixture",
      primaryOwnerId: owner.id,
      startsAt: "2026-07-17T06:00:00Z",
      reason: "Approved project",
    },
  });
  await projects.addProjectMember({
    actor: { userId: manager.id, active: true },
    correlationId: crypto.randomUUID(),
    projectId: project.id,
    input: {
      userId: contributor.id,
      startsAt: "2026-07-17T08:00:00Z",
      reason: "Approved document contributor",
    },
  });

  const templates = new TemplateService(client, databaseAuditWriter as never, () => now);
  const version = await templates.createVersion({
    actor: { userId: manager.id, active: true },
    correlationId: crypto.randomUUID(),
    input: {
      expectedVersion: 0,
      scopeType: "department",
      organizationId: organization.id,
      departmentId: department.id,
      kind: "project",
      sections: PROJECT_PROTECTED_SECTION_KEYS.map((key, index) => ({
        key,
        position: index + 1,
        display: { en: { title: key.replaceAll("_", " ") } },
        required: true,
        protected: true,
      })),
      reason: "Initial project document template",
    },
  });
  await templates.activate({
    actor: { userId: manager.id, active: true },
    correlationId: crypto.randomUUID(),
    templateId: version.templateId,
    versionId: version.id,
    input: { expectedVersion: 1, reason: "Approved project document template" },
  });

  return {
    projectId: project.id,
    managerId: manager.id,
    otherManagerId: otherManager.id,
    contributorId: contributor.id,
  };
}

class TestDocumentsModule {}

Module({
  controllers: [DocumentsController],
  providers: [
    { provide: AUTH_VALIDATION_CONFIG, useValue: {} },
    { provide: AUTH_DATABASE, useValue: client },
    {
      provide: AUTH_TOKEN_VALIDATOR,
      useValue: async (token: string) => ({
        email: `${token}@example.invalid`,
        issuer: "https://identity.test/realms/evaluation",
        oidcSubject: token,
      }),
    },
    {
      provide: AUTH_USER_SYNCHRONIZER,
      useValue: async (
        _database: unknown,
        external: import("@evaluation/auth").ValidatedOidcPrincipal,
      ) => {
        const user = await client.user.findUniqueOrThrow({
          where: { id: external.oidcSubject },
        });
        return {
          userId: user.id,
          active: user.active,
          email: user.email,
          oidcSubject: external.oidcSubject,
          roles: [],
        } satisfies import("@evaluation/auth").AuthenticatedPrincipal;
      },
    },
    AuthGuard,
    DocumentsAuthenticationGuard,
    {
      provide: DocumentService,
      useValue: new DocumentService(
        client,
        new DocumentResourceReader(client),
        databaseAuditWriter as never,
        () => now,
      ),
    },
  ],
})(TestDocumentsModule);

beforeAll(async () => {
  fixture = await seedFixture();
  app = await NestFactory.create(TestDocumentsModule, { abortOnError: false, logger: ["error"] });
  app.useGlobalFilters(new AppErrorFilter());
  app.use(
    (
      request: { headers: Record<string, string | undefined>; correlationId?: string },
      _response: unknown,
      next: () => void,
    ) => {
      request.correlationId = request.headers["x-correlation-id"] ?? crypto.randomUUID();
      next();
    },
  );
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address() as import("node:net").AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await app?.close();
  await client.$disconnect();
});

async function request(method: "GET" | "POST", path: string, token: string, body?: unknown) {
  const correlationId = crypto.randomUUID();
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-correlation-id": correlationId,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    response,
    body: (await response.json()) as Record<string, unknown>,
    correlationId,
  };
}

function expectSafeError(
  result: Awaited<ReturnType<typeof request>>,
  status: number,
  code: string,
) {
  expect(result.response.status).toBe(status);
  expect(result.body).toMatchObject({
    code,
    correlationId: result.correlationId,
    messageKey: expect.any(String),
  });
  expect(JSON.stringify(result.body)).not.toMatch(/Prisma|database|stack|query/iu);
}

describe("Phase 1 T023 composed document API", () => {
  it("creates one document, preserves versions, and enforces resource authorization", async () => {
    const createInput = {
      kind: "project",
      resourceId: fixture.projectId,
      expectedVersion: 0,
      sources: [
        {
          sourceType: "external_link",
          url: "https://example.invalid/project-document-v1",
        },
      ],
      reason: "Initial approved project document",
    };
    const created = await request("POST", "/api/v1/documents", fixture.managerId, createInput);
    expect(created.response.status).toBe(201);
    expect(created.body).toMatchObject({ currentVersion: 1, versions: [{ version: 1 }] });
    const documentId = created.body.id as string;

    const appended = await request(
      "POST",
      `/api/v1/documents/${documentId}/versions`,
      fixture.managerId,
      {
        expectedVersion: 1,
        sources: [
          {
            sourceType: "external_link",
            url: "https://example.invalid/project-document-v2",
          },
        ],
        reason: "Approved project document revision",
      },
    );
    expect(appended.response.status).toBe(201);
    expect(appended.body).toMatchObject({
      currentVersion: 2,
      versions: [{ version: 1 }, { version: 2 }],
    });

    const history = await request("GET", `/api/v1/documents/${documentId}`, fixture.managerId);
    expect(history.response.status).toBe(200);
    expect(history.body).toMatchObject({
      currentVersion: 2,
      versions: [{ version: 1 }, { version: 2 }],
    });

    expectSafeError(
      await request("POST", `/api/v1/documents/${documentId}/versions`, fixture.managerId, {
        expectedVersion: 1,
        sources: [
          {
            sourceType: "external_link",
            url: "https://example.invalid/stale-document-version",
          },
        ],
        reason: "Stale project document revision",
      }),
      409,
      "VERSION_CONFLICT",
    );
    expectSafeError(
      await request("POST", "/api/v1/documents", fixture.managerId, {
        ...createInput,
        sources: [
          {
            sourceType: "external_link",
            url: "https://example.invalid/duplicate-project-document",
          },
        ],
        reason: "Duplicate project document",
      }),
      409,
      "DOCUMENT_ALREADY_EXISTS",
    );
    expectSafeError(
      await request("POST", `/api/v1/documents/${documentId}/versions`, fixture.contributorId, {
        expectedVersion: 2,
        sources: [
          {
            sourceType: "external_link",
            url: "https://example.invalid/contributor-write",
          },
        ],
        reason: "Contributor must not write",
      }),
      403,
      "AUTHZ_ROLE_REQUIRED",
    );

    const contributorRead = await request(
      "GET",
      `/api/v1/documents/${documentId}`,
      fixture.contributorId,
    );
    expect(contributorRead.response.status).toBe(200);
    expect(contributorRead.body).toMatchObject({ id: documentId, currentVersion: 2 });

    expectSafeError(
      await request("GET", `/api/v1/documents/${documentId}`, fixture.otherManagerId),
      403,
      "AUTHZ_SCOPE_MISMATCH",
    );
  });
});
