import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient } from "@evaluation/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createProjectService } from "./project-service.js";
import { createResponsibilityService } from "./responsibility-service.js";
import { createWorkstreamService } from "./workstream-service.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const now = new Date("2026-07-17T12:00:00Z");

type Fixture = Readonly<{
  departmentId: string;
  otherDepartmentId: string;
  managerId: string;
  otherManagerId: string;
  administratorId: string;
  ownerAId: string;
  ownerBId: string;
  ownerCId: string;
}>;

let fixture: Fixture;

async function seedFixture(): Promise<Fixture> {
  const suffix = crypto.randomUUID();
  const organization = await client.organization.create({
    data: { key: `responsibility-org-${suffix}`, name: "Responsibility Organization" },
  });
  const department = await client.department.create({
    data: {
      key: `responsibility-department-${suffix}`,
      name: "Responsibility Department",
      organizationId: organization.id,
    },
  });
  const otherDepartment = await client.department.create({
    data: {
      key: `responsibility-other-${suffix}`,
      name: "Other Department",
      organizationId: organization.id,
    },
  });
  const departmentScope = await client.authorizationScope.create({
    data: {
      key: `responsibility-department-scope-${suffix}`,
      scopeType: "department",
      departmentId: department.id,
    },
  });
  const otherDepartmentScope = await client.authorizationScope.create({
    data: {
      key: `responsibility-other-scope-${suffix}`,
      scopeType: "department",
      departmentId: otherDepartment.id,
    },
  });
  const systemScope = await client.authorizationScope.create({
    data: { key: `responsibility-system-${suffix}`, scopeType: "system" },
  });
  const createUser = (key: string) =>
    client.user.create({
      data: { email: `${key}-${suffix}@example.invalid`, displayName: key },
    });
  const [manager, otherManager, administrator, ownerA, ownerB, ownerC] = await Promise.all([
    createUser("manager"),
    createUser("other-manager"),
    createUser("administrator"),
    createUser("owner-a"),
    createUser("owner-b"),
    createUser("owner-c"),
  ]);
  await client.roleAssignment.createMany({
    data: [
      { userId: manager.id, role: "manager", scopeType: "department", scopeId: departmentScope.id },
      {
        userId: otherManager.id,
        role: "manager",
        scopeType: "department",
        scopeId: otherDepartmentScope.id,
      },
      {
        userId: otherManager.id,
        role: "employee",
        scopeType: "department",
        scopeId: otherDepartmentScope.id,
      },
      {
        userId: administrator.id,
        role: "system_administrator",
        scopeType: "system",
        scopeId: systemScope.id,
      },
      ...[ownerA, ownerB, ownerC].map((user) => ({
        userId: user.id,
        role: "employee" as const,
        scopeType: "department" as const,
        scopeId: departmentScope.id,
      })),
    ],
  });
  return {
    departmentId: department.id,
    otherDepartmentId: otherDepartment.id,
    managerId: manager.id,
    otherManagerId: otherManager.id,
    administratorId: administrator.id,
    ownerAId: ownerA.id,
    ownerBId: ownerB.id,
    ownerCId: ownerC.id,
  };
}

async function createProject() {
  return createProjectService(client, databaseAuditWriter as never, () => now).createProject({
    actor: { userId: fixture.managerId, active: true },
    correlationId: crypto.randomUUID(),
    input: {
      departmentId: fixture.departmentId,
      name: `Transfer Project ${crypto.randomUUID()}`,
      description: "Responsibility transfer fixture",
      primaryOwnerId: fixture.ownerAId,
      startsAt: "2026-07-17T06:00:00Z",
      reason: "Approved project",
    },
  });
}

function permanentCommand(projectId: string, toUserId: string, expectedVersion = 1) {
  return {
    actor: { userId: fixture.managerId, active: true },
    correlationId: crypto.randomUUID(),
    projectId,
    input: {
      transferKind: "permanent",
      toUserId,
      effectiveAt: "2026-08-01T00:00:00Z",
      reason: "Approved permanent transfer",
      expectedVersion,
    },
  } as const;
}

