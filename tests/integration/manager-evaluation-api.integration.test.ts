import { createDatabaseClient } from "@evaluation/database";
import {
  IdentifiedCompletionReader,
  IdentifiedProjectionPolicy,
  ManagerEvaluationCycleService,
  ManagerEvaluationSubmissionService,
} from "@evaluation/manager-evaluation";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AuthGuard } from "../../apps/api/src/auth/auth.guard.js";
import { ManagerEvaluationCyclesController } from "../../apps/api/src/manager-evaluation/cycles.controller.js";
import { ManagerEvaluationManagerViewController } from "../../apps/api/src/manager-evaluation/manager-view.controller.js";
import { ApiManagerEvaluationSummaryService } from "../../apps/api/src/manager-evaluation/manager-evaluation.module.js";
import {
  MANAGER_EVALUATION_POLICY_DATABASE,
  ManagerEvaluationPolicyGuard,
} from "../../apps/api/src/manager-evaluation/manager-evaluation-policy.guard.js";
import { ManagerEvaluationSubmissionsController } from "../../apps/api/src/manager-evaluation/submissions.controller.js";
import { AppErrorFilter } from "../../apps/api/src/platform/error.filter.js";
import { CorrelationMiddleware } from "../../apps/api/src/platform/correlation.middleware.js";
import { seedManagerEvaluationAcceptance } from "../../scripts/seed-manager-evaluation-acceptance.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
let app: import("@nestjs/common").INestApplication | undefined;
let baseUrl = "";
let fixture: Awaited<ReturnType<typeof seedManagerEvaluationAcceptance>>;
let otherManagerId = "";

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
      displayName: "Test User",
      active: true,
    };
    return true;
  },
};

class TestModule {}
Module({
  controllers: [
    ManagerEvaluationCyclesController,
    ManagerEvaluationSubmissionsController,
    ManagerEvaluationManagerViewController,
  ],
  providers: [
    { provide: AuthGuard, useValue: authGuard },
    { provide: MANAGER_EVALUATION_POLICY_DATABASE, useValue: database },
    ManagerEvaluationPolicyGuard,
    { provide: ManagerEvaluationCycleService, useValue: {} },
    {
      provide: ManagerEvaluationSubmissionService,
      useFactory: () => new ManagerEvaluationSubmissionService(database),
    },
    {
      provide: IdentifiedCompletionReader,
      useFactory: () =>
        new IdentifiedCompletionReader(database, () => new Date("2026-08-06T12:00:00Z")),
    },
    {
      provide: IdentifiedProjectionPolicy,
      useFactory: () => new IdentifiedProjectionPolicy(database),
    },
    {
      provide: ApiManagerEvaluationSummaryService,
      useValue: { generate: async () => ({ optional: true }) },
    },
  ],
})(TestModule);

beforeAll(async () => {
  fixture = await seedManagerEvaluationAcceptance(database, {
    managerSubject: "manager-evaluation-api-manager",
    adminSubject: "manager-evaluation-api-admin",
    oidcIssuer: "https://issuer.manager-evaluation.test",
  });
  otherManagerId = (
    await database.user.upsert({
      where: { email: "other-manager-e5a@test.invalid" },
      create: { email: "other-manager-e5a@test.invalid", displayName: "Other Manager" },
      update: { active: true },
    })
  ).id;
  app = await NestFactory.create(TestModule, { abortOnError: false, logger: false });
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

describe("identified manager evaluation protected API", () => {
  it("shows the frozen manager the named original and leave-aware completion immediately", async () => {
    const result = await api(
      "GET",
      `/api/v1/manager-evaluation/cycles/${fixture.cycleId}/manager-view`,
      fixture.managerId,
    );
    expect(result).toMatchObject({
      status: 200,
      body: {
        visibilityMode: "IDENTIFIED",
        completion: { submitted: 1, pending: 1, approvedLeave: 1 },
        responses: [
          {
            responseId: fixture.responseId,
            submitterId: fixture.employeeId,
            submitterDisplayName: "Amina Al-Harbi",
            responses: expect.any(Array),
          },
        ],
      },
    });
  });

  it.each([
    ["peer employee", () => fixture.pendingEmployeeId],
    ["system administrator", () => fixture.administratorId],
    ["other manager", () => otherManagerId],
  ])("denies %s from identified originals", async (_label, actor) => {
    expect(
      await api("GET", `/api/v1/manager-evaluation/responses/${fixture.responseId}`, actor()),
    ).toMatchObject({ status: 403 });
  });

  it("does not let the frozen manager submit on an employee's behalf", async () => {
    expect(
      await api("POST", "/api/v1/manager-evaluation/submissions", fixture.managerId, {
        schemaVersion: 1,
        cycleId: fixture.cycleId,
        expectedVersion: 1,
        idempotencyKey: crypto.randomUUID(),
        identifiedNoticeConfirmed: true,
        confirmedAt: "2026-08-06T12:00:00Z",
        responses: [],
      }),
    ).toMatchObject({ status: 403 });
  });
});

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
  return { status: response.status, body: await response.json() };
}
