import {
  ActingAuthorityReader,
  DelegationService,
  HandoverService,
  LeaveService,
  OffboardingService,
  ReturnService,
} from "@evaluation/continuity";
import { createDatabaseClient } from "@evaluation/database";
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
import { ContinuityPolicyGuard } from "./continuity-policy.guard.js";
import { createDatabaseContinuityRuntime } from "./continuity.module.js";
import { DelegationController } from "./delegation.controller.js";
import { HandoverController } from "./handover.controller.js";
import { LeaveController } from "./leave.controller.js";
import { ReassignmentController } from "./reassignment.controller.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const runtime = createDatabaseContinuityRuntime(database);
let app: import("@nestjs/common").INestApplication | undefined;
let baseUrl = "";

type Fixture = Readonly<{
  departmentId: string;
  managerId: string;
  administratorId: string;
  ownerId: string;
  delegateId: string;
  emergencyOwnerId: string;
  emergencyDelegateId: string;
  formerOwnerId: string;
  successorId: string;
  plannedProjectId: string;
  emergencyProjectId: string;
  offboardingProjectId: string;
}>;

let fixture: Fixture;

class TestContinuityModule {}

Module({
  controllers: [LeaveController, HandoverController, DelegationController, ReassignmentController],
  providers: [
    { provide: AUTH_VALIDATION_CONFIG, useValue: {} },
    { provide: AUTH_DATABASE, useValue: database },
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
        const user = await database.user.findUniqueOrThrow({
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
    ContinuityPolicyGuard,
    { provide: LeaveService, useValue: runtime.leave },
    { provide: HandoverService, useValue: runtime.handover },
    { provide: DelegationService, useValue: runtime.delegation },
    { provide: ActingAuthorityReader, useValue: runtime.actingAuthority },
    { provide: ReturnService, useValue: runtime.returns },
    { provide: OffboardingService, useValue: runtime.offboarding },
  ],
})(TestContinuityModule);

beforeAll(async () => {
  fixture = await seedFixture();
  app = await NestFactory.create(TestContinuityModule, {
    abortOnError: false,
    logger: ["error"],
  });
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
  await database.$disconnect();
});

describe.sequential("continuity composed Nest API", () => {
  it("runs planned, emergency, and offboarding journeys through HTTP guards and actor identity", async () => {
    const planned = await leaveAndHandover(
      fixture.ownerId,
      fixture.plannedProjectId,
      fixture.delegateId,
      "planned",
    );

    const spoofedDecision = await request(
      "POST",
      `/api/v1/continuity/leaves/${planned.leaveId}/decision`,
      fixture.delegateId,
      {
        managerId: fixture.managerId,
        decision: "APPROVED",
        reason: "Body identity must not override the authenticated principal",
      },
    );
    expectSafeError(spoofedDecision, 403, "AUTHZ_SCOPE");

    const approvedLeave = await request(
      "POST",
      `/api/v1/continuity/leaves/${planned.leaveId}/decision`,
      fixture.managerId,
      { decision: "APPROVED", reason: "Planned continuity approved" },
    );
    expect(approvedLeave.response.status).toBe(201);

    await reviseAndConfirmHandover(planned, fixture.ownerId, fixture.delegateId);
    const plannedDelegationId = crypto.randomUUID();
    const delegation = await request(
      "POST",
      "/api/v1/continuity/delegations/approve",
      fixture.managerId,
      delegationBody({
        id: plannedDelegationId,
        leaveId: planned.leaveId,
        ownerId: fixture.ownerId,
        delegateId: fixture.delegateId,
        projectId: fixture.plannedProjectId,
        emergency: false,
      }),
    );
    expect(delegation.response.status).toBe(201);
    expect(delegation.body).toMatchObject({ state: "PENDING_DELEGATE" });

    const confirmed = await request(
      "POST",
      "/api/v1/continuity/delegations/confirm",
      fixture.delegateId,
      { delegationId: plannedDelegationId, receiptConfirmed: true, accessConfirmed: true },
    );
    expect(confirmed.response.status).toBe(201);
    const activated = await request(
      "POST",
      `/api/v1/continuity/delegations/${plannedDelegationId}/activate`,
      fixture.managerId,
    );
    expect(activated.response.status).toBe(201);
    expect(activated.body).toMatchObject({ state: "ACTIVE" });
    await expect(
      runtime.actingAuthority.readAt({
        actorId: fixture.delegateId,
        action: "project.update",
        resourceId: fixture.plannedProjectId,
        occurredAt: "2026-08-07T12:00:00.000Z",
      }),
    ).resolves.toMatchObject({ delegationId: plannedDelegationId });

    const returnId = crypto.randomUUID();
    const draftedReturn = await request(
      "POST",
      `/api/v1/continuity/delegations/${plannedDelegationId}/return`,
      fixture.delegateId,
      {
        id: returnId,
        completedWork: "Maintained planned delivery",
        decisionsAndChanges: "Recorded operational decisions",
        openWork: "Original owner resumes delivery",
        risksAndNextSteps: "Review the latest handover notes",
      },
    );
    expect(draftedReturn.response.status).toBe(201);
    const returned = await request(
      "POST",
      `/api/v1/continuity/delegations/${plannedDelegationId}/return/finalize`,
      fixture.managerId,
      {
        returnId,
        expectedVersion: 1,
        choice: "RETURN",
        occurredAt: "2026-08-07T12:00:00.000Z",
        reason: "Approved return to the original owner",
      },
    );
    expect(returned.response.status).toBe(201);
    expect(returned.body).toMatchObject({ state: "FINALIZED", choice: "RETURN" });
    await expect(
      runtime.actingAuthority.readAt({
        actorId: fixture.delegateId,
        action: "project.update",
        resourceId: fixture.plannedProjectId,
        occurredAt: "2026-08-07T12:00:00.001Z",
      }),
    ).resolves.toBeNull();

    const emergency = await leaveAndHandover(
      fixture.emergencyOwnerId,
      fixture.emergencyProjectId,
      fixture.emergencyDelegateId,
      "emergency",
    );
    const emergencyLeave = await request(
      "POST",
      `/api/v1/continuity/leaves/${emergency.leaveId}/decision`,
      fixture.managerId,
      { decision: "APPROVED", reason: "Emergency continuity approved" },
    );
    expect(emergencyLeave.response.status).toBe(201);
    await reviseAndConfirmHandover(
      emergency,
      fixture.emergencyOwnerId,
      fixture.emergencyDelegateId,
    );
    const emergencyDelegationId = crypto.randomUUID();
    const emergencyActivated = await request(
      "POST",
      "/api/v1/continuity/delegations/approve",
      fixture.managerId,
      delegationBody({
        id: emergencyDelegationId,
        leaveId: emergency.leaveId,
        ownerId: fixture.emergencyOwnerId,
        delegateId: fixture.emergencyDelegateId,
        projectId: fixture.emergencyProjectId,
        emergency: true,
      }),
    );
    expect(emergencyActivated.response.status).toBe(201);
    expect(emergencyActivated.body).toMatchObject({ state: "ACTIVE", emergency: true });
    const expired = await request(
      "POST",
      `/api/v1/continuity/delegations/${emergencyDelegationId}/expire`,
      fixture.managerId,
    );
    expect(expired.response.status).toBe(201);
    expect(expired.body).toMatchObject({ state: "EXPIRED" });

    const missingAuthentication = await request("GET", "/api/v1/continuity/reassignments/queue");
    expectSafeError(missingAuthentication, 401, "AUTH_REQUIRED");
    const deactivated = await request(
      "POST",
      `/api/v1/continuity/users/${fixture.formerOwnerId}/deactivate`,
      fixture.administratorId,
      { occurredAt: "2026-08-07T13:00:00.000Z" },
    );
    expect(deactivated.response.status).toBe(201);
    expect(deactivated.body).toMatchObject({ preservedHistory: true });

    const queue = await request("GET", "/api/v1/continuity/reassignments/queue", fixture.managerId);
    expect(queue.response.status).toBe(200);
    expect(queue.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          formerOwnerId: fixture.formerOwnerId,
          state: "REASSIGNMENT_REQUIRED",
        }),
      ]),
    );
    const caseId = (queue.body as unknown as Array<{ id: string }>).find((item) => item.id)!.id;
    const resolved = await request(
      "POST",
      `/api/v1/continuity/reassignments/${caseId}/resolve`,
      fixture.managerId,
      {
        successorId: fixture.successorId,
        effectiveAt: "2026-08-07T13:00:00.000Z",
        reason: "Approved permanent successor",
      },
    );
    expect(resolved.response.status).toBe(201);
    expect(resolved.body).toMatchObject({ state: "RESOLVED" });
    await expect(
      database.responsibilityWindow.findFirst({
        where: {
          projectId: fixture.offboardingProjectId,
          employeeId: fixture.successorId,
          responsibilityType: "permanent",
          endsAt: null,
        },
      }),
    ).resolves.not.toBeNull();
  });
});

