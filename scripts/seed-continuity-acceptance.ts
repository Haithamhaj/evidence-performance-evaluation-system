import { createDatabaseClient } from "@evaluation/database";

import { createDatabaseContinuityRuntime } from "../apps/api/src/continuity/continuity.module.js";

const ids = {
  organization: "e6a00000-0000-4000-8000-000000000001",
  department: "e6a00000-0000-4000-8000-000000000002",
  departmentScope: "e6a00000-0000-4000-8000-000000000003",
  project: "e6a00000-0000-4000-8000-000000000004",
  owner: "e6a00000-0000-4000-8000-000000000005",
  delegate: "e6a00000-0000-4000-8000-000000000006",
  manager: "e6a00000-0000-4000-8000-000000000007",
  leave: "e6a00000-0000-4000-8000-000000000008",
  handover: "e6a00000-0000-4000-8000-000000000009",
  delegation: "e6a00000-0000-4000-8000-000000000010",
  administrator: "e6a00000-0000-4000-8000-000000000011",
  successor: "e6a00000-0000-4000-8000-000000000012",
  systemScope: "e6a00000-0000-4000-8000-000000000013",
  ownerWindow: "e6a00000-0000-4000-8000-000000000014",
  return: "e6a00000-0000-4000-8000-000000000015",
} as const;

