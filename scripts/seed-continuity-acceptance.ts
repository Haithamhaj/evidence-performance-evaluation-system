import {
  DelegationService,
  HandoverService,
  LeaveService,
  PrismaContinuityPersistence,
} from "@evaluation/continuity";
import { createDatabaseClient } from "@evaluation/database";

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
} as const;

export async function seedContinuityAcceptance(database: ReturnType<typeof createDatabaseClient>) {
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
    for (const [id, email, displayName] of [
      [ids.owner, "continuity-owner@seed.invalid", "Continuity Owner"],
      [ids.delegate, "continuity-delegate@seed.invalid", "Continuity Delegate"],
      [ids.manager, "continuity-manager@seed.invalid", "Continuity Manager"],
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
    for (const userId of [ids.owner, ids.delegate]) {
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
  });
  const store = new PrismaContinuityPersistence(database);
  const scopeReader = { assertEmployeeScope: async () => undefined };
  const authorization = {
    canManageEmployee: async (managerId: string) => managerId === ids.manager,
  };
  const leave = new LeaveService(store, scopeReader, authorization);
  let leaveRecord = await database.leaveRecord.findUnique({ where: { id: ids.leave } });
  if (!leaveRecord) {
    await leave.submit({
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
    await leave.decide({
      leaveId: ids.leave,
      managerId: ids.manager,
      decision: "APPROVED",
      reason: "Approved operational continuity fixture",
      correlationId: crypto.randomUUID(),
    });
  }
  if ((await database.handoverRevision.count({ where: { handoverId: ids.handover } })) === 0) {
    await new HandoverService(store, scopeReader).revise({
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
  const delegation = new DelegationService(store, authorization);
  let delegationRecord = await database.delegation.findUnique({ where: { id: ids.delegation } });
  if (!delegationRecord) {
    await delegation.approve({
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
      await delegation.confirm({
        delegationId: ids.delegation,
        delegateId: ids.delegate,
        receiptConfirmed: true,
        accessConfirmed: true,
        correlationId: crypto.randomUUID(),
      });
    }
    await delegation.activate({
      delegationId: ids.delegation,
      actorId: ids.manager,
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