async function request(method: "GET" | "POST", path: string, token?: string, body?: unknown) {
  const correlationId = crypto.randomUUID();
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
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
}

async function leaveAndHandover(
  ownerId: string,
  projectId: string,
  delegateId: string,
  label: string,
) {
  const leaveId = crypto.randomUUID();
  const handoverId = crypto.randomUUID();
  const submitted = await request("POST", "/api/v1/continuity/leaves", ownerId, {
    id: leaveId,
    employeeId: fixture.managerId,
    departmentId: fixture.departmentId,
    startsAt: "2026-08-06T08:00:00.000Z",
    endsAt: "2026-08-11T08:00:00.000Z",
    reasonCategory: "PLANNED_LEAVE",
    affectedScopes: [{ kind: "PROJECT", id: projectId }],
  });
  expect(submitted.response.status).toBe(201);
  expect(submitted.body).toMatchObject({ id: leaveId, employeeId: ownerId });
  return { leaveId, handoverId, projectId, delegateId, label };
}

async function reviseAndConfirmHandover(
  input: Awaited<ReturnType<typeof leaveAndHandover>>,
  ownerId: string,
  delegateId: string,
) {
  const revised = await request(
    "POST",
    `/api/v1/continuity/handovers/${input.handoverId}/revisions`,
    ownerId,
    {
      leaveId: input.leaveId,
      expectedRevision: 0,
      items: [
        {
          scope: { kind: "PROJECT", id: input.projectId },
          currentState: `${input.label} delivery active`,
          completedWork: "Current progress documented",
          openWork: "Continue approved delivery",
          blockersAndRisks: "No protected-rule change",
          immediateNextStep: "Continue the next approved milestone",
          keyLinks: ["https://example.invalid/continuity-journey"],
          requiredAccess: ["Project update"],
          pendingDecisions: ["Return or expiry"],
          proposedDelegateId: delegateId,
        },
      ],
    },
  );
  expect(revised.response.status).toBe(201);
  const confirmed = await request(
    "POST",
    `/api/v1/continuity/handovers/${input.handoverId}/confirm`,
    ownerId,
    { expectedRevision: 1 },
  );
  expect(confirmed.response.status).toBe(201);
}

