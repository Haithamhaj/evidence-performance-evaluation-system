import { createDatabaseClient } from "@evaluation/database";
import {
  CoachingDevelopmentPersistence,
  CoachingInsightService,
  DevelopmentActionService,
  FormalDevelopmentPlanService,
  ManagerSupportService,
} from "@evaluation/coaching-development";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AuthGuard } from "../../apps/api/src/auth/auth.guard.js";
import { CoachingActionsController } from "../../apps/api/src/coaching-development/actions.controller.js";
import { ApiCoachingInsightDraftService } from "../../apps/api/src/coaching-development/api-coaching-insight-draft.service.js";
import { CoachingFormalPlansController } from "../../apps/api/src/coaching-development/formal-plans.controller.js";
import { CoachingInsightsController } from "../../apps/api/src/coaching-development/insights.controller.js";
import { CoachingPolicyGuard } from "../../apps/api/src/coaching-development/coaching-policy.guard.js";
import { AppErrorFilter } from "../../apps/api/src/platform/error.filter.js";
import { CorrelationMiddleware } from "../../apps/api/src/platform/correlation.middleware.js";
import { seedCoachingDevelopmentAcceptance } from "../../scripts/seed-coaching-development-acceptance.js";
import { seedManagerEvaluationAcceptance } from "../../scripts/seed-manager-evaluation-acceptance.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
let app: import("@nestjs/common").INestApplication | undefined;
let baseUrl = "";
let employeeId = "";
let managerId = "";
let outsiderId = "";
let insightId = "";
let evidenceId = "";

const authGuard = {
  canActivate(context: import("@nestjs/common").ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined>; principal?: unknown }>();
    const userId = request.headers.authorization?.replace(/^Bearer /u, "");
    if (!userId) return false;
    request.principal = {
      userId,
      email: `${userId}@test.invalid`,
      displayName: "Integration Test User",
      active: true,
    };
    return true;
  },
};

class TestModule {}
Module({
  controllers: [
    CoachingInsightsController,
    CoachingActionsController,
    CoachingFormalPlansController,
  ],
  providers: [
    { provide: AuthGuard, useValue: authGuard },
    { provide: ApiCoachingInsightDraftService, useValue: { draft: async () => undefined } },
    CoachingPolicyGuard,
    {
      provide: CoachingDevelopmentPersistence,
      useFactory: () => new CoachingDevelopmentPersistence(database),
    },
    {
      provide: CoachingInsightService,
      useFactory: (store: CoachingDevelopmentPersistence) => new CoachingInsightService(store),
      inject: [CoachingDevelopmentPersistence],
    },
    {
      provide: DevelopmentActionService,
      useFactory: (store: CoachingDevelopmentPersistence) => new DevelopmentActionService(store),
      inject: [CoachingDevelopmentPersistence],
    },
    {
      provide: ManagerSupportService,
      useFactory: (store: CoachingDevelopmentPersistence) =>
        new ManagerSupportService({
          find: (id) => store.find(id),
          isAuthorizedManager: (employee, manager) => store.isAuthorizedManager(employee, manager),
          append: (entry) => store.appendSupport(entry),
        }),
      inject: [CoachingDevelopmentPersistence],
    },
    {
      provide: FormalDevelopmentPlanService,
      useFactory: (store: CoachingDevelopmentPersistence) =>
        new FormalDevelopmentPlanService({
          find: (id) => store.findPlan(id),
          append: (event) => store.appendPlan(event),
          create: (event) => store.createPlan(event),
          linkEvidence: (event) => store.linkPlanEvidence(event),
        }),
      inject: [CoachingDevelopmentPersistence],
    },
  ],
})(TestModule);

beforeAll(async () => {
  const evaluation = await seedManagerEvaluationAcceptance(database, {
    managerSubject: "coaching-journey-manager",
    adminSubject: "coaching-journey-admin",
    oidcIssuer: "https://issuer.coaching-journey.test",
  });
  const fixture = await seedCoachingDevelopmentAcceptance(database, {
    employeeId: evaluation.employeeId,
    managerId: evaluation.managerId,
  });
  employeeId = fixture.employeeId;
  managerId = fixture.managerId;
  insightId = (
    await database.coachingInsight.create({
      data: { employeeId, state: "DRAFT", version: 1 },
    })
  ).id;
  outsiderId = (
    await database.user.upsert({
      where: { email: "coaching-journey-outsider@test.invalid" },
      create: { email: "coaching-journey-outsider@test.invalid", displayName: "Outside Manager" },
      update: { active: true },
    })
  ).id;
  evidenceId = await createConfirmedEvidence(employeeId);

  app = await NestFactory.create(TestModule, { abortOnError: false, logger: false });
  app.useGlobalFilters(new AppErrorFilter());
  const correlation = new CorrelationMiddleware();
  app.use(correlation.use.bind(correlation));
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address() as import("node:net").AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
  expect(
    (app.get(CoachingInsightsController) as unknown as { insights?: unknown }).insights,
  ).toBeInstanceOf(CoachingInsightService);
});

