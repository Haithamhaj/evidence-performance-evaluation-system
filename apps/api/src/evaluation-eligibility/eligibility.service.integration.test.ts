import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { appendAuditEvent } from "@evaluation/audit";
import { createDatabaseClient, seedPilot, withTransaction } from "@evaluation/database";

import { createEligibilityService } from "./eligibility.service.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
type Transaction = Parameters<Parameters<typeof client.$transaction>[0]>[0];

let managerId: string;
let administratorId: string;
let departmentId: string;
let departmentScopeId: string;
let employeeId: string;
let secondEmployeeId: string;
let version = Math.floor(Date.now() / 1000);

const auditWriter: import("@evaluation/contracts").AuditWriter<Transaction> = {
  append: appendAuditEvent,
};

beforeAll(async () => {
  await withTransaction(client, (transaction) =>
    seedPilot(transaction, { managerSubject: "pilot-manager", adminSubject: "system-admin" }),
  );
  const [manager, administrator, department, scope] = await Promise.all([
    client.user.findUniqueOrThrow({ where: { pilotKey: "pilot-manager" } }),
    client.user.findUniqueOrThrow({ where: { pilotKey: "system-admin" } }),
    client.department.findUniqueOrThrow({ where: { key: "ai-department" } }),
    client.authorizationScope.findUniqueOrThrow({ where: { key: "department:ai-department" } }),
  ]);
  managerId = manager.id;
  administratorId = administrator.id;
  departmentId = department.id;
  departmentScopeId = scope.id;
  const suffix = crypto.randomUUID();
  const employees = await Promise.all(
    ["one", "two"].map((label) =>
      client.user.create({
        data: {
          email: `eligibility-${label}-${suffix}@example.invalid`,
          displayName: `Eligibility ${label}`,
          roleAssignments: {
            create: {
              role: "employee",
              scopeType: "department",
              scopeId: departmentScopeId,
            },
          },
        },
      }),
    ),
  );
  employeeId = employees[0]!.id;
  secondEmployeeId = employees[1]!.id;
});

afterAll(async () => client.$disconnect());

function openInput(): import("@evaluation/contracts").OpenCycleInput {
  version += 1;
  return {
    actorId: managerId,
    managerId,
    departmentId,
    version,
    visibilityMode: "identified" as const,
    sourceReason: "Quarterly pilot eligibility",
    effectiveFrom: "2026-07-01T00:00:00.000Z",
    effectiveTo: "2026-09-30T23:59:59.999Z",
    correlationId: crypto.randomUUID(),
    eligibleEmployees: [
      {
        employeeId,
        state: "pending" as const,
        sourceReason: "Active department employee",
        effectiveFrom: "2026-07-01T00:00:00.000Z",
        effectiveTo: "2026-09-30T23:59:59.999Z",
      },
      {
        employeeId: secondEmployeeId,
        state: "approved_leave" as const,
        sourceReason: "Approved leave at cycle open",
        effectiveFrom: "2026-07-01T00:00:00.000Z",
        effectiveTo: "2026-09-30T23:59:59.999Z",
      },
    ],
  };
}

describe("evaluation eligibility persistence", () => {
  it("freezes the copied employees and visibility mode when the cycle opens", async () => {
    const service = createEligibilityService(client, auditWriter);
    const snapshot = await service.openCycle(openInput());

    expect(snapshot.visibilityMode).toBe("identified");
    expect(snapshot.entries.map(({ employeeId: id, state }) => [id, state])).toEqual([
      [employeeId, "pending"],
      [secondEmployeeId, "approved_leave"],
    ]);
    await expect(
      client.evaluationCycle.update({
        where: { id: snapshot.cycleId },
        data: { visibilityMode: "manager_blinded" },
      }),
    ).rejects.toBeDefined();
    await expect(
      client.eligibilitySnapshot.update({
        where: { id: snapshot.id },
        data: { sourceReason: "Changed later" },
      }),
    ).rejects.toBeDefined();
    await expect(
      client.eligibilityEntry.create({
        data: {
          cycleId: snapshot.cycleId,
          snapshotId: snapshot.id,
          employeeId: administratorId,
          position: 3,
          state: "pending",
          sourceReason: "Late direct insertion",
          effectiveFrom: new Date("2026-07-01T00:00:00.000Z"),
          effectiveTo: new Date("2026-09-30T23:59:59.999Z"),
        },
      }),
    ).rejects.toBeDefined();
  });

  it("denies a separate System Administrator from opening the manager cycle", async () => {
    const service = createEligibilityService(client, auditWriter);

    await expect(
      service.openCycle({ ...openInput(), actorId: administratorId }),
    ).rejects.toMatchObject({ code: "AUTHZ_ROLE_REQUIRED", status: 403 });
  });

  it.each(["pending", "approved_leave"] as const)(
    "atomically permits %s to excluded with the exact audit event",
    async (initialState) => {
      const service = createEligibilityService(client, auditWriter);
      const input = openInput();
      input.eligibleEmployees[0]!.state = initialState;
      const snapshot = await service.openCycle(input);
      const correlationId = crypto.randomUUID();

      await service.excludeEligibility({
        actorId: managerId,
        cycleId: snapshot.cycleId,
        employeeId,
        reason: "Manager-approved cycle exclusion",
        effectiveAt: "2026-08-01T10:00:00.000Z",
        correlationId,
      });

      await expect(
        client.eligibilityEntry.findUniqueOrThrow({
          where: { cycleId_employeeId: { cycleId: snapshot.cycleId, employeeId } },
        }),
      ).resolves.toMatchObject({ state: "excluded", version: 2 });
      await expect(
        client.auditEvent.findFirstOrThrow({ where: { correlationId } }),
      ).resolves.toMatchObject({
        eventType: "evaluation.eligibility.excluded",
        actorId: managerId,
        reason: "Manager-approved cycle exclusion",
        scopeType: "cycle",
      });
    },
  );

  it("rolls back eligibility when its audit append fails", async () => {
    const input = openInput();
    const service = createEligibilityService(client, auditWriter);
    const snapshot = await service.openCycle(input);
    const failing = createEligibilityService(client, {
      append: vi.fn().mockRejectedValue(new Error("audit unavailable")),
    });

    await expect(
      failing.excludeEligibility({
        actorId: managerId,
        cycleId: snapshot.cycleId,
        employeeId,
        reason: "Manager-approved cycle exclusion",
        effectiveAt: "2026-08-01T10:00:00.000Z",
        correlationId: crypto.randomUUID(),
      }),
    ).rejects.toThrow("audit unavailable");
    await expect(
      client.eligibilityEntry.findUniqueOrThrow({
        where: { cycleId_employeeId: { cycleId: snapshot.cycleId, employeeId } },
      }),
    ).resolves.toMatchObject({ state: "pending", version: 1 });
  });

  it("does not append an audit event when the eligibility write is rejected", async () => {
    const input = openInput();
    input.eligibleEmployees[0]!.state = "active";
    const snapshot = await createEligibilityService(client, auditWriter).openCycle(input);
    const append = vi.fn();

    await expect(
      createEligibilityService(client, { append }).excludeEligibility({
        actorId: managerId,
        cycleId: snapshot.cycleId,
        employeeId,
        reason: "Manager-approved cycle exclusion",
        effectiveAt: "2026-08-01T10:00:00.000Z",
        correlationId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "ELIGIBILITY_TRANSITION_INVALID" });
    expect(append).not.toHaveBeenCalled();
  });
});
