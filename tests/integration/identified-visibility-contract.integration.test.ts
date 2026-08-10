import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { appendAuditEvent } from "../../packages/audit/src/index.js";
import {
  createDatabaseClient,
  seedPilot,
  withTransaction,
} from "../../packages/database/src/index.js";

import { createEligibilityService } from "../../apps/api/src/evaluation-eligibility/eligibility.service.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
type Transaction = Parameters<Parameters<typeof client.$transaction>[0]>[0];
const service = createEligibilityService(client, {
  append: appendAuditEvent,
} satisfies import("../../packages/contracts/src/index.js").AuditWriter<Transaction>);

let managerId: string;
let departmentId: string;
let employeeA: string;
let employeeB: string;

beforeAll(async () => {
  await withTransaction(client, (transaction) =>
    seedPilot(transaction, { managerSubject: "pilot-manager", adminSubject: "system-admin" }),
  );
  const [manager, department, scope] = await Promise.all([
    client.user.findUniqueOrThrow({ where: { pilotKey: "pilot-manager" } }),
    client.department.findUniqueOrThrow({ where: { key: "ai-department" } }),
    client.authorizationScope.findUniqueOrThrow({ where: { key: "department:ai-department" } }),
  ]);
  managerId = manager.id;
  departmentId = department.id;
  const suffix = crypto.randomUUID();
  const users = await Promise.all(
    ["a", "b"].map((label) =>
      client.user.create({
        data: {
          email: `visibility-${label}-${suffix}@example.invalid`,
          displayName: `Visibility ${label}`,
          roleAssignments: {
            create: { role: "employee", scopeType: "department", scopeId: scope.id },
          },
        },
      }),
    ),
  );
  employeeA = users[0]!.id;
  employeeB = users[1]!.id;
  const auditEventId = crypto.randomUUID();
  await client.leaveRecord.create({
    data: {
      employeeId: employeeB,
      departmentId,
      state: "APPROVED",
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      endsAt: new Date("2026-09-30T23:59:59.999Z"),
      reasonCategory: "PLANNED_LEAVE",
      affectedScopes: [{ kind: "PROJECT", id: crypto.randomUUID() }],
      eligibilityEffect: {
        create: {
          employeeId: employeeB,
          startsAt: new Date("2026-07-01T00:00:00.000Z"),
          endsAt: new Date("2026-09-30T23:59:59.999Z"),
          checkInRequired: false,
          negativeRegularitySignal: false,
          evaluationObligationSuspended: true,
          auditEventId,
          publishedAt: new Date("2026-07-01T00:00:00.000Z"),
        },
      },
    },
  });
});

afterAll(async () => client.$disconnect());

describe("identified pilot completion visibility", () => {
  it("does not block an identified submission marker on incomplete or leave entries", async () => {
    const cycle = await service.openCycle({
      actorId: managerId,
      managerId,
      departmentId,
      version: Math.floor(Date.now() / 1000) + 100,
      visibilityMode: "identified",
      sourceReason: "Identified pilot cycle",
      effectiveFrom: "2026-07-01T00:00:00.000Z",
      effectiveTo: "2026-09-30T23:59:59.999Z",
      correlationId: crypto.randomUUID(),
      eligibleEmployees: [
        {
          employeeId: employeeA,
          state: "active",
          sourceReason: "Active employee",
          effectiveFrom: "2026-07-01T00:00:00.000Z",
          effectiveTo: "2026-09-30T23:59:59.999Z",
        },
        {
          employeeId: employeeB,
          state: "approved_leave",
          sourceReason: "Approved leave",
          effectiveFrom: "2026-07-01T00:00:00.000Z",
          effectiveTo: "2026-09-30T23:59:59.999Z",
        },
      ],
    });
    await service.recordSubmissionMarker(
      cycle.cycleId,
      employeeA,
      new Date("2026-07-15T10:00:00.000Z"),
    );

    const completion = await service.getCompletionStatus(cycle.cycleId, managerId);
    expect(completion).toContainEqual({
      employeeId: employeeA,
      state: "active",
      submittedAt: "2026-07-15T10:00:00.000Z",
    });
    expect(completion).toContainEqual({
      employeeId: employeeB,
      state: "approved_leave",
      submittedAt: null,
    });
  });

  it("denies completion status to a different employee", async () => {
    const cycle = await service.openCycle({
      actorId: managerId,
      managerId,
      departmentId,
      version: Math.floor(Date.now() / 1000) + 101,
      visibilityMode: "identified",
      sourceReason: "Identified pilot cycle",
      effectiveFrom: "2026-07-01T00:00:00.000Z",
      effectiveTo: "2026-09-30T23:59:59.999Z",
      correlationId: crypto.randomUUID(),
      eligibleEmployees: [
        {
          employeeId: employeeA,
          state: "active",
          sourceReason: "Active employee",
          effectiveFrom: "2026-07-01T00:00:00.000Z",
          effectiveTo: "2026-09-30T23:59:59.999Z",
        },
      ],
    });

    await expect(service.getCompletionStatus(cycle.cycleId, employeeB)).rejects.toMatchObject({
      code: "AUTHZ_ROLE_REQUIRED",
      status: 403,
    });
  });
});
