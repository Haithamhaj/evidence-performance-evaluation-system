import { createDatabaseClient } from "@evaluation/database";
import {
  AssessmentService,
  EmployeeEvaluationCycleService,
  EvaluationDiscussionService,
  EvaluationReportReader,
  EvaluationTemplateService,
  EvaluationWordingService,
  FinalizationService,
} from "@evaluation/employee-evaluation";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AuthGuard } from "../../apps/api/src/auth/auth.guard.js";
import { AppErrorFilter } from "../../apps/api/src/platform/error.filter.js";
import { CorrelationMiddleware } from "../../apps/api/src/platform/correlation.middleware.js";
import { AssessmentsController } from "../../apps/api/src/employee-evaluation/assessments.controller.js";
import {
  EMPLOYEE_EVALUATION_POLICY_DATABASE,
  EmployeeEvaluationPolicyGuard,
} from "../../apps/api/src/employee-evaluation/employee-evaluation-policy.guard.js";
import { EmployeeEvaluationQueryService } from "../../apps/api/src/employee-evaluation/employee-evaluation-query.service.js";
import { FinalizationController } from "../../apps/api/src/employee-evaluation/finalization.controller.js";
import { EvaluationCyclesController } from "../../apps/api/src/employee-evaluation/cycles.controller.js";
import { EvaluationTemplatesController } from "../../apps/api/src/employee-evaluation/templates.controller.js";
import {
  ApiEligibilityReader,
  ApiOrganizationReader,
} from "../../apps/api/src/employee-evaluation/employee-evaluation.module.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const employeeId = crypto.randomUUID();
const otherEmployeeId = crypto.randomUUID();
const managerId = crypto.randomUUID();
const administratorId = crypto.randomUUID();
const assignmentId = crypto.randomUUID();
let app: import("@nestjs/common").INestApplication | undefined;
let baseUrl = "";
let templateVersionId = "";
let organizationId = "";
let departmentId = "";

const principals = new Map([
  [employeeId, principal(employeeId)],
  [otherEmployeeId, principal(otherEmployeeId)],
  [managerId, principal(managerId)],
  [administratorId, principal(administratorId)],
]);

const authGuard = {
  canActivate(context: import("@nestjs/common").ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      principal?: unknown;
    }>();
    const token = request.headers.authorization?.replace(/^Bearer /u, "");
    const authenticated = token === undefined ? undefined : principals.get(token);
    if (authenticated === undefined) return false;
    request.principal = authenticated;
    return true;
  },
};

class TestEmployeeEvaluationApiModule {}
Module({
  controllers: [
    AssessmentsController,
    EvaluationCyclesController,
    EvaluationTemplatesController,
    FinalizationController,
  ],
  providers: [
    { provide: AuthGuard, useValue: authGuard },
    { provide: EMPLOYEE_EVALUATION_POLICY_DATABASE, useValue: database },
    EmployeeEvaluationPolicyGuard,
    {
      provide: EmployeeEvaluationQueryService,
      useValue: new EmployeeEvaluationQueryService(database),
    },
    { provide: AssessmentService, useValue: {} },
    { provide: EvaluationWordingService, useValue: {} },
    { provide: EvaluationDiscussionService, useValue: {} },
    {
      provide: FinalizationService,
      useValue: new FinalizationService(database, {
        read: async () => {
          throw new Error("Report context is not used by checked cycle closure.");
        },
      }),
    },
    { provide: EvaluationReportReader, useValue: {} },
    {
      provide: EmployeeEvaluationCycleService,
      useValue: new EmployeeEvaluationCycleService(
        database,
        new ApiEligibilityReader(),
        new ApiOrganizationReader(),
      ),
    },
    {
      provide: EvaluationTemplateService,
      useValue: { activateVersion: async () => ({ status: "ACTIVE" }) },
    },
  ],
})(TestEmployeeEvaluationApiModule);

beforeAll(async () => {
  await seedAuthorizationFixture();
  app = await NestFactory.create(TestEmployeeEvaluationApiModule, {
    abortOnError: false,
    logger: false,
  });
  app.useGlobalFilters(new AppErrorFilter());
  const correlation = new CorrelationMiddleware();
  app.use(correlation.use.bind(correlation));
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address() as import("node:net").AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await app?.close();
  await database.$disconnect();
});

