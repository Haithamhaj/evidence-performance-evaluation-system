import { afterAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@evaluation/database";

import { createDatabaseContinuityRuntime } from "../apps/api/src/continuity/continuity.module.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

afterAll(async () => database.$disconnect());

describe.sequential("atomic continuity return decisions", () => {
  it("rejects missing and stale returns before changing any responsibility", async () => {
    const fixture = await createFixture();
    const before = await responsibilitySnapshot(fixture.projectIds);

    await expect(
      fixture.runtime.returns.finalize({
        ...fixture.finalizeInput,
        returnId: crypto.randomUUID(),
        choice: "RETURN",
      }),
    ).rejects.toMatchObject({ code: "RETURN_HANDOVER_INVALID" });
    await expect(
      fixture.runtime.returns.finalize({
        ...fixture.finalizeInput,
        expectedVersion: 99,
        choice: "RETURN",
      }),
    ).rejects.toMatchObject({ code: "RETURN_HANDOVER_INVALID" });

    expect(await responsibilitySnapshot(fixture.projectIds)).toEqual(before);
    await expect(
      database.returnHandover.findUniqueOrThrow({ where: { id: fixture.returnId } }),
    ).resolves.toMatchObject({ state: "DRAFT", version: 1 });
    await expect(
      database.delegation.findUniqueOrThrow({ where: { id: fixture.delegationId } }),
    ).resolves.toMatchObject({ state: "ACTIVE" });
  });

  it("rolls back the first scope and return record when a later scope fails", async () => {
    const fixture = await createFixture();
    const ordered = [...fixture.projectIds].sort();
    await database.project.update({ where: { id: ordered[1]! }, data: { status: "completed" } });
    const before = await responsibilitySnapshot(fixture.projectIds);

    await expect(
      fixture.runtime.returns.finalize({ ...fixture.finalizeInput, choice: "RETURN" }),
    ).rejects.toMatchObject({ code: "RESOURCE_STATE_INVALID" });

    expect(await responsibilitySnapshot(fixture.projectIds)).toEqual(before);
    await expect(
      database.returnHandover.findUniqueOrThrow({ where: { id: fixture.returnId } }),
    ).resolves.toMatchObject({ state: "DRAFT", version: 1 });
    await expect(
      database.delegation.findUniqueOrThrow({ where: { id: fixture.delegationId } }),
    ).resolves.toMatchObject({ state: "ACTIVE" });
    await expect(
      database.auditEvent.count({ where: { correlationId: fixture.finalizeInput.correlationId } }),
    ).resolves.toBe(0);
  });

  it("serializes concurrent return decisions so exactly one can commit", async () => {
    const fixture = await createFixture();
    const attempts = await Promise.allSettled([
      fixture.runtime.returns.finalize({ ...fixture.finalizeInput, choice: "RETURN" }),
      fixture.runtime.returns.finalize({
        ...fixture.finalizeInput,
        choice: "RETURN",
        correlationId: crypto.randomUUID(),
      }),
    ]);

    expect(attempts.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter(({ status }) => status === "rejected")).toHaveLength(1);
    await expect(
      database.returnHandover.findUniqueOrThrow({ where: { id: fixture.returnId } }),
    ).resolves.toMatchObject({ state: "FINALIZED", choice: "RETURN", version: 2 });
    await expect(
      database.delegation.findUniqueOrThrow({ where: { id: fixture.delegationId } }),
    ).resolves.toMatchObject({ state: "RETURNED" });
  });

  it("commits a two-scope extension and permanent transfer as single decisions", async () => {
    const extension = await createFixture();
    await extension.runtime.returns.finalize({
      ...extension.finalizeInput,
      choice: "EXTEND",
      extendedEndsAt: "2026-08-10T08:00:00.000Z",
    });
    await expect(
      database.delegation.findUniqueOrThrow({
        where: { id: extension.delegationId },
        include: { periods: true },
      }),
    ).resolves.toMatchObject({
      state: "ACTIVE",
      periods: expect.arrayContaining([expect.anything(), expect.anything()]),
    });
    expect(
      await database.responsibilityWindow.count({
        where: {
          projectId: { in: extension.projectIds },
          employeeId: extension.delegateId,
          responsibilityType: "acting",
        },
      }),
    ).toBe(4);

    const permanent = await createFixture();
    await permanent.runtime.returns.finalize({
      ...permanent.finalizeInput,
      choice: "PERMANENT_TRANSFER",
    });
    await expect(
      database.returnHandover.findUniqueOrThrow({ where: { id: permanent.returnId } }),
    ).resolves.toMatchObject({ state: "FINALIZED", choice: "PERMANENT_TRANSFER" });
    expect(
      await database.responsibilityWindow.count({
        where: {
          projectId: { in: permanent.projectIds },
          employeeId: permanent.delegateId,
          responsibilityType: "permanent",
          endsAt: null,
        },
      }),
    ).toBe(2);
  });
});

async function createFixture() {
  const suffix = crypto.randomUUID();
  const organization = await database.organization.create({
    data: { key: `return-atomic-${suffix}`, name: "Return Atomicity" },
  });
  const department = await database.department.create({
    data: {
      key: `return-atomic-${suffix}`,
      name: "Return Atomicity",
      organizationId: organization.id,
    },
  });
  const departmentScope = await database.authorizationScope.create({
    data: {
      key: `return-atomic-department-${suffix}`,
      scopeType: "department",
      departmentId: department.id,
    },
  });
  const users = await Promise.all(
    ["manager", "owner", "delegate"].map((name) =>
      database.user.create({
        data: {
          email: `${name}-${suffix}@example.invalid`,
          displayName: `Atomic ${name}`,
        },
      }),
    ),
  );
  const [manager, owner, delegate] = users as [
    (typeof users)[number],
    (typeof users)[number],
    (typeof users)[number],
  ];
  await database.roleAssignment.createMany({
    data: [
      { userId: manager.id, role: "manager", scopeType: "department", scopeId: departmentScope.id },
      ...[owner, delegate].map((user) => ({
        userId: user.id,
        role: "employee" as const,
        scopeType: "department" as const,
        scopeId: departmentScope.id,
      })),
    ],
  });
  const projectIds: string[] = [];
  for (const position of [1, 2]) {
    const projectId = crypto.randomUUID();
    const scope = await database.authorizationScope.create({
      data: {
        id: projectId,
        key: `return-atomic-project-${position}-${suffix}`,
        scopeType: "project",
        departmentId: department.id,
      },
    });
    const project = await database.project.create({
      data: {
        id: projectId,
        organizationId: organization.id,
        departmentId: department.id,
        authorizationScopeId: scope.id,
        name: `Atomic Project ${position}`,
        description: "Two-scope return atomicity fixture",
        status: "active",
        createdById: owner.id,
      },
    });
    projectIds.push(project.id);
    await database.roleAssignment.create({
      data: { userId: owner.id, role: "project_owner", scopeType: "project", scopeId: project.id },
    });
    for (const employee of [owner, delegate]) {
      await database.projectMember.create({
        data: {
          projectId: project.id,
          employeeId: employee.id,
          startsAt: new Date("2026-08-01T00:00:00.000Z"),
          reason: "Atomicity fixture",
          createdById: manager.id,
        },
      });
    }
    await database.responsibilityWindow.create({
      data: {
        employeeId: owner.id,
        projectId: project.id,
        responsibilityType: "original",
        startsAt: new Date("2026-08-01T00:00:00.000Z"),
        reason: "Atomicity fixture owner",
        managerDecisionById: manager.id,
        managerDecisionAt: new Date("2026-08-01T00:00:00.000Z"),
        managerDecisionReason: "Atomicity fixture owner",
        createdById: manager.id,
      },
    });
  }

  const runtime = createDatabaseContinuityRuntime(database);
  const leaveId = crypto.randomUUID();
  const handoverId = crypto.randomUUID();
  const delegationId = crypto.randomUUID();
  const returnId = crypto.randomUUID();
  await runtime.leave.submit({
    id: leaveId,
    employeeId: owner.id,
    actorId: owner.id,
    departmentId: department.id,
    startsAt: "2026-08-06T08:00:00.000Z",
    endsAt: "2026-08-11T08:00:00.000Z",
    reasonCategory: "PLANNED_LEAVE",
    affectedScopes: projectIds.map((id) => ({ kind: "PROJECT" as const, id })),
    correlationId: crypto.randomUUID(),
  });
  await runtime.leave.decide({
    leaveId,
    managerId: manager.id,
    decision: "APPROVED",
    reason: "Atomicity fixture approval",
    correlationId: crypto.randomUUID(),
  });
  await runtime.handover.revise({
    handoverId,
    leaveId,
    employeeId: owner.id,
    actorId: owner.id,
    expectedRevision: 0,
    correlationId: crypto.randomUUID(),
    items: projectIds.map((id) => ({
      scope: { kind: "PROJECT" as const, id },
      currentState: "Active",
      completedWork: "Prepared",
      openWork: "Continue",
      blockersAndRisks: "None",
      immediateNextStep: "Act",
      keyLinks: ["https://example.invalid/atomicity"],
      requiredAccess: ["Project update"],
      pendingDecisions: ["Return"],
      proposedDelegateId: delegate.id,
    })),
  });
  await runtime.handover.confirm({
    handoverId,
    employeeId: owner.id,
    actorId: owner.id,
    expectedRevision: 1,
    correlationId: crypto.randomUUID(),
  });
  await runtime.delegation.approve({
    id: delegationId,
    leaveId,
    ownerId: owner.id,
    delegateId: delegate.id,
    managerId: manager.id,
    departmentId: department.id,
    startsAt: "2026-08-06T08:00:00.000Z",
    endsAt: "2026-08-09T08:00:00.000Z",
    projectIds,
    workstreamIds: [],
    actions: ["project.update"],
    emergency: false,
    emergencyReason: null,
    correlationId: crypto.randomUUID(),
  });
  await runtime.delegation.confirm({
    delegationId,
    delegateId: delegate.id,
    receiptConfirmed: true,
    accessConfirmed: true,
    correlationId: crypto.randomUUID(),
  });
  await runtime.delegation.activate({
    delegationId,
    actorId: manager.id,
    correlationId: crypto.randomUUID(),
  });
  await runtime.returns.draft({
    id: returnId,
    delegationId,
    actorId: delegate.id,
    completedWork: "Maintained both projects",
    decisionsAndChanges: "No protected product change",
    openWork: "Manager return decision",
    risksAndNextSteps: "Apply atomically",
    correlationId: crypto.randomUUID(),
  });
  return {
    runtime,
    projectIds,
    delegateId: delegate.id,
    delegationId,
    returnId,
    finalizeInput: {
      returnId,
      delegationId,
      managerId: manager.id,
      expectedVersion: 1,
      occurredAt: "2026-08-07T12:00:00.000Z",
      reason: "Atomic manager decision",
      correlationId: crypto.randomUUID(),
    },
  };
}

async function responsibilitySnapshot(projectIds: readonly string[]) {
  return database.responsibilityWindow.findMany({
    where: { projectId: { in: [...projectIds] } },
    select: {
      id: true,
      employeeId: true,
      projectId: true,
      responsibilityType: true,
      startsAt: true,
      endsAt: true,
    },
    orderBy: [{ projectId: "asc" }, { startsAt: "asc" }, { id: "asc" }],
  });
}