export async function seedContinuityAcceptance(database: ReturnType<typeof createDatabaseClient>) {
  const completed = await database.returnHandover.findUnique({ where: { id: ids.return } });
  if (
    completed?.state === "FINALIZED" &&
    (await database.reassignmentRequiredCase.count({
      where: { formerOwnerId: ids.owner, state: "RESOLVED" },
    })) > 0
  ) {
    return ids;
  }
  await database.$transaction(async (tx) => {
    await tx.organization.upsert({
      where: { key: "continuity-acceptance" },
      create: { id: ids.organization, key: "continuity-acceptance", name: "Continuity Acceptance" },
      update: {},
    });
    await tx.department.upsert({
      where: { key: "continuity-acceptance" },
      create: {
        id: ids.department,
        key: "continuity-acceptance",
        name: "Continuity Acceptance",
        organizationId: ids.organization,
      },
      update: {},
    });
    await tx.authorizationScope.upsert({
      where: { id: ids.departmentScope },
      create: {
        id: ids.departmentScope,
        key: "continuity-acceptance-department",
        scopeType: "department",
        departmentId: ids.department,
      },
      update: {},
    });
    const systemScope = await tx.authorizationScope.upsert({
      where: { key: "system" },
      create: { id: ids.systemScope, key: "system", scopeType: "system" },
      update: {},
    });
    for (const [id, email, displayName] of [
      [ids.owner, "continuity-owner@seed.invalid", "Continuity Owner"],
      [ids.delegate, "continuity-delegate@seed.invalid", "Continuity Delegate"],
      [ids.manager, "continuity-manager@seed.invalid", "Continuity Manager"],
      [ids.administrator, "continuity-admin@seed.invalid", "Continuity Administrator"],
      [ids.successor, "continuity-successor@seed.invalid", "Continuity Successor"],
    ] as const) {
      await tx.user.upsert({
        where: { id },
        create: { id, email, displayName },
        update: { active: true },
      });
    }
    await tx.authorizationScope.upsert({
      where: { id: ids.project },
      create: {
        id: ids.project,
        key: "continuity-acceptance-project",
        scopeType: "project",
        departmentId: ids.department,
      },
      update: {},
    });
    await tx.project.upsert({
      where: { id: ids.project },
      create: {
        id: ids.project,
        organizationId: ids.organization,
        departmentId: ids.department,
        authorizationScopeId: ids.project,
        name: "Continuity Acceptance Project",
        description: "Deterministic leave and delegation fixture",
        status: "active",
        createdById: ids.owner,
      },
      update: {},
    });
    for (const userId of [ids.owner, ids.delegate, ids.successor]) {
      await tx.roleAssignment.upsert({
        where: {
          userId_role_scopeType_scopeId: {
            userId,
            role: "employee",
            scopeType: "department",
            scopeId: ids.departmentScope,
          },
        },
        create: { userId, role: "employee", scopeType: "department", scopeId: ids.departmentScope },
        update: {},
      });
      const existingMember = await tx.projectMember.findFirst({
        where: {
          projectId: ids.project,
          employeeId: userId,
          startsAt: new Date("2026-08-01T00:00:00Z"),
        },
      });
      if (!existingMember) {
        await tx.projectMember.create({
          data: {
            projectId: ids.project,
            employeeId: userId,
            startsAt: new Date("2026-08-01T00:00:00Z"),
            reason: "Continuity acceptance",
            createdById: ids.manager,
          },
        });
      }
    }
    await tx.roleAssignment.upsert({
      where: {
        userId_role_scopeType_scopeId: {
          userId: ids.manager,
          role: "manager",
          scopeType: "department",
          scopeId: ids.departmentScope,
        },
      },
      create: {
        userId: ids.manager,
        role: "manager",
        scopeType: "department",
        scopeId: ids.departmentScope,
      },
      update: {},
    });
    await tx.roleAssignment.upsert({
      where: {
        userId_role_scopeType_scopeId: {
          userId: ids.administrator,
          role: "system_administrator",
          scopeType: "system",
          scopeId: systemScope.id,
        },
      },
      create: {
        userId: ids.administrator,
        role: "system_administrator",
        scopeType: "system",
        scopeId: systemScope.id,
      },
      update: {},
    });
    await tx.roleAssignment.upsert({
      where: {
        userId_role_scopeType_scopeId: {
          userId: ids.owner,
          role: "project_owner",
          scopeType: "project",
          scopeId: ids.project,
        },
      },
      create: {
        userId: ids.owner,
        role: "project_owner",
        scopeType: "project",
        scopeId: ids.project,
      },
      update: {},
    });
    if ((await tx.responsibilityWindow.count({ where: { projectId: ids.project } })) === 0) {
      await tx.responsibilityWindow.create({
        data: {
          id: ids.ownerWindow,
          employeeId: ids.owner,
          projectId: ids.project,
          responsibilityType: "original",
          startsAt: new Date("2026-08-01T00:00:00.000Z"),
          reason: "Continuity acceptance owner",
          managerDecisionById: ids.manager,
          managerDecisionAt: new Date("2026-08-01T00:00:00.000Z"),
          managerDecisionReason: "Continuity acceptance owner",
          createdById: ids.manager,
        },
      });
    }
  });
  const runtime = createDatabaseContinuityRuntime(database);
  let leaveRecord = await database.leaveRecord.findUnique({ where: { id: ids.leave } });
  if (!leaveRecord) {
    await runtime.leave.submit({
      id: ids.leave,
      employeeId: ids.owner,
      actorId: ids.owner,
      departmentId: ids.department,
      startsAt: "2026-08-10T08:00:00.000Z",
      endsAt: "2026-08-12T08:00:00.000Z",
      reasonCategory: "PLANNED_LEAVE",
      affectedScopes: [{ kind: "PROJECT", id: ids.project }],
      correlationId: crypto.randomUUID(),
    });
    leaveRecord = await database.leaveRecord.findUnique({ where: { id: ids.leave } });
  }
  if (leaveRecord?.state === "SUBMITTED") {
    await runtime.leave.decide({
      leaveId: ids.leave,
      managerId: ids.manager,
      decision: "APPROVED",
      reason: "Approved operational continuity fixture",
      correlationId: crypto.randomUUID(),
    });
  }
  if ((await database.handoverRevision.count({ where: { handoverId: ids.handover } })) === 0) {
    await runtime.handover.revise({
      handoverId: ids.handover,
      leaveId: ids.leave,
      employeeId: ids.owner,
      actorId: ids.owner,
      expectedRevision: 0,
      correlationId: crypto.randomUUID(),
      items: [
        {
          scope: { kind: "PROJECT", id: ids.project },
          currentState: "Foundation complete",
          completedWork: "Continuity contract and schema",
          openWork: "Run acceptance",
          blockersAndRisks: "None",
          immediateNextStep: "Delegate exact update authority",
          keyLinks: ["https://example.invalid/continuity"],
          requiredAccess: ["Project read"],
          pendingDecisions: ["Manager confirms return"],
          proposedDelegateId: ids.delegate,
        },
      ],
    });
  }
  if ((await database.handoverConfirmation.count({ where: { handoverId: ids.handover } })) === 0) {
    await runtime.handover.confirm({
      handoverId: ids.handover,
      employeeId: ids.owner,
      actorId: ids.owner,
      expectedRevision: 1,
      correlationId: crypto.randomUUID(),
    });
  }
  let delegationRecord = await database.delegation.findUnique({ where: { id: ids.delegation } });
  if (!delegationRecord) {
    await runtime.delegation.approve({
      id: ids.delegation,
      leaveId: ids.leave,
      ownerId: ids.owner,
      delegateId: ids.delegate,
      managerId: ids.manager,
      departmentId: ids.department,
      startsAt: "2026-08-10T08:00:00.000Z",
      endsAt: "2026-08-12T08:00:00.000Z",
      projectIds: [ids.project],
      workstreamIds: [],
      actions: ["project.update"],
      emergency: false,
      emergencyReason: null,
      correlationId: crypto.randomUUID(),
    });
    delegationRecord = await database.delegation.findUnique({ where: { id: ids.delegation } });
  }
  if (delegationRecord?.state === "PENDING_DELEGATE") {
    if (
      (await database.delegateConfirmation.count({ where: { delegationId: ids.delegation } })) === 0
    ) {
      await runtime.delegation.confirm({
        delegationId: ids.delegation,
        delegateId: ids.delegate,
        receiptConfirmed: true,
        accessConfirmed: true,
        correlationId: crypto.randomUUID(),
      });
    }
    let gap = await database.delegationAccessGap.findFirst({
      where: { delegationId: ids.delegation },
      orderBy: [{ reportedAt: "asc" }, { id: "asc" }],
    });
    if (!gap) {
      await runtime.delegation.reportGap({
        delegationId: ids.delegation,
        delegateId: ids.delegate,
        description: "Acceptance fixture verifies that an open access gap blocks activation",
        correlationId: crypto.randomUUID(),
      });
      gap = await database.delegationAccessGap.findFirstOrThrow({
        where: { delegationId: ids.delegation },
      });
    }
    if (gap.state === "OPEN") {
      await runtime.delegation.resolveGap({
        delegationId: ids.delegation,
        gapId: gap.id,
        managerId: ids.manager,
        resolution: "RESOLVED",
        reason: "Required project access verified",
        correlationId: crypto.randomUUID(),
      });
    }
    delegationRecord = await runtime.delegation.activate({
      delegationId: ids.delegation,
      actorId: ids.manager,
      correlationId: crypto.randomUUID(),
    });
  }
  if (delegationRecord?.state === "ACTIVE") {
    const authority = await runtime.actingAuthority.readAt({
      actorId: ids.delegate,
      action: "project.update",
      resourceId: ids.project,
      occurredAt: "2026-08-10T12:00:00.000Z",
    });
    if (!authority) throw new Error("Continuity acceptance acting authority was not activated");
    let returnRecord = await database.returnHandover.findUnique({ where: { id: ids.return } });
    if (!returnRecord) {
      await runtime.returns.draft({
        id: ids.return,
        delegationId: ids.delegation,
        actorId: ids.delegate,
        completedWork: "Maintained the project during approved leave",
        decisionsAndChanges: "No protected product decision changed",
        openWork: "Continue the accepted engine plan",
        risksAndNextSteps: "Original owner resumes exact project authority",
        correlationId: crypto.randomUUID(),
      });
      returnRecord = await database.returnHandover.findUniqueOrThrow({ where: { id: ids.return } });
    }
    if (returnRecord.state === "DRAFT") {
      await runtime.returns.confirm({
        returnId: ids.return,
        delegationId: ids.delegation,
        actorId: ids.owner,
        expectedVersion: returnRecord.version,
        correlationId: crypto.randomUUID(),
      });
      returnRecord = await database.returnHandover.findUniqueOrThrow({ where: { id: ids.return } });
    }
    if (returnRecord.state === "OWNER_CONFIRMED") {
      await runtime.returns.finalize({
        returnId: ids.return,
        delegationId: ids.delegation,
        managerId: ids.manager,
        expectedVersion: returnRecord.version,
        choice: "RETURN",
        occurredAt: "2026-08-11T08:00:00.000Z",
        correlationId: crypto.randomUUID(),
      });
    }
  }
  const owner = await database.user.findUniqueOrThrow({ where: { id: ids.owner } });
  if (owner.active) {
    await runtime.offboarding.deactivate({
      administratorId: ids.administrator,
      userId: ids.owner,
      occurredAt: "2026-08-11T12:00:00.000Z",
      correlationId: crypto.randomUUID(),
    });
  }
  const queue = await runtime.offboarding.managerQueue(ids.manager);
  for (const item of queue.filter((candidate) => candidate.formerOwnerId === ids.owner)) {
    await runtime.offboarding.resolve({
      caseId: item.id,
      actorId: ids.manager,
      successorId: ids.successor,
      effectiveAt: "2026-08-11T13:00:00.000Z",
      reason: "Continuity acceptance permanent reassignment",
      correlationId: crypto.randomUUID(),
    });
  }
  return ids;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL must be configured");
  const database = createDatabaseClient(databaseUrl);
  seedContinuityAcceptance(database)
    .then((result) => console.log(JSON.stringify(result)))
    .finally(() => database.$disconnect());
}