describe("Employee Evaluation protected production API", () => {
  it("denies another employee from reading an assignment", async () => {
    expect(
      await api("GET", `/api/v1/employee-evaluation/assignments/${assignmentId}`, otherEmployeeId),
    ).toMatchObject({
      status: 403,
    });
  });

  it("denies the employee from reading the manager draft", async () => {
    expect(
      await api(
        "GET",
        `/api/v1/employee-evaluation/assignments/${assignmentId}/manager-draft`,
        employeeId,
      ),
    ).toMatchObject({ status: 403 });
  });

  it("denies a system-administrator-only principal from finalizing", async () => {
    expect(
      await api(
        "POST",
        `/api/v1/employee-evaluation/assignments/${assignmentId}/finalization`,
        administratorId,
        {
          schemaVersion: 1,
          expectedVersion: 1,
          idempotencyKey: crypto.randomUUID(),
          entries: [],
          finalComment: null,
        },
      ),
    ).toMatchObject({ status: 403 });
  });

  it("allows the persisted system-administrator cycle authority to close after manager finalization", async () => {
    expect(
      await api(
        "POST",
        `/api/v1/employee-evaluation/assignments/${assignmentId}/closure`,
        administratorId,
        {
          schemaVersion: 1,
          expectedVersion: 1,
          idempotencyKey: crypto.randomUUID(),
          reason: "Close the fully manager-finalized cycle.",
        },
      ),
    ).toMatchObject({ status: 201, body: { state: "CLOSED", version: 2 } });
  });

  it("rejects malformed assignment identifiers without exposing an internal error", async () => {
    expect(
      await api("GET", "/api/v1/employee-evaluation/assignments/not-a-uuid", employeeId),
    ).toMatchObject({
      status: 400,
      body: { code: "EMPLOYEE_EVALUATION_INPUT_INVALID" },
    });
  });

  it("loads the system administrator role server-side before template activation", async () => {
    expect(
      await api(
        "POST",
        `/api/v1/employee-evaluation/templates/versions/${templateVersionId}/activation`,
        administratorId,
        {
          schemaVersion: 1,
          expectedVersion: 1,
          idempotencyKey: crypto.randomUUID(),
          reason: "Activate the approved evaluation template.",
        },
      ),
    ).toMatchObject({ status: 201, body: { status: "ACTIVE" } });
  });

  it("lets a non-manager system administrator open a cycle with the department's frozen manager", async () => {
    const result = await api("POST", "/api/v1/employee-evaluation/cycles", administratorId, {
      schemaVersion: 1,
      organizationId,
      departmentId,
      templateVersionId,
      cycleType: "STANDARD",
      startsAt: "2026-04-01T00:00:00.000Z",
      endsAt: "2026-07-01T00:00:00.000Z",
      expectedVersion: 1,
      idempotencyKey: crypto.randomUUID(),
      reason: "Open the next quarterly cycle using frozen department eligibility.",
    });

    expect(result).toMatchObject({
      status: 201,
      body: { assignments: [{ managerId }] },
    });
  });
});

