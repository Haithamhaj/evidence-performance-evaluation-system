import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient } from "@evaluation/database";
import {
  createProjectService,
  createResponsibilityService,
  createWorkstreamService,
  ProjectService,
  ResponsibilityService,
  WorkstreamService,
} from "@evaluation/projects";
import { Module } from "@nestjs/common";
import { NestFactory, Reflector } from "@nestjs/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  AUTH_DATABASE,
  AUTH_TOKEN_VALIDATOR,
  AUTH_USER_SYNCHRONIZER,
  AUTH_VALIDATION_CONFIG,
  AuthGuard,
} from "../auth/auth.guard.js";
import { AppErrorFilter } from "../platform/error.filter.js";
import { PROJECTS_POLICY_DATABASE, ProjectPolicyGuard } from "./project-policy-loaders.js";
import { ProjectsAuthenticationGuard } from "./projects-authentication.guard.js";
import { ProjectsController } from "./projects.controller.js";
import { ResponsibilitiesController } from "./responsibilities.controller.js";
import { WorkstreamsController } from "./workstreams.controller.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
let clock = new Date("2026-07-17T12:00:00Z");
let app: import("@nestjs/common").INestApplication | undefined;
let baseUrl: string;

type Fixture = Readonly<{
  departmentId: string;
  managerId: string;
  otherManagerId: string;
  administratorId: string;
  ownerAId: string;
  ownerBId: string;
  ownerCId: string;
  contributorAId: string;
  contributorBId: string;
  unassignedId: string;
}>;

let fixture: Fixture;

async function seedFixture(): Promise<Fixture> {
  const suffix = crypto.randomUUID();
  const organization = await client.organization.create({
    data: { key: `bundle-a-e2e-org-${suffix}`, name: "Bundle A E2E Organization" },
  });
  const department = await client.department.create({
    data: {
      key: `bundle-a-e2e-department-${suffix}`,
      name: "Bundle A Department",
      organizationId: organization.id,
    },
  });
  const otherDepartment = await client.department.create({
    data: {
      key: `bundle-a-e2e-other-${suffix}`,
      name: "Other Department",
      organizationId: organization.id,
    },
  });
  const departmentScope = await client.authorizationScope.create({
    data: {
      key: `bundle-a-e2e-department-scope-${suffix}`,
      scopeType: "department",
      departmentId: department.id,
    },
  });
  const otherDepartmentScope = await client.authorizationScope.create({
    data: {
      key: `bundle-a-e2e-other-scope-${suffix}`,
      scopeType: "department",
      departmentId: otherDepartment.id,
    },
  });
  const systemScope = await client.authorizationScope.create({
    data: { key: `bundle-a-e2e-system-${suffix}`, scopeType: "system" },
  });
  const createUser = (key: string) =>
    client.user.create({
      data: { email: `${key}-${suffix}@example.invalid`, displayName: key },
    });
  const [
    manager,
    otherManager,
    administrator,
    ownerA,
    ownerB,
    ownerC,
    contributorA,
    contributorB,
    unassigned,
  ] = await Promise.all([
    createUser("manager"),
    createUser("other-manager"),
    createUser("administrator"),
    createUser("owner-a"),
    createUser("owner-b"),
    createUser("owner-c"),
    createUser("contributor-a"),
    createUser("contributor-b"),
    createUser("unassigned"),
  ]);
  await client.roleAssignment.createMany({
    data: [
      { userId: manager.id, role: "manager", scopeType: "department", scopeId: departmentScope.id },
      {
        userId: otherManager.id,
        role: "manager",
        scopeType: "department",
        scopeId: otherDepartmentScope.id,
      },
      {
        userId: otherManager.id,
        role: "employee",
        scopeType: "department",
        scopeId: otherDepartmentScope.id,
      },
      {
        userId: administrator.id,
        role: "system_administrator",
        scopeType: "system",
        scopeId: systemScope.id,
      },
      ...[ownerA, ownerB, ownerC, contributorA, contributorB, unassigned].map((user) => ({
        userId: user.id,
        role: "employee" as const,
        scopeType: "department" as const,
        scopeId: departmentScope.id,
      })),
    ],
  });
  return {
    departmentId: department.id,
    managerId: manager.id,
    otherManagerId: otherManager.id,
    administratorId: administrator.id,
    ownerAId: ownerA.id,
    ownerBId: ownerB.id,
    ownerCId: ownerC.id,
    contributorAId: contributorA.id,
    contributorBId: contributorB.id,
    unassignedId: unassigned.id,
  };
}

class TestProjectsModule {}