afterAll(async () => {
  await app?.close();
  await database.$disconnect();
});

describe("coaching development authenticated retained journey", () => {
  it("keeps employee decisions private, permits bounded manager support after sharing, and completes only with confirmed evidence", async () => {
    expect(
      await api("POST", "/api/v1/coaching/insights/decide", employeeId, {
        schemaVersion: 1,
        insightId,
        expectedVersion: 1,
        idempotencyKey: crypto.randomUUID(),
        decision: "EDIT_AND_ACCEPT",
        privateReason: "Employee-owned reflection",
        personalNote: "Keep this note private",
      }),
    ).toMatchObject({ status: 201, body: { insightId, version: 2 } });

    const created = await api("POST", "/api/v1/coaching/actions", employeeId, actionInput());
    expect(created).toMatchObject({ status: 201, body: { id: expect.any(String), version: 1 } });
    const actionId = (created.body as { id: string }).id;

    expect(await api("GET", `/api/v1/coaching/actions/${actionId}`, managerId)).toMatchObject({
      status: 403,
    });
    expect(await support(actionId, managerId, 1)).toMatchObject({ status: 403 });
    expect(await api("GET", `/api/v1/coaching/actions/${actionId}`, outsiderId)).toMatchObject({
      status: 403,
    });

    expect(
      await api("POST", "/api/v1/coaching/actions/privacy", employeeId, {
        schemaVersion: 1,
        actionId,
        expectedVersion: 1,
        idempotencyKey: crypto.randomUUID(),
        privacy: "SHARED",
      }),
    ).toMatchObject({ status: 201, body: { id: actionId, version: 2 } });
    expect(await api("GET", `/api/v1/coaching/actions/${actionId}`, managerId)).toMatchObject({
      status: 200,
      body: { id: actionId, employeeId, privacy: "SHARED" },
    });
    expect(await support(actionId, managerId, 2)).toMatchObject({ status: 201 });
    expect(await support(actionId, outsiderId, 2)).toMatchObject({ status: 403 });

    expect(await transition(actionId, "ACCEPTED", 2)).toMatchObject({
      status: 201,
      body: { version: 3 },
    });
    expect(await transition(actionId, "ACTIVE", 3)).toMatchObject({
      status: 201,
      body: { version: 4 },
    });

    const plan = await api("POST", "/api/v1/coaching/formal-plans", employeeId, {
      schemaVersion: 1,
      expectedVersion: 1,
      idempotencyKey: crypto.randomUUID(),
      managerId,
      actionId,
      developmentArea: "Decision documentation",
      reason: "Employee-selected action with manager support",
      expectedBehavior: "Describe the next decision and its limitation.",
      activities: ["Practice once on a current work item"],
      followUpOwnerId: managerId,
      targetDate: null,
      completionEvidenceDefinition: "Employee-confirmed Evidence Record",
      sourceEvaluationAssignmentId: null,
    });
    expect(plan).toMatchObject({ status: 201, body: { id: expect.any(String), version: 1 } });
    const planId = (plan.body as { id: string }).id;

    expect(await planTransition("agree", planId, managerId, 1)).toMatchObject({ status: 409 });
    expect(await planTransition("approve", planId, employeeId, 1)).toMatchObject({
      status: 201,
      body: { version: 2 },
    });
    expect(await planTransition("agree", planId, managerId, 2)).toMatchObject({
      status: 201,
      body: { version: 3 },
    });
    expect(await planTransition("activate", planId, managerId, 3)).toMatchObject({
      status: 201,
      body: { version: 4 },
    });

    expect(
      await api("POST", "/api/v1/coaching/formal-plans/evidence", employeeId, {
        schemaVersion: 1,
        planId,
        expectedVersion: 4,
        idempotencyKey: crypto.randomUUID(),
        evidenceId,
        confirmed: true,
      }),
    ).toMatchObject({ status: 201 });
    expect(await planTransition("complete", planId, managerId, 4)).toMatchObject({
      status: 201,
      body: { state: "COMPLETED", version: 5 },
    });

    const retained = await database.formalDevelopmentPlan.findUniqueOrThrow({
      where: { id: planId },
      include: { agreements: true, evidenceLinks: true, transitions: true },
    });
    expect(retained.state).toBe("COMPLETED");
    expect(retained.agreements.map(({ kind }) => kind)).toEqual([
      "EMPLOYEE_APPROVED",
      "MANAGER_AGREED",
    ]);
    expect(retained.evidenceLinks).toEqual(
      expect.arrayContaining([expect.objectContaining({ evidenceId, confirmed: true })]),
    );
    expect(retained.transitions).toHaveLength(4);
  });
});

