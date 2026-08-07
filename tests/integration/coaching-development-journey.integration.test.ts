import { createDatabaseClient } from "@evaluation/database";
import { databaseAuditWriter } from "@evaluation/audit";
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
import { seedManagerEvaluationAcceptance } from "../../scripts/seed-manager-evaluation-acceptance.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
let app: import("@nestjs/common").INestApplication | undefined;
let baseUrl = "";
let employeeId = "";
let managerId = "";
let outsiderId = "";
let insightId = "";
let evidenceId = "";
let outsiderInsightId = "";
let outsiderAssignmentId = "";
const insightSourceId = crypto.randomUUID();

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
      useFactory: () => new CoachingDevelopmentPersistence(database, databaseAuditWriter as never),
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
          revise: (event) => store.revisePlan(event),
          linkEvidence: (event) => store.linkPlanEvidence(event),
          auditRead: (event) => store.auditRead(event),
          findIdempotentPlan: (key) => store.findIdempotentPlan(key),
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
  employeeId = evaluation.employeeId;
  managerId = evaluation.managerId;
  insightId = (
    await new CoachingDevelopmentPersistence(database).createInsight({
      employeeId,
      state: "DRAFT",
      pattern: "The employee documented how one blocker was resolved.",
      periodStartsAt: "2026-07-01T00:00:00Z",
      periodEndsAt: "2026-08-01T00:00:00Z",
      confidence: "LIMITED",
      confidenceBasis: "One confirmed source supports a narrow observation.",
      limitations: ["One source cannot establish a sustained performance pattern."],
      cannotConclude: "This cannot determine a rating or broad performance conclusion.",
      sources: [
        {
          sourceId: insightSourceId,
          kind: "EVIDENCE",
          excerpt: "A concise source-supported work record.",
        },
      ],
    })
  ).id;
  outsiderId = (
    await database.user.upsert({
      where: { email: "coaching-journey-outsider@test.invalid" },
      create: { email: "coaching-journey-outsider@test.invalid", displayName: "Outside Manager" },
      update: { active: true },
    })
  ).id;
  outsiderInsightId = (
    await database.coachingInsight.create({ data: { employeeId: outsiderId, state: "DRAFT" } })
  ).id;
  const employeeAssignment = await database.evaluationAssignment.findFirstOrThrow({
    where: { employeeId, managerId },
  });
  outsiderAssignmentId = (
    await database.evaluationAssignment.upsert({
      where: {
        cycleId_employeeId: { cycleId: employeeAssignment.cycleId, employeeId: outsiderId },
      },
      create: {
        cycleId: employeeAssignment.cycleId,
        employeeId: outsiderId,
        managerId,
        eligibilityState: "ELIGIBLE",
        eligibilityReason: "Cross-employee authorization regression fixture.",
        eligibilityEffectiveAt: new Date("2026-08-01T00:00:00Z"),
      },
      update: {},
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
    const decisionKey = crypto.randomUUID();
    expect(
      await api("POST", "/api/v1/coaching/insights/decide", employeeId, {
        schemaVersion: 1,
        insightId,
        expectedVersion: 1,
        idempotencyKey: decisionKey,
        decision: "EDIT_AND_ACCEPT",
        privateReason: "Employee-owned reflection",
        personalNote: "Keep this note private",
      }),
    ).toMatchObject({ status: 201, body: { insightId, version: 2 } });
    expect(await api("GET", `/api/v1/coaching/insights/${insightId}`, employeeId)).toMatchObject({
      status: 200,
      body: {
        id: insightId,
        currentRevision: {
          pattern: "The employee documented how one blocker was resolved.",
        },
        sources: [expect.objectContaining({ sourceId: insightSourceId })],
        decisions: [
          expect.objectContaining({
            privateReason: "Employee-owned reflection",
            personalNote: "Keep this note private",
          }),
        ],
      },
    });
    expect(await api("GET", `/api/v1/coaching/insights/${insightId}`, managerId)).toMatchObject({
      status: 403,
    });

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

    const privacyKey = crypto.randomUUID();
    expect(
      await api("POST", "/api/v1/coaching/actions/privacy", employeeId, {
        schemaVersion: 1,
        actionId,
        expectedVersion: 1,
        idempotencyKey: privacyKey,
        privacy: "SHARED",
      }),
    ).toMatchObject({ status: 201, body: { id: actionId, version: 2 } });
    expect(await api("GET", `/api/v1/coaching/actions/${actionId}`, managerId)).toMatchObject({
      status: 200,
      body: { id: actionId, employeeId, privacy: "SHARED" },
    });
    expect(await api("GET", `/api/v1/coaching/actions/${actionId}`, managerId)).toMatchObject({
      status: 200,
      body: { title: "Document one blocker response", objective: "Improve decision traceability" },
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
    expect(
      await api("POST", "/api/v1/coaching/actions/revise", employeeId, {
        ...actionInput(),
        actionId,
        expectedVersion: 4,
        idempotencyKey: crypto.randomUUID(),
        title: "Private revised action title",
        objective: "Private revised objective",
      }),
    ).toMatchObject({ status: 201, body: { id: actionId, version: 5 } });

    const planCreateKey = crypto.randomUUID();
    const planCreateCommand = {
      schemaVersion: 1,
      expectedVersion: 1,
      idempotencyKey: planCreateKey,
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
    };
    const plan = await api("POST", "/api/v1/coaching/formal-plans", employeeId, planCreateCommand);
    expect(plan).toMatchObject({ status: 201, body: { id: expect.any(String), version: 1 } });
    const planId = (plan.body as { id: string }).id;

    expect(await planTransition("agree", planId, managerId, 1)).toMatchObject({ status: 409 });
    const firstApprovalKey = crypto.randomUUID();
    expect(await planTransition("approve", planId, employeeId, 1, firstApprovalKey)).toMatchObject({
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
      await api("POST", "/api/v1/coaching/formal-plans/revise", employeeId, {
        schemaVersion: 1,
        planId,
        expectedVersion: 4,
        idempotencyKey: crypto.randomUUID(),
        developmentArea: "Revised decision documentation",
        reason: "Employee changed the agreed activity",
        expectedBehavior: "Describe the next decision, source, and limitation.",
        activities: ["Practice twice on current work items"],
        followUpOwnerId: managerId,
        targetDate: null,
        completionEvidenceDefinition: "Employee-confirmed Evidence Record",
        sourceEvaluationAssignmentId: null,
      }),
    ).toMatchObject({ status: 201, body: { state: "DRAFT", version: 5 } });
    expect(await planTransition("agree", planId, managerId, 5)).toMatchObject({ status: 409 });
    expect(await planTransition("approve", planId, employeeId, 5)).toMatchObject({
      status: 201,
      body: { version: 6 },
    });
    expect(await planTransition("agree", planId, managerId, 6)).toMatchObject({
      status: 201,
      body: { version: 7 },
    });
    expect(await planTransition("activate", planId, managerId, 7)).toMatchObject({
      status: 201,
      body: { version: 8 },
    });
    expect(await api("GET", `/api/v1/coaching/formal-plans/${planId}`, managerId)).toMatchObject({
      status: 200,
      body: {
        id: planId,
        developmentArea: "Revised decision documentation",
        state: "ACTIVE",
      },
    });
    expect(await planTransition("complete", planId, managerId, 8)).toMatchObject({ status: 409 });

    expect(
      await api("POST", "/api/v1/coaching/formal-plans/evidence", employeeId, {
        schemaVersion: 1,
        planId,
        expectedVersion: 8,
        idempotencyKey: crypto.randomUUID(),
        evidenceId,
        confirmed: true,
      }),
    ).toMatchObject({ status: 201 });
    expect(await planTransition("complete", planId, managerId, 8)).toMatchObject({
      status: 201,
      body: { state: "COMPLETED", version: 9 },
    });
    expect(
      await api("POST", "/api/v1/coaching/formal-plans/close", managerId, {
        schemaVersion: 1,
        planId,
        expectedVersion: 9,
        idempotencyKey: crypto.randomUUID(),
        reason: "The participants completed and closed the plan.",
      }),
    ).toMatchObject({
      status: 201,
      body: { state: "CLOSED", version: 10 },
    });
    expect(
      await api("POST", "/api/v1/coaching/formal-plans", employeeId, planCreateCommand),
    ).toMatchObject({ status: 201, body: { id: planId, version: 1 } });

    const withdrawn = await api("POST", "/api/v1/coaching/formal-plans", employeeId, {
      ...planCreateCommand,
      idempotencyKey: crypto.randomUUID(),
      reason: "Private withdrawal-plan creation reason",
    });
    const withdrawnPlanId = (withdrawn.body as { id: string }).id;
    expect(
      await api("POST", "/api/v1/coaching/formal-plans/withdraw", employeeId, {
        schemaVersion: 1,
        planId: withdrawnPlanId,
        expectedVersion: 1,
        idempotencyKey: crypto.randomUUID(),
        reason: "Private withdrawal reason must not enter audit metadata.",
      }),
    ).toMatchObject({ status: 201, body: { state: "WITHDRAWN", version: 2 } });

    const retained = await database.formalDevelopmentPlan.findUniqueOrThrow({
      where: { id: planId },
      include: { agreements: true, evidenceLinks: true, transitions: true },
    });
    expect(retained.state).toBe("CLOSED");
    expect(retained.agreements.map(({ kind }) => kind)).toEqual([
      "EMPLOYEE_APPROVED",
      "MANAGER_AGREED",
      "EMPLOYEE_APPROVED",
      "MANAGER_AGREED",
    ]);
    expect(retained.evidenceLinks).toEqual(
      expect.arrayContaining([expect.objectContaining({ evidenceId, confirmed: true })]),
    );
    expect(retained.transitions).toHaveLength(9);
    expect(
      await api("POST", "/api/v1/coaching/insights/decide", employeeId, {
        schemaVersion: 1,
        insightId,
        expectedVersion: 1,
        idempotencyKey: decisionKey,
        decision: "EDIT_AND_ACCEPT",
        privateReason: "Employee-owned reflection",
        personalNote: "Keep this note private",
      }),
    ).toMatchObject({ status: 201, body: { version: 2 } });
    expect(
      await api("POST", "/api/v1/coaching/actions/privacy", employeeId, {
        schemaVersion: 1,
        actionId,
        expectedVersion: 1,
        idempotencyKey: privacyKey,
        privacy: "SHARED",
      }),
    ).toMatchObject({ status: 201, body: { version: 2 } });
    expect(await planTransition("approve", planId, employeeId, 1, firstApprovalKey)).toMatchObject({
      status: 201,
      body: { version: 2 },
    });
    const audits = await database.auditEvent.findMany({
      where: { targetId: { in: [insightId, actionId, planId, withdrawnPlanId] } },
      orderBy: { createdAt: "asc" },
    });
    expect(audits.map(({ eventType }) => eventType)).toEqual(
      expect.arrayContaining([
        "coaching.insight.decided",
        "coaching.insight.employee_read",
        "coaching.action.privacy_changed",
        "coaching.action.created",
        "coaching.action.revised",
        "coaching.action.state_changed",
        "coaching.action.shared_read",
        "coaching.action.support_added",
        "coaching.plan.created",
        "coaching.plan.evidence_linked",
        "coaching.plan.revised",
        "coaching.plan.activated",
        "coaching.plan.withdrawn",
        "coaching.plan.closed",
        "coaching.plan.agreement_recorded",
        "coaching.plan.participant_read",
        "coaching.plan.completed",
      ]),
    );
    expect(JSON.stringify(audits)).not.toContain("Employee-owned reflection");
    expect(JSON.stringify(audits)).not.toContain("Keep this note private");
    for (const privateContent of [
      "Document one blocker response",
      "Private revised action title",
      "Private revised objective",
      "Employee-selected action with manager support",
      "Employee changed the agreed activity",
      "Optional training resource",
      "Private withdrawal-plan creation reason",
      "Private withdrawal reason must not enter audit metadata.",
      "The participants completed and closed the plan.",
    ])
      expect(JSON.stringify(audits)).not.toContain(privateContent);
    const safeMutationEvents = audits.filter(({ eventType }) =>
      [
        "coaching.action.created",
        "coaching.action.revised",
        "coaching.action.state_changed",
        "coaching.plan.created",
        "coaching.plan.evidence_linked",
        "coaching.plan.revised",
        "coaching.plan.activated",
        "coaching.plan.withdrawn",
        "coaching.plan.closed",
      ].includes(eventType),
    );
    expect(safeMutationEvents.map(({ eventType }) => eventType).sort()).toEqual(
      [
        "coaching.action.created",
        "coaching.action.revised",
        "coaching.action.state_changed",
        "coaching.action.state_changed",
        "coaching.plan.activated",
        "coaching.plan.activated",
        "coaching.plan.closed",
        "coaching.plan.created",
        "coaching.plan.created",
        "coaching.plan.evidence_linked",
        "coaching.plan.revised",
        "coaching.plan.withdrawn",
      ].sort(),
    );
    const allowedAuditKeys = new Set([
      "actionId",
      "evidenceId",
      "fromState",
      "resultingVersion",
      "revisionId",
      "sourceEvaluationAssignmentId",
      "state",
      "toState",
    ]);
    for (const event of safeMutationEvents) {
      const keys = Object.keys(event.safeDiff as object);
      expect(keys.length).toBeGreaterThan(0);
      expect(keys.every((key) => allowedAuditKeys.has(key))).toBe(true);
    }
    expect(
      safeMutationEvents.find(({ eventType }) => eventType === "coaching.action.revised"),
    ).toMatchObject({
      targetId: actionId,
      safeDiff: {
        state: "ACTIVE",
        resultingVersion: 5,
        revisionId: expect.any(String),
      },
    });
    expect(
      safeMutationEvents.find(
        ({ eventType, targetId }) =>
          eventType === "coaching.action.created" && targetId === actionId,
      ),
    ).toMatchObject({
      safeDiff: { state: "DRAFT", resultingVersion: 1, revisionId: expect.any(String) },
    });
    expect(
      safeMutationEvents.find(
        ({ eventType, targetId }) =>
          eventType === "coaching.plan.evidence_linked" && targetId === planId,
      ),
    ).toMatchObject({ safeDiff: { evidenceId, state: "ACTIVE" } });
    expect(
      safeMutationEvents.find(
        ({ eventType, targetId }) => eventType === "coaching.plan.closed" && targetId === planId,
      ),
    ).toMatchObject({
      safeDiff: { fromState: "COMPLETED", toState: "CLOSED", resultingVersion: 10 },
    });
    expect(
      safeMutationEvents.find(
        ({ eventType, targetId }) =>
          eventType === "coaching.plan.withdrawn" && targetId === withdrawnPlanId,
      ),
    ).toMatchObject({
      safeDiff: { fromState: "DRAFT", toState: "WITHDRAWN", resultingVersion: 2 },
    });
    expect(
      audits.filter(
        ({ eventType, targetId }) => eventType === "coaching.plan.created" && targetId === planId,
      ),
    ).toHaveLength(1);
  });

  it("does not authorize a historical assignment outside its cycle window", async () => {
    const persistenceAtFutureDate = new CoachingDevelopmentPersistence(
      database,
      undefined,
      () => new Date("2030-01-01T00:00:00Z"),
    );
    await expect(persistenceAtFutureDate.isAuthorizedManager(employeeId, managerId)).resolves.toBe(
      false,
    );
  });

  it("rejects an action linked to another employee's coaching insight", async () => {
    expect(
      await api("POST", "/api/v1/coaching/actions", employeeId, {
        ...actionInput(),
        insightId: outsiderInsightId,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).toMatchObject({ status: 403 });
  });

  it("rejects cross-employee formal-plan action, evaluation, and follow-up references", async () => {
    const outsiderAction = await api("POST", "/api/v1/coaching/actions", outsiderId, actionInput());
    const outsiderActionId = (outsiderAction.body as { id: string }).id;
    const base = {
      schemaVersion: 1,
      expectedVersion: 1,
      managerId,
      actionId: null,
      developmentArea: "Reference authorization test",
      reason: "Authorization test",
      expectedBehavior: "Reject foreign references.",
      activities: ["No activity should be persisted"],
      followUpOwnerId: managerId,
      targetDate: null,
      completionEvidenceDefinition: "No evidence",
      sourceEvaluationAssignmentId: null,
    };

    for (const overrides of [
      { actionId: outsiderActionId },
      { sourceEvaluationAssignmentId: outsiderAssignmentId },
      { followUpOwnerId: outsiderId },
    ])
      expect(
        await api("POST", "/api/v1/coaching/formal-plans", employeeId, {
          ...base,
          ...overrides,
          idempotencyKey: crypto.randomUUID(),
        }),
      ).toMatchObject({ status: 403 });
  });

  it("allows only one concurrent action version transition", async () => {
    const created = await api("POST", "/api/v1/coaching/actions", employeeId, actionInput());
    const actionId = (created.body as { id: string }).id;
    const responses = await Promise.all([
      api("POST", "/api/v1/coaching/actions/privacy", employeeId, {
        schemaVersion: 1,
        actionId,
        expectedVersion: 1,
        idempotencyKey: crypto.randomUUID(),
        privacy: "SHARED",
      }),
      api("POST", "/api/v1/coaching/actions/privacy", employeeId, {
        schemaVersion: 1,
        actionId,
        expectedVersion: 1,
        idempotencyKey: crypto.randomUUID(),
        privacy: "SHARED",
      }),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    await expect(
      database.developmentActionTransition.count({
        where: { actionId, resultingVersion: 2 },
      }),
    ).resolves.toBe(1);
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
  idempotencyKey = crypto.randomUUID(),
) {
  return api("POST", `/api/v1/coaching/formal-plans/${transition}`, actorId, {
    schemaVersion: 1,
    planId,
    expectedVersion,
    idempotencyKey,
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