Module({
  controllers: [ProjectsController, WorkstreamsController, ResponsibilitiesController],
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
    ProjectsAuthenticationGuard,
    { provide: PROJECTS_POLICY_DATABASE, useValue: client },
    {
      provide: ProjectPolicyGuard,
      useFactory: () => new ProjectPolicyGuard(new Reflector(), client),
    },
    {
      provide: ProjectService,
      useValue: createProjectService(client, databaseAuditWriter as never, () => clock),
    },
    {
      provide: WorkstreamService,
      useValue: createWorkstreamService(client, databaseAuditWriter as never, () => clock),
    },
    {
      provide: ResponsibilityService,
      useValue: createResponsibilityService(client, databaseAuditWriter as never, () => clock),
    },
  ],
})(TestProjectsModule);

beforeAll(async () => {
  fixture = await seedFixture();
  app = await NestFactory.create(TestProjectsModule, { abortOnError: false, logger: ["error"] });
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

async function request(
  method: "GET" | "PATCH" | "POST",
  path: string,
  token: string,
  body?: unknown,
) {
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
  return { response, body: (await response.json()) as Record<string, unknown>, correlationId };
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

describe("Phase 1 Bundle A composed API", () => {
  it("executes governed flows and denies other-department or unassigned access", async () => {
    const projectResult = await request("POST", "/api/v1/projects", fixture.managerId, {
      departmentId: fixture.departmentId,
      name: "Evaluation Platform",
      description: "Bundle A composed flow",
      primaryOwnerId: fixture.ownerAId,
      startsAt: "2026-07-17T06:00:00Z",
      reason: "Approved project",
    });
    expect(projectResult.response.status).toBe(201);
    const projectId = projectResult.body.id as string;

    const createWorkstream = async (name: string, ownerId: string) => {
      const result = await request(
        "POST",
        `/api/v1/projects/${projectId}/workstreams`,
        fixture.managerId,
        {
          name,
          description: `${name} delivery`,
          primaryOwnerId: ownerId,
          startsAt: "2026-07-17T07:00:00Z",
          reason: "Approved workstream",
        },
      );
      expect(result.response.status).toBe(201);
      return result.body;
    };
    const workstreamA = await createWorkstream("API", fixture.ownerAId);
    const workstreamB = await createWorkstream("UI", fixture.ownerBId);
    const workstreamAId = workstreamA.id as string;
    const workstreamBId = workstreamB.id as string;

    for (const [userId, startsAt] of [
      [fixture.contributorAId, "2026-07-17T08:00:00Z"],
      [fixture.contributorBId, "2026-07-17T08:30:00Z"],
    ] as const) {
      const added = await request(
        "POST",
        `/api/v1/projects/${projectId}/workstreams/${workstreamAId}/contributors`,
        fixture.managerId,
        { userId, startsAt, reason: "Approved contribution" },
      );
      expect(added.response.status).toBe(201);
    }
    const ended = await request(
      "POST",
      `/api/v1/projects/${projectId}/workstreams/${workstreamAId}/contributors/${fixture.contributorAId}/end`,
      fixture.managerId,
      {
        endsAt: "2026-07-17T10:00:00Z",
        reason: "Contribution completed",
        expectedVersion: 1,
      },
    );
    expect(ended.response.status).toBe(201);

    const actingProject = await request(
      "POST",
      `/api/v1/projects/${projectId}/owner-transfers`,
      fixture.managerId,
      {
        transferKind: "acting",
        toUserId: fixture.ownerBId,
        effectiveAt: "2026-08-01T00:00:00Z",
        endsAt: "2026-08-08T00:00:00Z",
        delegationType: "approved_leave",
        reason: "Approved project coverage",
        expectedVersion: 1,
      },
    );
    expect(actingProject.response.status).toBe(201);
    expect(actingProject.body.returnWindowId).toEqual(expect.any(String));

    const permanentWorkstream = await request(
      "POST",
      `/api/v1/projects/${projectId}/workstreams/${workstreamAId}/owner-transfers`,
      fixture.managerId,
      {
        transferKind: "permanent",
        toUserId: fixture.ownerCId,
        effectiveAt: "2026-08-01T00:00:00Z",
        reason: "Approved workstream transfer",
        expectedVersion: 2,
      },
    );
    expect(permanentWorkstream.response.status).toBe(201);

    const actingWorkstream = await request(
      "POST",
      `/api/v1/projects/${projectId}/workstreams/${workstreamBId}/owner-transfers`,
      fixture.managerId,
      {
        transferKind: "acting",
        toUserId: fixture.ownerCId,
        effectiveAt: "2026-08-01T00:00:00Z",
        endsAt: "2026-08-08T00:00:00Z",
        delegationType: "approved_leave",
        reason: "Approved workstream coverage",
        expectedVersion: 1,
      },
    );
    expect(actingWorkstream.response.status).toBe(201);

    for (const [at, employeeId] of [
      ["2026-07-31T23:59:59Z", fixture.ownerAId],
      ["2026-08-01T00:00:00Z", fixture.ownerBId],
      ["2026-08-08T00:00:00Z", fixture.ownerAId],
    ] as const) {
      const point = await request(
        "GET",
        `/api/v1/projects/${projectId}/responsibilities?at=${encodeURIComponent(at)}`,
        fixture.managerId,
      );
      expect(point.response.status).toBe(200);
      expect(point.body).toEqual(expect.arrayContaining([expect.objectContaining({ employeeId })]));
    }
    const history = await request(
      "GET",
      `/api/v1/projects/${projectId}/responsibilities/history`,
      fixture.managerId,
    );
    expect(history.response.status).toBe(200);
    expect(history.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ endsAt: expect.any(String) })]),
    );

    expectSafeError(
      await request("POST", `/api/v1/projects/${projectId}/owner-transfers`, fixture.ownerAId, {
        transferKind: "permanent",
        toUserId: fixture.ownerCId,
        effectiveAt: "2026-08-09T00:00:00Z",
        reason: "Owner cannot transfer",
        expectedVersion: 2,
      }),
      403,
      "AUTHZ_ROLE_REQUIRED",
    );
    expectSafeError(
      await request(
        "POST",
        `/api/v1/projects/${projectId}/owner-transfers`,
        fixture.administratorId,
        {
          transferKind: "permanent",
          toUserId: fixture.ownerCId,
          effectiveAt: "2026-08-09T00:00:00Z",
          reason: "Administrator cannot transfer",
          expectedVersion: 2,
        },
      ),
      403,
      "AUTHZ_ROLE_REQUIRED",
    );
    for (const token of [fixture.otherManagerId, fixture.unassignedId]) {
      expectSafeError(
        await request("GET", `/api/v1/projects/${projectId}`, token),
        403,
        "AUTHZ_SCOPE_MISMATCH",
      );
    }

    expectSafeError(
      await request("PATCH", `/api/v1/projects/${projectId}/status`, fixture.managerId, {
        status: "completed",
        reason: "Premature project completion",
        expectedVersion: 2,
      }),
      409,
      "ACTIVE_WORKSTREAMS_REMAIN",
    );
    expectSafeError(
      await request(
        "PATCH",
        `/api/v1/projects/${projectId}/workstreams/${workstreamBId}/status`,
        fixture.managerId,
        {
          status: "completed",
          reason: "Premature workstream completion",
          expectedVersion: 2,
        },
      ),
      409,
      "SCHEDULED_OWNERSHIP_REMAINS",
    );

    clock = new Date("2026-08-08T00:00:01Z");
    const completeWorkstream = async (workstreamId: string, expectedVersion: number) => {
      const result = await request(
        "PATCH",
        `/api/v1/projects/${projectId}/workstreams/${workstreamId}/status`,
        fixture.managerId,
        { status: "completed", reason: "Approved completion", expectedVersion },
      );
      expect(result.response.status).toBe(200);
      expect(result.body).toMatchObject({ status: "completed", primaryOwnerId: null });
    };
    await completeWorkstream(workstreamAId, 3);
    await completeWorkstream(workstreamBId, 2);
    const completedProject = await request(
      "PATCH",
      `/api/v1/projects/${projectId}/status`,
      fixture.managerId,
      { status: "completed", reason: "Approved project completion", expectedVersion: 2 },
    );
    expect(completedProject.response.status).toBe(200);
    expect(completedProject.body).toMatchObject({ status: "completed", primaryOwnerId: null });

    await expect(
      client.workstreamStatusTransition.count({
        where: { workstreamId: { in: [workstreamAId, workstreamBId] } },
      }),
    ).resolves.toBe(2);
    await expect(
      client.projectStatusTransition.findFirstOrThrow({
        where: { projectId, toStatus: "completed" },
      }),
    ).resolves.toMatchObject({ actorId: fixture.managerId, reason: "Approved project completion" });
    await expect(
      client.auditEvent.count({
        where: { scopeId: { in: [projectId, workstreamAId, workstreamBId] } },
      }),
    ).resolves.toBeGreaterThanOrEqual(12);
    await expect(
      client.responsibilityWindow.count({ where: { projectId } }),
    ).resolves.toBeGreaterThanOrEqual(3);
  });
});