async function transferState(projectId: string, workstreamId: string | null = null) {
  const scopeId = workstreamId ?? projectId;
  const [resource, transfers, windows, memberships, roles, audits] = await Promise.all([
    workstreamId === null
      ? client.project.findUniqueOrThrow({
          where: { id: projectId },
          select: { status: true, version: true },
        })
      : client.workstream.findUniqueOrThrow({
          where: { id: workstreamId },
          select: { status: true, version: true },
        }),
    client.ownershipTransfer.count({
      where: workstreamId === null ? { projectId } : { workstreamId },
    }),
    client.responsibilityWindow.findMany({
      where: workstreamId === null ? { projectId } : { workstreamId },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        employeeId: true,
        responsibilityType: true,
        startsAt: true,
        endsAt: true,
      },
    }),
    workstreamId === null
      ? client.projectMember.findMany({
          where: { projectId },
          orderBy: [{ startsAt: "asc" }, { id: "asc" }],
          select: { id: true, employeeId: true, startsAt: true, endsAt: true },
        })
      : client.workstreamMember.findMany({
          where: { workstreamId },
          orderBy: [{ startsAt: "asc" }, { id: "asc" }],
          select: { id: true, employeeId: true, startsAt: true, endsAt: true },
        }),
    client.roleAssignment.findMany({
      where: { scopeType: workstreamId === null ? "project" : "workstream", scopeId },
      orderBy: [{ userId: "asc" }, { role: "asc" }],
      select: { userId: true, role: true, scopeType: true, scopeId: true },
    }),
    client.auditEvent.count({ where: { scopeId } }),
  ]);
  return { resource, transfers, windows, memberships, roles, audits };
}

beforeAll(async () => {
  fixture = await seedFixture();
});

afterAll(async () => client.$disconnect());

