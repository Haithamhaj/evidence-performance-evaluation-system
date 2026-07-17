import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient } from "@evaluation/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createProjectService } from "./project-service.js";
import { createWorkstreamService } from "./workstream-service.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const now = new Date("2026-07-17T12:00:00Z");

type Fixture = Readonly<{
  departmentId: string;
  otherDepartmentId: string;
  managerId: string;
  otherManagerId: string;
  ownerAId: string;
  ownerBId: string;
  contributorAId: string;
  contributorBId: string;
}>;

let fixture: Fixture;

async function seedFixture(): Promise<Fixture> {
  const suffix = crypto.randomUUID();
  const organization = await client.organization.create({
    data: { key: `workstream-org-${suffix}`, name: "Workstream Organization" },
  });
  const department = await client.department.create({
    data: {
      key: `workstream-department-${suffix}`,
      name: "Workstream Department",
      organizationId: organization.id,
    },
  });
  const otherDepartment = await client.department.create({
    data: {
      key: `workstream-other-department-${suffix}`,
      name: "Other Department",
      organizationId: organization.id,
    },
  });
  const departmentScope = await client.authorizationScope.create({
    data: {
      key: `workstream-department-scope-${suffix}`,
      scopeType: "department",
      departmentId: department.id,
    },
  });
  const otherDepartmentScope = await client.authorizationScope.create({
    data: {
      key: `workstream-other-department-scope-${suffix}`,
      scopeType: "department",
      departmentId: otherDepartment.id,
    },
  });
  const createUser = (key: string) =>
    client.user.create({
      data: {
        email: `${key}-${suffix}@example.invalid`,
        displayName: key,
      },
    });
  const [manager, otherManager, ownerA, ownerB, contributorA, contributorB] = await Promise.all([
    createUser("manager"),
    createUser("other-manager"),
    createUser("owner-a"),
    createUser("owner-b"),
    createUser("contributor-a"),
    createUser("contributor-b"),
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
      ...[ownerA, ownerB, contributorA, contributorB].map((user) => ({
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
    ownerAId: ownerA.id,
    ownerBId: ownerB.id,
    contributorAId: contributorA.id,
    contributorBId: contributorB.id,
  };
}

async function createProject(
  managerId = fixture.managerId,
  ownerId = fixture.ownerAId,
  departmentId = fixture.departmentId,
) {
  return createProjectService(client, databaseAuditWriter as never, () => now).createProject({
    actor: { userId: managerId, active: true },
    correlationId: crypto.randomUUID(),
    input: {
      departmentId,
      name: `Project ${crypto.randomUUID()}`,
      description: "Workstream parent",
      primaryOwnerId: ownerId,
      startsAt: "2026-07-17T06:00:00Z",
      reason: "Approved project",
    },
  });
}

function createCommand(projectId: string, ownerId = fixture.ownerAId, actorId = fixture.managerId) {
  return {
    actor: { userId: actorId, active: true },
    correlationId: crypto.randomUUID(),
    projectId,
    input: {
      name: `Workstream ${crypto.randomUUID()}`,
      description: "Governed delivery stream",
      primaryOwnerId: ownerId,
      startsAt: "2026-07-17T07:00:00Z",
      reason: "Approved workstream",
    },
  } as const;
}

beforeAll(async () => {
  fixture = await seedFixture();
});

afterAll(async () => client.$disconnect());

describe("WorkstreamService", () => {
  it("creates two governed workstreams and overlapping contributor windows", async () => {
    const project = await createProject();
    const service = createWorkstreamService(client, databaseAuditWriter as never, () => now);
    const firstCommand = createCommand(project.id, fixture.ownerAId);
    const first = await service.createWorkstream(firstCommand);
    const second = await service.createWorkstream(createCommand(project.id, fixture.ownerBId));

    expect(
      await service.listWorkstreams({ actor: firstCommand.actor, projectId: project.id }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: first.id, projectId: project.id }),
        expect.objectContaining({ id: second.id, projectId: project.id }),
      ]),
    );
    await service.addContributor({
      actor: firstCommand.actor,
      correlationId: crypto.randomUUID(),
      projectId: project.id,
      workstreamId: first.id,
      input: {
        userId: fixture.contributorAId,
        startsAt: "2026-07-17T08:00:00Z",
        reason: "Approved contribution A",
      },
    });
    await service.addContributor({
      actor: firstCommand.actor,
      correlationId: crypto.randomUUID(),
      projectId: project.id,
      workstreamId: first.id,
      input: {
        userId: fixture.contributorBId,
        startsAt: "2026-07-17T08:30:00Z",
        reason: "Approved contribution B",
      },
    });

    await expect(
      client.responsibilityWindow.count({
        where: { workstreamId: first.id, responsibilityType: "contributor", endsAt: null },
      }),
    ).resolves.toBe(2);
    await expect(
      client.auditEvent.findFirstOrThrow({
        where: { correlationId: firstCommand.correlationId, eventType: "workstream.created" },
      }),
    ).resolves.toMatchObject({ scopeId: first.id, reason: "Approved workstream" });
  });

  it("rejects cross-department creation, an ineligible owner, and future starts", async () => {
    const project = await createProject();
    const service = createWorkstreamService(client, databaseAuditWriter as never, () => now);
    await expect(
      service.createWorkstream(createCommand(project.id, fixture.ownerAId, fixture.otherManagerId)),
    ).rejects.toMatchObject({ code: "AUTHZ_SCOPE_MISMATCH" });
    await expect(
      service.createWorkstream(createCommand(project.id, fixture.otherManagerId)),
    ).rejects.toMatchObject({ code: "WORKSTREAM_OWNER_INVALID" });
    const future = createCommand(project.id);
    await expect(
      service.createWorkstream({
        ...future,
        input: { ...future.input, startsAt: "2026-07-18T00:00:00Z" },
      }),
    ).rejects.toMatchObject({ code: "WORKSTREAM_STARTS_AT_INVALID" });

    const failure = new Error("forced create audit failure");
    const failingService = createWorkstreamService(
      client,
      { append: async () => Promise.reject(failure) },
      () => now,
    );
    const before = await client.workstream.count({ where: { projectId: project.id } });
    await expect(failingService.createWorkstream(createCommand(project.id))).rejects.toBe(failure);
    await expect(client.workstream.count({ where: { projectId: project.id } })).resolves.toBe(
      before,
    );
  });

  it("persists read filtering for managers, project owners, and assigned workstream users", async () => {
    const project = await createProject();
    const otherProject = await createProject(
      fixture.otherManagerId,
      fixture.otherManagerId,
      fixture.otherDepartmentId,
    );
    const service = createWorkstreamService(client, databaseAuditWriter as never, () => now);
    const workstream = await service.createWorkstream(createCommand(project.id, fixture.ownerBId));
    await service.createWorkstream(
      createCommand(otherProject.id, fixture.otherManagerId, fixture.otherManagerId),
    );

    const managerRows = await service.listWorkstreams({
      actor: { userId: fixture.managerId, active: true },
      projectId: project.id,
    });
    expect(managerRows).toHaveLength(1);
    await expect(
      service.getWorkstream({
        actor: { userId: fixture.ownerAId, active: true },
        projectId: project.id,
        workstreamId: workstream.id,
      }),
    ).resolves.toMatchObject({ id: workstream.id });
    await expect(
      service.getWorkstream({
        actor: { userId: fixture.contributorAId, active: true },
        projectId: project.id,
        workstreamId: workstream.id,
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_SCOPE_MISMATCH" });

    const projectService = createProjectService(client, databaseAuditWriter as never, () => now);
    await expect(
      projectService.getProject({
        actor: { userId: fixture.ownerBId, active: true },
        projectId: project.id,
      }),
    ).resolves.toMatchObject({ id: project.id });

    await service.addContributor({
      actor: { userId: fixture.managerId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: project.id,
      workstreamId: workstream.id,
      input: {
        userId: fixture.contributorAId,
        startsAt: "2026-07-17T08:00:00Z",
        reason: "Approved contribution",
      },
    });
    await expect(
      projectService.getProject({
        actor: { userId: fixture.contributorAId, active: true },
        projectId: project.id,
      }),
    ).resolves.toMatchObject({ id: project.id });
  });

  it("ends a contributor once, preserves history, and protects the owner", async () => {
    const project = await createProject();
    const service = createWorkstreamService(client, databaseAuditWriter as never, () => now);
    const workstream = await service.createWorkstream(createCommand(project.id));
    await service.addContributor({
      actor: { userId: fixture.managerId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: project.id,
      workstreamId: workstream.id,
      input: {
        userId: fixture.contributorAId,
        startsAt: "2026-07-17T08:00:00Z",
        reason: "Approved contribution",
      },
    });
    const end = () => ({
      actor: { userId: fixture.managerId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: project.id,
      workstreamId: workstream.id,
      userId: fixture.contributorAId,
      input: {
        endsAt: "2026-07-17T10:00:00Z",
        reason: "Contribution completed",
        expectedVersion: workstream.version,
      },
    });
    const results = await Promise.allSettled([
      service.endContributor(end()),
      service.endContributor(end()),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual(["fulfilled", "rejected"]);
    await expect(
      service.endContributor({ ...end(), userId: fixture.ownerAId }),
    ).rejects.toMatchObject({ code: "WORKSTREAM_OWNER_MEMBERSHIP_PROTECTED" });
    await expect(
      client.workstreamMember.count({
        where: {
          workstreamId: workstream.id,
          employeeId: fixture.contributorAId,
          endsAt: { not: null },
        },
      }),
    ).resolves.toBe(1);
    await expect(
      client.auditEvent.count({
        where: {
          eventType: "workstream.contributor_ended",
          scopeId: workstream.id,
          effectiveSubjectId: fixture.contributorAId,
        },
      }),
    ).resolves.toBe(1);
  });

  it("records terminal status atomically and rejects later contributors", async () => {
    const project = await createProject();
    const service = createWorkstreamService(client, databaseAuditWriter as never, () => now);
    const workstream = await service.createWorkstream(createCommand(project.id));
    const completed = await service.transitionWorkstream({
      actor: { userId: fixture.managerId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: project.id,
      workstreamId: workstream.id,
      input: {
        status: "completed",
        reason: "Approved completion",
        expectedVersion: workstream.version,
      },
    });
    expect(completed).toMatchObject({ status: "completed", version: 2, primaryOwnerId: null });
    await expect(
      service.addContributor({
        actor: { userId: fixture.managerId, active: true },
        correlationId: crypto.randomUUID(),
        projectId: project.id,
        workstreamId: workstream.id,
        input: {
          userId: fixture.contributorAId,
          startsAt: "2026-07-17T11:00:00Z",
          reason: "Invalid terminal contribution",
        },
      }),
    ).rejects.toMatchObject({ code: "WORKSTREAM_STATE_INVALID" });

    const rollbackWorkstream = await service.createWorkstream(createCommand(project.id));
    const failure = new Error("forced audit failure");
    const failingService = createWorkstreamService(
      client,
      { append: async () => Promise.reject(failure) },
      () => now,
    );
    await expect(
      failingService.transitionWorkstream({
        actor: { userId: fixture.managerId, active: true },
        correlationId: crypto.randomUUID(),
        projectId: project.id,
        workstreamId: rollbackWorkstream.id,
        input: {
          status: "completed",
          reason: "Rollback completion",
          expectedVersion: rollbackWorkstream.version,
        },
      }),
    ).rejects.toBe(failure);
    await expect(
      client.workstream.findUniqueOrThrow({ where: { id: rollbackWorkstream.id } }),
    ).resolves.toMatchObject({ status: "active", version: 1 });
  });
});