function actionInput() {
  return {
    schemaVersion: 1,
    expectedVersion: 1,
    idempotencyKey: crypto.randomUUID(),
    insightId: null,
    title: "Document one blocker response",
    objective: "Improve decision traceability",
    expectedBenefit: "A reusable development practice",
    activity: "Record the next blocker and resolution",
    completionEvidenceDefinition: "Employee-confirmed evidence",
    targetDate: null,
    privacy: "PRIVATE",
    projectId: null,
    researchId: null,
    workItemId: null,
  };
}

function support(actionId: string, actorId: string, expectedVersion: number) {
  return api("POST", "/api/v1/coaching/actions/support", actorId, {
    schemaVersion: 1,
    actionId,
    expectedVersion,
    idempotencyKey: crypto.randomUUID(),
    kind: "RESOURCE",
    body: "Optional training resource",
    resourceUrl: "https://example.invalid/resource",
  });
}

function transition(actionId: string, toState: "ACCEPTED" | "ACTIVE", expectedVersion: number) {
  return api("POST", "/api/v1/coaching/actions/transition", employeeId, {
    schemaVersion: 1,
    actionId,
    expectedVersion,
    idempotencyKey: crypto.randomUUID(),
    toState,
  });
}

function planTransition(
  transition: "approve" | "agree" | "activate" | "complete",
  planId: string,
  actorId: string,
  expectedVersion: number,
) {
  return api("POST", `/api/v1/coaching/formal-plans/${transition}`, actorId, {
    planId,
    expectedVersion,
    idempotencyKey: crypto.randomUUID(),
  });
}

async function createConfirmedEvidence(ownerId: string) {
  const suffix = crypto.randomUUID();
  const [organization, department] = await Promise.all([
    database.organization.findUniqueOrThrow({ where: { key: "leapai" } }),
    database.department.findUniqueOrThrow({ where: { key: "ai-department" } }),
  ]);
  const projectId = crypto.randomUUID();
  await database.authorizationScope.create({
    data: {
      id: projectId,
      key: `coaching-journey-project-${suffix}`,
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
      name: "Coaching journey evidence project",
      description: "Narrow integration evidence fixture",
      status: "active",
      createdById: ownerId,
    },
  });
  const evidence = await database.evidenceRecord.create({
    data: {
      idempotencyKey: crypto.randomUUID(),
      projectId,
      employeeId: ownerId,
      state: "confirmed",
      revisions: {
        create: {
          revision: 1,
          revisionKind: "manual_draft",
          sourceKind: "pasted_text",
          sourceText: "A concise source-supported work record.",
          supportedClaim: "A documented work record supports the selected practice.",
          contributionContext: "Employee-confirmed evidence for a formal development plan.",
          executionMode: "manual",
          createdById: ownerId,
        },
      },
    },
    include: { revisions: true },
  });
  await database.evidenceConfirmation.create({
    data: {
      evidenceId: evidence.id,
      evidenceRevisionId: evidence.revisions[0]!.id,
      employeeId: ownerId,
      reason: "Employee confirmed the evidence before linking it to the development plan.",
      confirmedAt: new Date(),
    },
  });
  return evidence.id;
}

async function api(method: string, route: string, actorId: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      authorization: `Bearer ${actorId}`,
      "content-type": "application/json",
      "x-correlation-id": crypto.randomUUID(),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return { status: response.status, body: text === "" ? undefined : JSON.parse(text) };
}