function delegationBody(input: {
  id: string;
  leaveId: string;
  ownerId: string;
  delegateId: string;
  projectId: string;
  emergency: boolean;
}) {
  return {
    id: input.id,
    leaveId: input.leaveId,
    ownerId: input.ownerId,
    delegateId: input.delegateId,
    departmentId: fixture.departmentId,
    startsAt: "2026-08-06T08:00:00.000Z",
    endsAt: "2026-08-09T08:00:00.000Z",
    projectIds: [input.projectId],
    workstreamIds: [],
    actions: ["project.update"],
    emergency: input.emergency,
    emergencyReason: input.emergency ? "Urgent approved continuity coverage" : null,
  };
}

async function seedFixture(): Promise<Fixture> {
  const suffix = crypto.randomUUID();
  const organization = await database.organization.create({
    data: { key: `continuity-http-${suffix}`, name: "Continuity HTTP" },
  });
  const department = await database.department.create({
    data: {
      key: `continuity-http-${suffix}`,
      name: "Continuity HTTP",
      organizationId: organization.id,
    },
  });
  const departmentScope = await database.authorizationScope.create({
    data: {
      key: `continuity-http-department-${suffix}`,
      scopeType: "department",
      departmentId: department.id,
    },
  });
  const systemScope = await database.authorizationScope.upsert({
    where: { key: "system" },
    create: { key: "system", scopeType: "system" },
    update: {},
  });
  const users = await Promise.all(
    [
      "manager",
      "administrator",
      "owner",
      "delegate",
      "emergency-owner",
      "emergency-delegate",
      "former-owner",
      "successor",
    ].map((name) =>
      database.user.create({
        data: { email: `${name}-${suffix}@example.invalid`, displayName: name },
      }),
    ),
  );
  const [
    manager,
    administrator,
    owner,
    delegate,
    emergencyOwner,
    emergencyDelegate,
    formerOwner,
    successor,
  ] = users as [
    (typeof users)[number],
    (typeof users)[number],
    (typeof users)[number],
    (typeof users)[number],
    (typeof users)[number],
    (typeof users)[number],
    (typeof users)[number],
    (typeof users)[number],
  ];
  await database.roleAssignment.createMany({
    data: [
      { userId: manager.id, role: "manager", scopeType: "department", scopeId: departmentScope.id },
      {
        userId: administrator.id,
        role: "system_administrator",
        scopeType: "system",
        scopeId: systemScope.id,
      },
      ...[owner, delegate, emergencyOwner, emergencyDelegate, formerOwner, successor].map(
        (user) => ({
          userId: user.id,
          role: "employee" as const,
          scopeType: "department" as const,
          scopeId: departmentScope.id,
        }),
      ),
    ],
  });

  const createProject = async (name: string, primaryOwnerId: string, participants: string[]) => {
    const projectId = crypto.randomUUID();
    await database.authorizationScope.create({
      data: {
        id: projectId,
        key: `${name.toLowerCase()}-${suffix}`,
        scopeType: "project",
        departmentId: department.id,
      },
    });
    await database.project.create({
      data: {
        id: projectId,
        organizationId: organization.id,
        departmentId: department.id,
        authorizationScopeId: projectId,
        name,
        description: "Real Nest continuity acceptance project",
        status: "active",
        createdById: primaryOwnerId,
      },
    });
    await database.roleAssignment.create({
      data: {
        userId: primaryOwnerId,
        role: "project_owner",
        scopeType: "project",
        scopeId: projectId,
      },
    });
    for (const employeeId of new Set([primaryOwnerId, ...participants])) {
      await database.projectMember.create({
        data: {
          projectId,
          employeeId,
          startsAt: new Date("2026-08-01T00:00:00.000Z"),
          reason: "Continuity HTTP fixture",
          createdById: manager.id,
        },
      });
    }
    await database.responsibilityWindow.create({
      data: {
        employeeId: primaryOwnerId,
        projectId,
        responsibilityType: "original",
        startsAt: new Date("2026-08-01T00:00:00.000Z"),
        reason: "Continuity HTTP fixture owner",
        managerDecisionById: manager.id,
        managerDecisionAt: new Date("2026-08-01T00:00:00.000Z"),
        managerDecisionReason: "Continuity HTTP fixture owner",
        createdById: manager.id,
      },
    });
    return projectId;
  };

  return {
    departmentId: department.id,
    managerId: manager.id,
    administratorId: administrator.id,
    ownerId: owner.id,
    delegateId: delegate.id,
    emergencyOwnerId: emergencyOwner.id,
    emergencyDelegateId: emergencyDelegate.id,
    formerOwnerId: formerOwner.id,
    successorId: successor.id,
    plannedProjectId: await createProject("Planned Continuity", owner.id, [delegate.id]),
    emergencyProjectId: await createProject("Emergency Continuity", emergencyOwner.id, [
      emergencyDelegate.id,
    ]),
    offboardingProjectId: await createProject("Offboarding Continuity", formerOwner.id, [
      successor.id,
    ]),
  };
}
