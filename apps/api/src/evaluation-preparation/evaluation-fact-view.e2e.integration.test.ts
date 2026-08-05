import { EvaluationFactViewService } from "@evaluation/evaluation-preparation";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AuthGuard } from "../auth/auth.guard.js";
import { AppErrorFilter } from "../platform/error.filter.js";
import { EvaluationFactViewController } from "./evaluation-fact-view.controller.js";
import {
  EVALUATION_PREPARATION_DATABASE,
  EvaluationFactViewPolicyGuard,
} from "./evaluation-fact-view-policy.guard.js";

const cycleId = crypto.randomUUID();
const employeeId = crypto.randomUUID();
const managerId = crypto.randomUUID();
const otherManagerId = crypto.randomUUID();
const administratorId = crypto.randomUUID();
const inactiveId = crypto.randomUUID();
const rubricVersionId = crypto.randomUUID();
const departmentId = crypto.randomUUID();
const organizationId = crypto.randomUUID();

const principals = new Map<
  string,
  Readonly<{ userId: string; active: boolean; roles: readonly string[] }>
>([
  [employeeId, { userId: employeeId, active: true, roles: ["employee"] }],
  [managerId, { userId: managerId, active: true, roles: ["manager"] }],
  [otherManagerId, { userId: otherManagerId, active: true, roles: ["manager"] }],
  [administratorId, { userId: administratorId, active: true, roles: ["system_administrator"] }],
  [inactiveId, { userId: inactiveId, active: false, roles: ["employee"] }],
]);

const database = {
  evaluationCycle: {
    findFirst: vi.fn(async (query: { where: { id: string } }) =>
      query.where.id === cycleId
        ? {
            id: cycleId,
            managerId,
            departmentId,
            effectiveFrom: new Date("2026-07-01T00:00:00.000Z"),
            effectiveTo: new Date("2026-09-30T23:59:59.999Z"),
            department: { organizationId },
            eligibilityEntries: [{ employeeId, state: "active" }],
          }
        : null,
    ),
  },
  rubricVersion: {
    findFirst: vi.fn(async () => ({ id: rubricVersionId })),
  },
};

const read = vi.fn(async (input: { requester: { access: string }; subjectEmployeeId: string }) => ({
  schemaVersion: 1,
  cycle: {
    id: cycleId,
    startsAt: "2026-07-01T00:00:00.000Z",
    endsAt: "2026-09-30T23:59:59.999Z",
    rubricVersionId,
  },
  subjectEmployeeId: input.subjectEmployeeId,
  generatedAt: "2026-10-01T08:00:00.000Z",
  responsibilityWindows: [],
  projectFacts: [],
  confirmedEvidence: [],
  checkInFacts: [],
  dynamicCriteriaVersions: [],
  employeeInterpretations: [],
  sourceCoverageNotes: [],
  accessUsed: input.requester.access,
}));

class TestEvaluationPreparationModule {}

Module({
  controllers: [EvaluationFactViewController],
  providers: [
    {
      provide: AuthGuard,
      useValue: {
        canActivate: async (context: import("@nestjs/common").ExecutionContext) => {
          const request = context.switchToHttp().getRequest<{
            headers: { authorization?: string };
            principal?: import("@evaluation/auth").AuthenticatedPrincipal;
          }>();
          const token = request.headers.authorization?.replace("Bearer ", "") ?? "";
          const principal = principals.get(token);
          if (principal === undefined) return false;
          request.principal = {
            ...principal,
            email: `${principal.userId}@example.invalid`,
            oidcSubject: principal.userId,
          };
          return true;
        },
      },
    },
    { provide: EVALUATION_PREPARATION_DATABASE, useValue: database },
    EvaluationFactViewPolicyGuard,
    { provide: EvaluationFactViewService, useValue: { read } },
  ],
})(TestEvaluationPreparationModule);

let app: import("@nestjs/common").INestApplication | undefined;
let baseUrl = "";

beforeAll(async () => {
  app = await NestFactory.create(TestEvaluationPreparationModule, {
    abortOnError: false,
    logger: ["error"],
  });
  app.useGlobalFilters(new AppErrorFilter());
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address() as import("node:net").AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => app?.close());

async function request(token: string, requestedEmployeeId = employeeId) {
  const response = await fetch(
    `${baseUrl}/api/v1/evaluation-cycles/${cycleId}/employees/${requestedEmployeeId}/facts`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  return { response, body: (await response.json()) as Record<string, unknown> };
}

describe("Evaluation Fact View API", () => {
  it("allows employee self-access and the assigned cycle manager", async () => {
    const self = await request(employeeId);
    const manager = await request(managerId);

    expect(self.response.status).toBe(200);
    expect(self.body).toMatchObject({ subjectEmployeeId: employeeId, accessUsed: "self" });
    expect(manager.response.status).toBe(200);
    expect(manager.body).toMatchObject({
      subjectEmployeeId: employeeId,
      accessUsed: "assigned_manager",
    });
  });

  it.each([otherManagerId, administratorId, inactiveId])(
    "denies unrelated, administrator-only, and inactive principals",
    async (token) => {
      const result = await request(token);
      expect(result.response.status).toBe(403);
      expect(result.body).toMatchObject({ code: "EVALUATION_FACT_VIEW_FORBIDDEN" });
    },
  );

  it("does not let an employee request another employee's facts", async () => {
    const result = await request(employeeId, crypto.randomUUID());
    expect(result.response.status).toBe(403);
    expect(result.body).toMatchObject({ code: "EVALUATION_FACT_VIEW_FORBIDDEN" });
  });

  it("contains no manager-visible individual readiness value", async () => {
    const result = await request(managerId);
    expect(result.response.status).toBe(200);
    expect(JSON.stringify(result.body)).not.toContain(["readiness", "Percent"].join(""));
    expect(JSON.stringify(result.body)).not.toContain("upwardFeedback");
  });
});