describe("ResponsibilityService", () => {
  it("allows exactly one concurrent permanent project transfer and preserves half-open history", async () => {
    const project = await createProject();
    const service = createResponsibilityService(client, databaseAuditWriter as never, () => now);
    const results = await Promise.allSettled([
      service.transferProjectOwner(permanentCommand(project.id, fixture.ownerBId)),
      service.transferProjectOwner(permanentCommand(project.id, fixture.ownerCId)),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual(["fulfilled", "rejected"]);
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(rejected?.reason).toMatchObject({ code: "VERSION_CONFLICT" });

    const history = await service.responsibilityHistory({
      actor: { userId: fixture.managerId, active: true },
      projectId: project.id,
    });
    expect(history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          employeeId: fixture.ownerAId,
          endsAt: "2026-08-01T00:00:00.000Z",
        }),
        expect.objectContaining({
          employeeId: expect.stringMatching(
            new RegExp(`^(?:${fixture.ownerBId}|${fixture.ownerCId})$`, "u"),
          ),
          startsAt: "2026-08-01T00:00:00.000Z",
        }),
      ]),
    );
    const before = await service.responsibilitiesAt({
      actor: { userId: fixture.managerId, active: true },
      projectId: project.id,
      at: "2026-07-31T23:59:59Z",
    });
    const after = await service.responsibilitiesAt({
      actor: { userId: fixture.managerId, active: true },
      projectId: project.id,
      at: "2026-08-01T00:00:00Z",
    });
    expect(before).toContainEqual(expect.objectContaining({ employeeId: fixture.ownerAId }));
    expect(after.some(({ employeeId }) => employeeId === fixture.ownerAId)).toBe(false);
  });

  it("creates a bounded acting owner and exact prospective return window", async () => {
    const project = await createProject();
    const service = createResponsibilityService(client, databaseAuditWriter as never, () => now);
    const transfer = await service.transferProjectOwner({
      actor: { userId: fixture.managerId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: project.id,
      input: {
        transferKind: "acting",
        toUserId: fixture.ownerBId,
        effectiveAt: "2026-08-01T00:00:00Z",
        endsAt: "2026-08-08T00:00:00Z",
        delegationType: "approved_leave",
        reason: "Approved temporary coverage",
        expectedVersion: project.version,
      },
    });
    expect(transfer).toMatchObject({ transferKind: "acting", returnWindowId: expect.any(String) });

    const before = await service.responsibilitiesAt({
      actor: { userId: fixture.managerId, active: true },
      projectId: project.id,
      at: "2026-07-31T23:59:59Z",
    });
    const during = await service.responsibilitiesAt({
      actor: { userId: fixture.managerId, active: true },
      projectId: project.id,
      at: "2026-08-01T00:00:00Z",
    });
    const returned = await service.responsibilitiesAt({
      actor: { userId: fixture.managerId, active: true },
      projectId: project.id,
      at: "2026-08-08T00:00:00Z",
    });
    expect(before).toContainEqual(expect.objectContaining({ employeeId: fixture.ownerAId }));
    expect(during).toContainEqual(
      expect.objectContaining({ employeeId: fixture.ownerBId, responsibilityType: "acting" }),
    );
    expect(returned).toContainEqual(
      expect.objectContaining({ employeeId: fixture.ownerAId, responsibilityType: "permanent" }),
    );
    await expect(
      client.roleAssignment.findFirstOrThrow({
        where: {
          userId: fixture.ownerBId,
          role: "acting_owner",
          scopeType: "project",
          scopeId: project.id,
        },
      }),
    ).resolves.toBeDefined();
    await expect(
      service.transferProjectOwner({
        actor: { userId: fixture.managerId, active: true },
        correlationId: crypto.randomUUID(),
        projectId: project.id,
        input: {
          transferKind: "permanent",
          toUserId: fixture.ownerCId,
          effectiveAt: "2026-08-04T00:00:00Z",
          reason: "Invalid nested acting transfer",
          expectedVersion: 2,
        },
      }),
    ).rejects.toMatchObject({ code: "NESTED_ACTING_TRANSFER" });
    await expect(
      client.ownershipTransfer.count({ where: { projectId: project.id } }),
    ).resolves.toBe(1);
  });

  it("transfers a workstream owner and rejects a mismatched parent", async () => {
    const project = await createProject();
    const workstream = await createWorkstreamService(
      client,
      databaseAuditWriter as never,
      () => now,
    ).createWorkstream({
      actor: { userId: fixture.managerId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: project.id,
      input: {
        name: "Transfer Workstream",
        description: "Workstream transfer fixture",
        primaryOwnerId: fixture.ownerAId,
        startsAt: "2026-07-17T07:00:00Z",
        reason: "Approved workstream",
      },
    });
    const otherProject = await createProject();
    const service = createResponsibilityService(client, databaseAuditWriter as never, () => now);
    await expect(
      service.transferWorkstreamOwner({
        ...permanentCommand(project.id, fixture.ownerBId),
        workstreamId: workstream.id,
      }),
    ).resolves.toMatchObject({ transferKind: "permanent" });
    await expect(
      service.workstreamResponsibilitiesAt({
        actor: { userId: fixture.managerId, active: true },
        projectId: project.id,
        workstreamId: workstream.id,
        at: "2026-08-01T00:00:00Z",
      }),
    ).resolves.toContainEqual(expect.objectContaining({ employeeId: fixture.ownerBId }));
    await expect(
      service.workstreamResponsibilityHistory({
        actor: { userId: fixture.managerId, active: true },
        projectId: project.id,
        workstreamId: workstream.id,
      }),
    ).resolves.toHaveLength(2);
    const beforeMismatch = await transferState(project.id, workstream.id);
    await expect(
      service.transferWorkstreamOwner({
        ...permanentCommand(otherProject.id, fixture.ownerCId, 2),
        workstreamId: workstream.id,
      }),
    ).rejects.toMatchObject({ code: "WORKSTREAM_NOT_FOUND" });
    await expect(transferState(project.id, workstream.id)).resolves.toEqual(beforeMismatch);
  });

  it("denies non-managers, cross-department managers, inactive actors, and stale versions", async () => {
    const service = createResponsibilityService(client, databaseAuditWriter as never, () => now);
    for (const actor of [
      { userId: fixture.ownerAId, active: true, code: "AUTHZ_ROLE_REQUIRED" },
      { userId: fixture.administratorId, active: true, code: "AUTHZ_ROLE_REQUIRED" },
      { userId: fixture.otherManagerId, active: true, code: "AUTHZ_SCOPE_MISMATCH" },
      { userId: fixture.managerId, active: false, code: "AUTHZ_INACTIVE" },
    ]) {
      const project = await createProject();
      const command = permanentCommand(project.id, fixture.ownerBId);
      const before = await transferState(project.id);
      await expect(
        service.transferProjectOwner({
          ...command,
          actor: { userId: actor.userId, active: actor.active },
        }),
      ).rejects.toMatchObject({ code: actor.code });
      await expect(transferState(project.id)).resolves.toEqual(before);
    }
    const staleProject = await createProject();
    const beforeStale = await transferState(staleProject.id);
    await expect(
      service.transferProjectOwner(permanentCommand(staleProject.id, fixture.ownerBId, 99)),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    await expect(transferState(staleProject.id)).resolves.toEqual(beforeStale);
    const invalidTargetProject = await createProject();
    const beforeInvalidTarget = await transferState(invalidTargetProject.id);
    await expect(
      service.transferProjectOwner(
        permanentCommand(invalidTargetProject.id, fixture.otherManagerId),
      ),
    ).rejects.toMatchObject({ code: "RESPONSIBILITY_TARGET_INVALID" });
    await expect(transferState(invalidTargetProject.id)).resolves.toEqual(beforeInvalidTarget);
  });

  it("rejects workstream-owner transfer attempts and invalid acting inputs without state changes", async () => {
    const project = await createProject();
    const workstream = await createWorkstreamService(
      client,
      databaseAuditWriter as never,
      () => now,
    ).createWorkstream({
      actor: { userId: fixture.managerId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: project.id,
      input: {
        name: "Protected Transfer Workstream",
        description: "Authorization fixture",
        primaryOwnerId: fixture.ownerAId,
        startsAt: "2026-07-17T07:00:00Z",
        reason: "Approved workstream",
      },
    });
    const service = createResponsibilityService(client, databaseAuditWriter as never, () => now);
    const beforeOwnerAttempt = await transferState(project.id, workstream.id);
    await expect(
      service.transferWorkstreamOwner({
        ...permanentCommand(project.id, fixture.ownerBId),
        actor: { userId: fixture.ownerAId, active: true },
        workstreamId: workstream.id,
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_ROLE_REQUIRED" });
    await expect(transferState(project.id, workstream.id)).resolves.toEqual(beforeOwnerAttempt);

    const beforeInvalidActing = await transferState(project.id);
    await expect(
      service.transferProjectOwner({
        actor: { userId: fixture.managerId, active: true },
        correlationId: crypto.randomUUID(),
        projectId: project.id,
        input: {
          transferKind: "acting",
          toUserId: fixture.ownerBId,
          effectiveAt: "2026-08-01T00:00:00Z",
          delegationType: "approved_leave",
          reason: "Missing acting end",
          expectedVersion: 1,
        },
      }),
    ).rejects.toMatchObject({ name: "ZodError" });
    await expect(
      service.transferProjectOwner({
        actor: { userId: fixture.managerId, active: true },
        correlationId: crypto.randomUUID(),
        projectId: project.id,
        input: {
          transferKind: "acting",
          toUserId: fixture.ownerBId,
          effectiveAt: "2026-08-08T00:00:00Z",
          endsAt: "2026-08-01T00:00:00Z",
          delegationType: "approved_leave",
          reason: "Invalid acting interval",
          expectedVersion: 1,
        },
      }),
    ).rejects.toMatchObject({ name: "ZodError" });
    await expect(transferState(project.id)).resolves.toEqual(beforeInvalidActing);
  });

  it("rolls back all transfer effects when audit persistence fails", async () => {
    const project = await createProject();
    const failure = new Error("forced transfer audit failure");
    const service = createResponsibilityService(
      client,
      { append: async () => Promise.reject(failure) },
      () => now,
    );
    await expect(
      service.transferProjectOwner(permanentCommand(project.id, fixture.ownerBId)),
    ).rejects.toBe(failure);
    await expect(
      client.project.findUniqueOrThrow({ where: { id: project.id } }),
    ).resolves.toMatchObject({
      version: 1,
    });
    await expect(
      client.ownershipTransfer.count({ where: { projectId: project.id } }),
    ).resolves.toBe(0);
    await expect(
      client.responsibilityWindow.findFirstOrThrow({
        where: {
          projectId: project.id,
          employeeId: fixture.ownerAId,
          responsibilityType: "original",
        },
      }),
    ).resolves.toMatchObject({ endsAt: null });
    await expect(
      client.projectMember.count({
        where: { projectId: project.id, employeeId: fixture.ownerBId },
      }),
    ).resolves.toBe(0);
    await expect(
      client.roleAssignment.count({
        where: {
          userId: fixture.ownerBId,
          role: "project_owner",
          scopeType: "project",
          scopeId: project.id,
        },
      }),
    ).resolves.toBe(0);
    await expect(
      client.responsibilityWindow.count({ where: { projectId: project.id } }),
    ).resolves.toBe(1);
  });
});