async function seedAuthorizationFixture() {
  const suffix = crypto.randomUUID();
  const organization = await database.organization.create({
    data: { key: `evaluation-api-${suffix}`, name: "Evaluation API authorization" },
  });
  const department = await database.department.create({
    data: {
      key: `evaluation-api-department-${suffix}`,
      name: "Evaluation API authorization",
      organizationId: organization.id,
    },
  });
  organizationId = organization.id;
  departmentId = department.id;
  const [systemScope, departmentScope] = await Promise.all([
    database.authorizationScope.create({
      data: { key: `evaluation-api-system-${suffix}`, scopeType: "system" },
    }),
    database.authorizationScope.create({
      data: {
        key: `evaluation-api-department-scope-${suffix}`,
        scopeType: "department",
        departmentId: department.id,
      },
    }),
  ]);
  await database.user.createMany({
    data: [
      { id: employeeId, email: `${employeeId}@example.invalid`, displayName: "Employee" },
      {
        id: otherEmployeeId,
        email: `${otherEmployeeId}@example.invalid`,
        displayName: "Other employee",
      },
      { id: managerId, email: `${managerId}@example.invalid`, displayName: "Manager" },
      {
        id: administratorId,
        email: `${administratorId}@example.invalid`,
        displayName: "System administrator",
      },
    ],
  });
  await database.roleAssignment.createMany({
    data: [
      {
        userId: administratorId,
        role: "system_administrator",
        scopeType: "system",
        scopeId: systemScope.id,
      },
      {
        userId: managerId,
        role: "manager",
        scopeType: "department",
        scopeId: departmentScope.id,
      },
    ],
  });
  const rubric = await database.rubricVersion.create({
    data: {
      organizationId: organization.id,
      version: "api-auth-fixture",
    },
  });
  const template = await database.evaluationTemplate.create({
    data: {
      organizationId: organization.id,
      departmentId: department.id,
      scope: "DEPARTMENT",
      key: `api-auth-${suffix}`,
      name: "API authorization fixture",
      createdById: administratorId,
    },
  });
  const templateVersion = await database.evaluationTemplateVersion.create({
    data: {
      templateId: template.id,
      rubricVersionId: rubric.id,
      versionNumber: 1,
      ratingScale: [1, 2, 3, 4, 5],
      localeAvailability: ["en"],
      weightPolicy: { sectionTotal: 100 },
      evaluationPolicy: {
        cadence: "QUARTERLY",
        cycleOneType: "CALIBRATION_NON_BASELINE",
      },
      createdById: administratorId,
      status: "ACTIVE",
      activatedById: administratorId,
      activatedAt: new Date("2026-03-01T00:00:00.000Z"),
      version: 2,
    },
  });
  templateVersionId = templateVersion.id;
  const eligibilityCycle = await database.evaluationCycle.create({
    data: {
      departmentId: department.id,
      managerId,
      version: 2,
      visibilityMode: "identified",
      sourceReason: "Frozen API authorization fixture.",
      effectiveFrom: new Date("2026-04-01T00:00:00.000Z"),
      effectiveTo: new Date("2026-07-01T00:00:00.000Z"),
    },
  });
  await database.eligibilitySnapshot.create({
    data: {
      cycleId: eligibilityCycle.id,
      version: 2,
      visibilityMode: "identified",
      sourceReason: "Frozen API authorization fixture.",
      effectiveFrom: new Date("2026-04-01T00:00:00.000Z"),
      effectiveTo: new Date("2026-07-01T00:00:00.000Z"),
      entries: {
        create: {
          employeeId,
          state: "active",
          sourceReason: "Active employee in the frozen API fixture.",
          effectiveFrom: new Date("2026-04-01T00:00:00.000Z"),
          effectiveTo: new Date("2026-07-01T00:00:00.000Z"),
          position: 0,
        },
      },
    },
  });
  await database.evaluationCycle.update({
    where: { id: eligibilityCycle.id },
    data: { openedAt: new Date("2026-03-01T00:00:00.000Z") },
  });
  const cycle = await database.employeeEvaluationCycle.create({
    data: {
      departmentId: department.id,
      templateVersionId: templateVersion.id,
      sequence: 1,
      cycleType: "CALIBRATION_NON_BASELINE",
      state: "ACKNOWLEDGMENT",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-04-01T00:00:00.000Z"),
      createdById: administratorId,
      idempotencyKey: crypto.randomUUID(),
      openedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
  await database.evaluationAssignment.create({
    data: {
      id: assignmentId,
      cycleId: cycle.id,
      employeeId,
      managerId,
      eligibilityState: "ELIGIBLE",
      eligibilityReason: "Authorization fixture",
      eligibilityEffectiveAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
  await database.finalEvaluationSnapshot.create({
    data: {
      assignmentId,
      cycleId: cycle.id,
      employeeId,
      managerId,
      templateVersionId: templateVersion.id,
      cycleType: "CALIBRATION_NON_BASELINE",
      reportSnapshot: {},
      schemaVersion: 2,
      finalizedAt: new Date("2026-04-02T00:00:00.000Z"),
      idempotencyKey: crypto.randomUUID(),
    },
  });
}

async function api(method: "GET" | "POST", path: string, token: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-correlation-id": crypto.randomUUID(),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}

function principal(userId: string) {
  return {
    userId,
    active: true,
    email: `${userId}@example.invalid`,
    oidcSubject: userId,
    roles: [],
  };
}
