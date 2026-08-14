import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient } from "@evaluation/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createProjectService } from "./project-service.js";
import { createResponsibilityService } from "./responsibility-service.js";
import { createWorkstreamService } from "./workstream-service.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const now = new Date("2026-07-17T12:00:00Z");

type Fixture = Readonly<{
  organizationId: string;
  departmentId: string;
  otherDepartmentId: string;
  managerId: string;
  otherManagerId: string;
  administratorId: string;
  ownerId: string;
  memberId: string;
}>;

let fixture: Fixture;

async function seedFixture(): Promise<Fixture> {
  const suffix = crypto.randomUUID();
  const organization = await client.organization.create({
    data: { key: `project-service-org-${suffix}`, name: "Project Service Organization" },
  });
  const department = await client.department.create({
    data: {
      key: `project-service-department-${suffix}`,
      name: "Project Service Department",
      organizationId: organization.id,
    },
  });
  const otherDepartment = await client.department.create({
    data: {
      key: `project-service-other-${suffix}`,
      name: "Other Department",
      organizationId: organization.id,
    },
  });
  const departmentScope = await client.authorizationScope.create({
    data: {
      key: `project-service-department-scope-${suffix}`,
      scopeType: "department",
      departmentId: department.id,
    },
  });
  const otherDepartmentScope = await client.authorizationScope.create({
    data: {
      key: `project-service-other-scope-${suffix}`,
      scopeType: "department",
      departmentId: otherDepartment.id,
    },
  });
  const systemScope = await client.authorizationScope.create({
    data: { key: `project-service-system-scope-${suffix}`, scopeType: "system" },
  });
  const manager = await client.user.create({
    data: { email: `project-manager-${suffix}@example.invalid`, displayName: "Manager" },
  });
  const otherManager = await client.user.create({
    data: { email: `other-manager-${suffix}@example.invalid`, displayName: "Other Manager" },
  });
  const administrator = await client.user.create({
    data: { email: `project-admin-${suffix}@example.invalid`, displayName: "Administrator" },
  });
  const owner = await client.user.create({
    data: { email: `project-owner-${suffix}@example.invalid`, displayName: "Owner" },
  });
  const member = await client.user.create({
    data: { email: `project-member-${suffix}@example.invalid`, displayName: "Member" },
  });
  await client.roleAssignment.createMany({
    data: [
      {
        userId: manager.id,
        role: "manager",
        scopeType: "department",
        scopeId: departmentScope.id,
      },
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
      {
        userId: owner.id,
        role: "employee",
        scopeType: "department",
        scopeId: departmentScope.id,
      },
      {
        userId: member.id,
        role: "employee",
        scopeType: "department",
        scopeId: departmentScope.id,
      },
    ],
  });
  return {
    organizationId: organization.id,
    departmentId: department.id,
    otherDepartmentId: otherDepartment.id,
    managerId: manager.id,
    otherManagerId: otherManager.id,
    administratorId: administrator.id,
    ownerId: owner.id,
    memberId: member.id,
  };
}

function command(
  actorId = fixture.managerId,
  ownerId = fixture.ownerId,
  departmentId = fixture.departmentId,
) {
  return {
    actor: { userId: actorId, active: true },
    correlationId: crypto.randomUUID(),
    input: {
      departmentId,
      name: "Evaluation Platform",
      description: "Pilot implementation",
      primaryOwnerId: ownerId,
      startsAt: "2026-07-17T06:00:00Z",
      reason: "Approved department project",
    },
  } as const;
}

beforeAll(async () => {
  fixture = await seedFixture();
});

afterAll(async () => client.$disconnect());

describe("ProjectService", () => {
  it("creates the active project and governed owner records atomically", async () => {
    const service = createProjectService(client, databaseAuditWriter as never, () => now);
    const request = command();
    const created = await service.createProject(request);

    expect(created).toMatchObject({
      departmentId: fixture.departmentId,
      name: "Evaluation Platform",
      status: "active",
      version: 1,
      primaryOwnerId: fixture.ownerId,
    });
    await expect(
      client.responsibilityWindow.findFirstOrThrow({
        where: { projectId: created.id, responsibilityType: "original" },
      }),
    ).resolves.toMatchObject({
      employeeId: fixture.ownerId,
      managerDecisionById: fixture.managerId,
      managerDecisionReason: "Approved department project",
    });
    await expect(
      client.projectMember.findFirstOrThrow({
        where: { projectId: created.id, employeeId: fixture.ownerId },
      }),
    ).resolves.toMatchObject({ endsAt: null });
    await expect(
      client.roleAssignment.findFirstOrThrow({
        where: { userId: fixture.ownerId, role: "project_owner", scopeId: created.id },
      }),
    ).resolves.toMatchObject({ scopeType: "project" });
    await expect(
      client.auditEvent.findFirstOrThrow({
        where: { correlationId: request.correlationId, eventType: "project.created" },
      }),
    ).resolves.toMatchObject({
      actorId: fixture.managerId,
      scopeId: created.id,
      reason: "Approved department project",
    });
  });

  it("returns only current people and already-authorized child workstreams", async () => {
    const projectService = createProjectService(client, databaseAuditWriter as never, () => now);
    const workstreamService = createWorkstreamService(
      client,
      databaseAuditWriter as never,
      () => now,
    );
    const project = await projectService.createProject(command());
    const first = await workstreamService.createWorkstream({
      actor: { userId: fixture.managerId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: project.id,
      input: {
        name: "Visible stream",
        description: "Scoped",
        primaryOwnerId: fixture.ownerId,
        startsAt: "2026-07-17T06:00:00Z",
        reason: "Approved",
      },
    });
    const second = await workstreamService.createWorkstream({
      actor: { userId: fixture.managerId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: project.id,
      input: {
        name: "Other stream",
        description: "Scoped",
        primaryOwnerId: fixture.ownerId,
        startsAt: "2026-07-17T06:00:00Z",
        reason: "Approved",
      },
    });
    await workstreamService.addContributor({
      actor: { userId: fixture.managerId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: project.id,
      workstreamId: first.id,
      input: {
        userId: fixture.memberId,
        startsAt: "2026-07-17T07:00:00Z",
        reason: "Current contribution",
      },
    });
    await client.responsibilityWindow.createMany({
      data: [
        {
          employeeId: fixture.memberId,
          projectId: project.id,
          responsibilityType: "contributor",
          startsAt: new Date("2026-07-16T06:00:00Z"),
          endsAt: new Date("2026-07-17T11:00:00Z"),
          reason: "Former project contribution",
          createdById: fixture.managerId,
        },
        {
          employeeId: fixture.memberId,
          projectId: project.id,
          responsibilityType: "contributor",
          startsAt: new Date("2026-07-19T06:00:00Z"),
          reason: "Future project contribution",
          createdById: fixture.managerId,
        },
      ],
    });

    const ownerView = await projectService.getWorkspace({
      actor: { userId: fixture.ownerId, active: true },
      projectId: project.id,
    });
    expect(
      ownerView.people.map(({ person, responsibilityType }) => [
        person.displayName,
        responsibilityType,
      ]),
    ).toEqual([["Owner", "original"]]);
    expect(ownerView.workstreams.map(({ id }) => id)).toEqual([first.id, second.id]);

    const contributorView = await projectService.getWorkspace({
      actor: { userId: fixture.memberId, active: true },
      projectId: project.id,
    });
    expect(contributorView.workstreams.map(({ id }) => id)).toEqual([first.id]);
  });

  it("returns a Projects-owned safe ownership projection and fails closed after access ends", async () => {
    const service = createProjectService(client, databaseAuditWriter as never, () => now);
    const project = await service.createProject(command());
    await service.addProjectMember({
      actor: { userId: fixture.managerId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: project.id,
      input: {
        userId: fixture.memberId,
        startsAt: "2026-07-17T07:00:00Z",
        reason: "Approved contribution",
      },
    });

    const contributorProjection = await (service as any).getOwnershipProjection({
      actor: { userId: fixture.memberId, active: true },
      projectId: project.id,
    });
    expect(contributorProjection).toMatchObject({
      access: "current",
      viewerRole: "contributor",
      transfer: { allowed: false, candidates: [] },
    });
    const responsibilities = createResponsibilityService(
      client,
      databaseAuditWriter as never,
      () => now,
    );
    await expect(
      responsibilities.transferProjectOwner({
        actor: { userId: fixture.memberId, active: true },
        correlationId: crypto.randomUUID(),
        projectId: project.id,
        input: {
          transferKind: "permanent",
          toUserId: fixture.ownerId,
          effectiveAt: "2026-07-17T12:01:00Z",
          expectedVersion: 1,
          reason: "Contributor cannot transfer ownership",
        },
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_ROLE_REQUIRED" });

    const ownerProjection = await (service as any).getOwnershipProjection({
      actor: { userId: fixture.ownerId, active: true },
      projectId: project.id,
    });
    expect(ownerProjection).toMatchObject({
      access: "current",
      viewerRole: "owner",
      transfer: { allowed: false, candidates: [] },
    });

    const managerProjection = await (service as any).getOwnershipProjection({
      actor: { userId: fixture.managerId, active: true },
      projectId: project.id,
    });
    expect(managerProjection).toMatchObject({
      access: "current",
      viewerRole: "manager",
      transfer: {
        allowed: true,
        candidates: expect.arrayContaining([expect.objectContaining({ id: fixture.memberId })]),
      },
    });
    await expect(
      (service as any).getOwnershipProjection({
        actor: { userId: fixture.otherManagerId, active: true },
        projectId: project.id,
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_SCOPE_MISMATCH" });

    await service.endProjectMember({
      actor: { userId: fixture.managerId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: project.id,
      userId: fixture.memberId,
      input: {
        endsAt: "2026-07-17T11:00:00Z",
        expectedVersion: 1,
        reason: "Contribution complete",
      },
    });
    await expect(
      (service as any).getOwnershipProjection({
        actor: { userId: fixture.memberId, active: true },
        projectId: project.id,
      }),
    ).resolves.toEqual({ access: "ended" });
  });

  it("composes acting ownership projection with the protected transfer boundary until expiry", async () => {
    const service = createProjectService(client, databaseAuditWriter as never, () => now);
    const project = await service.createProject(command());
    await service.addProjectMember({
      actor: { userId: fixture.managerId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: project.id,
      input: {
        userId: fixture.memberId,
        startsAt: "2026-07-17T07:00:00Z",
        reason: "Approved temporary coverage",
      },
    });
    await service.endProjectMember({
      actor: { userId: fixture.managerId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: project.id,
      userId: fixture.memberId,
      input: {
        endsAt: "2026-07-17T11:00:00Z",
        expectedVersion: 1,
        reason: "Contributor record superseded by acting coverage",
      },
    });
    const managerResponsibilities = createResponsibilityService(
      client,
      databaseAuditWriter as never,
      () => now,
    );
    await managerResponsibilities.transferProjectOwner({
      actor: { userId: fixture.managerId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: project.id,
      input: {
        transferKind: "acting",
        toUserId: fixture.memberId,
        effectiveAt: "2026-07-17T12:01:00Z",
        endsAt: "2026-07-18T12:00:00Z",
        delegationType: "approved_leave",
        expectedVersion: 2,
        reason: "Approved leave coverage",
      },
    });

    const activeNow = new Date("2026-07-17T13:00:00Z");
    const activeService = createProjectService(
      client,
      databaseAuditWriter as never,
      () => activeNow,
    );
    await expect(
      (activeService as any).getOwnershipProjection({
        actor: { userId: fixture.memberId, active: true },
        projectId: project.id,
      }),
    ).resolves.toMatchObject({
      access: "current",
      viewerRole: "acting_owner",
      plannedReturnOwnerName: "Owner",
      transfer: { allowed: false, candidates: [] },
    });
    const activeResponsibilities = createResponsibilityService(
      client,
      databaseAuditWriter as never,
      () => activeNow,
    );
    await expect(
      activeResponsibilities.transferProjectOwner({
        actor: { userId: fixture.memberId, active: true },
        correlationId: crypto.randomUUID(),
        projectId: project.id,
        input: {
          transferKind: "permanent",
          toUserId: fixture.ownerId,
          effectiveAt: "2026-07-17T13:01:00Z",
          expectedVersion: 3,
          reason: "Acting owner cannot transfer ownership",
        },
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_ROLE_REQUIRED" });

    const expiredNow = new Date("2026-07-18T13:00:00Z");
    const expiredService = createProjectService(
      client,
      databaseAuditWriter as never,
      () => expiredNow,
    );
    await expect(
      (expiredService as any).getOwnershipProjection({
        actor: { userId: fixture.memberId, active: true },
        projectId: project.id,
      }),
    ).resolves.toEqual({ access: "ended" });
    const expiredResponsibilities = createResponsibilityService(
      client,
      databaseAuditWriter as never,
      () => expiredNow,
    );
    await expect(
      expiredResponsibilities.transferProjectOwner({
        actor: { userId: fixture.memberId, active: true },
        correlationId: crypto.randomUUID(),
        projectId: project.id,
        input: {
          transferKind: "permanent",
          toUserId: fixture.ownerId,
          effectiveAt: "2026-07-18T13:01:00Z",
          expectedVersion: 3,
          reason: "Former acting owner cannot transfer ownership",
        },
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_ROLE_REQUIRED" });
  });

  it("denies cross-department managers and system administrators", async () => {
    const service = createProjectService(client, databaseAuditWriter as never, () => now);
    await expect(service.createProject(command(fixture.otherManagerId))).rejects.toMatchObject({
      code: "AUTHZ_SCOPE_MISMATCH",
    });
    await expect(service.createProject(command(fixture.administratorId))).rejects.toMatchObject({
      code: "AUTHZ_ROLE_REQUIRED",
    });
  });

  it("rejects unknown owners and future creation starts", async () => {
    const service = createProjectService(client, databaseAuditWriter as never, () => now);
    await expect(
      service.createProject(command(fixture.managerId, crypto.randomUUID())),
    ).rejects.toMatchObject({
      code: "PROJECT_OWNER_INVALID",
    });
    const future = command();
    await expect(
      service.createProject({
        ...future,
        input: { ...future.input, startsAt: "2026-07-18T00:00:00Z" },
      }),
    ).rejects.toMatchObject({ code: "PROJECT_STARTS_AT_INVALID" });
  });

  it("rolls back every project record when audit persistence fails", async () => {
    const failure = new Error("forced audit failure");
    const service = createProjectService(
      client,
      { append: async () => Promise.reject(failure) },
      () => now,
    );
    const request = command();
    const beforeCount = await client.project.count({
      where: { name: request.input.name, createdById: request.actor.userId },
    });

    await expect(service.createProject(request)).rejects.toBe(failure);
    await expect(
      client.project.count({
        where: { name: request.input.name, createdById: request.actor.userId },
      }),
    ).resolves.toBe(beforeCount);
  });

  it("adds and ends a project member while preserving the historical rows", async () => {
    const service = createProjectService(client, databaseAuditWriter as never, () => now);
    const project = await service.createProject(command());
    await expect(
      service.addProjectMember({
        actor: { userId: fixture.managerId, active: true },
        correlationId: crypto.randomUUID(),
        projectId: project.id,
        input: {
          userId: fixture.memberId,
          startsAt: "2026-07-17T07:00:00Z",
          reason: "Approved project contribution",
        },
      }),
    ).resolves.toMatchObject({ employeeId: fixture.memberId, endsAt: null });

    const ended = await service.endProjectMember({
      actor: { userId: fixture.managerId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: project.id,
      userId: fixture.memberId,
      input: {
        endsAt: "2026-07-17T10:00:00Z",
        reason: "Contribution completed",
        expectedVersion: project.version,
      },
    });
    expect(ended).toMatchObject({ employeeId: fixture.memberId });
    expect(ended.endsAt).toBe("2026-07-17T10:00:00.000Z");
    await expect(
      client.responsibilityWindow.findFirstOrThrow({
        where: {
          projectId: project.id,
          employeeId: fixture.memberId,
          responsibilityType: "contributor",
        },
      }),
    ).resolves.toMatchObject({ endsAt: new Date("2026-07-17T10:00:00Z") });
  });

  it("rejects duplicate membership and ending the current owner", async () => {
    const service = createProjectService(client, databaseAuditWriter as never, () => now);
    const project = await service.createProject(command());
    const add = {
      actor: { userId: fixture.managerId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: project.id,
      input: {
        userId: fixture.memberId,
        startsAt: "2026-07-17T07:00:00Z",
        reason: "Approved project contribution",
      },
    } as const;
    await service.addProjectMember(add);
    await expect(
      service.addProjectMember({ ...add, correlationId: crypto.randomUUID() }),
    ).rejects.toMatchObject({
      code: "PROJECT_MEMBER_ACTIVE",
    });
    await expect(
      service.endProjectMember({
        actor: add.actor,
        correlationId: crypto.randomUUID(),
        projectId: project.id,
        userId: fixture.ownerId,
        input: {
          endsAt: "2026-07-17T10:00:00Z",
          reason: "Invalid owner end",
          expectedVersion: project.version,
        },
      }),
    ).rejects.toMatchObject({ code: "PROJECT_OWNER_MEMBERSHIP_PROTECTED" });
  });

  it("records transaction-time status transitions and exposes no current owner after completion", async () => {
    const service = createProjectService(client, databaseAuditWriter as never, () => now);
    const project = await service.createProject(command());
    const completed = await service.transitionProject({
      actor: { userId: fixture.managerId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: project.id,
      input: {
        status: "completed",
        reason: "Approved project completion",
        expectedVersion: project.version,
      },
    });

    expect(completed).toMatchObject({
      status: "completed",
      version: 2,
      primaryOwnerId: null,
    });
    await expect(
      client.projectStatusTransition.findUniqueOrThrow({
        where: { projectId_resultingVersion: { projectId: project.id, resultingVersion: 2 } },
      }),
    ).resolves.toMatchObject({
      fromStatus: "active",
      toStatus: "completed",
      effectiveAt: now,
      reason: "Approved project completion",
    });

    await expect(
      service.addProjectMember({
        actor: { userId: fixture.managerId, active: true },
        correlationId: crypto.randomUUID(),
        projectId: project.id,
        input: {
          userId: fixture.memberId,
          startsAt: "2026-07-17T11:00:00Z",
          reason: "Invalid terminal project contribution",
        },
      }),
    ).rejects.toMatchObject({ code: "PROJECT_STATE_INVALID" });
    await expect(
      client.projectMember.count({
        where: { projectId: project.id, employeeId: fixture.memberId, endsAt: null },
      }),
    ).resolves.toBe(0);
  });

  it("filters list reads in persistence and permits only active assigned readers", async () => {
    const service = createProjectService(client, databaseAuditWriter as never, () => now);
    const project = await service.createProject(command());
    const otherProject = await service.createProject(
      command(fixture.otherManagerId, fixture.otherManagerId, fixture.otherDepartmentId),
    );

    await expect(
      service.listProjects({ actor: { userId: fixture.managerId, active: true } }),
    ).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ id: project.id })]));
    const managerList = await service.listProjects({
      actor: { userId: fixture.managerId, active: true },
    });
    expect(managerList.some(({ id }) => id === otherProject.id)).toBe(false);
    await expect(
      service.getProject({
        actor: { userId: fixture.ownerId, active: true },
        projectId: project.id,
      }),
    ).resolves.toMatchObject({ id: project.id, primaryOwnerId: fixture.ownerId });
    await expect(
      service.getProject({
        actor: { userId: fixture.memberId, active: true },
        projectId: project.id,
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_SCOPE_MISMATCH" });

    await service.addProjectMember({
      actor: { userId: fixture.managerId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: project.id,
      input: {
        userId: fixture.memberId,
        startsAt: "2026-07-17T07:00:00Z",
        reason: "Approved project contribution",
      },
    });
    await expect(
      service.getProject({
        actor: { userId: fixture.memberId, active: true },
        projectId: project.id,
      }),
    ).resolves.toMatchObject({ id: project.id });
  });

  it("authorizes only a current member from the caller's Serializable transaction", async () => {
    const service = createProjectService(client, databaseAuditWriter as never, () => now);
    const project = await service.createProject(command());
    await service.addProjectMember({
      actor: { userId: fixture.managerId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: project.id,
      input: {
        userId: fixture.memberId,
        startsAt: "2026-07-17T07:00:00Z",
        reason: "Approved project contribution",
      },
    });
    const authorize = () =>
      client.$transaction(
        (transaction) =>
          service.authorizeCurrentMemberInTransaction(transaction, {
            actor: { userId: fixture.memberId, active: true },
            projectId: project.id,
            at: now,
          }),
        { isolationLevel: "Serializable" },
      );

    await expect(authorize()).resolves.toMatchObject({
      id: project.id,
      departmentId: fixture.departmentId,
      status: "active",
    });
    await client.projectMember.updateMany({
      where: { projectId: project.id, employeeId: fixture.memberId, endsAt: null },
      data: { endsAt: now },
    });
    await expect(authorize()).rejects.toMatchObject({ code: "AUTHZ_SCOPE_MISMATCH" });
  });

  it("allows exactly one of two concurrent member-end commands", async () => {
    const service = createProjectService(client, databaseAuditWriter as never, () => now);
    const project = await service.createProject(command());
    await service.addProjectMember({
      actor: { userId: fixture.managerId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: project.id,
      input: {
        userId: fixture.memberId,
        startsAt: "2026-07-17T07:00:00Z",
        reason: "Approved project contribution",
      },
    });
    const endCommand = () => ({
      actor: { userId: fixture.managerId, active: true },
      correlationId: crypto.randomUUID(),
      projectId: project.id,
      userId: fixture.memberId,
      input: {
        endsAt: "2026-07-17T10:00:00Z",
        reason: "Contribution completed",
        expectedVersion: project.version,
      },
    });

    const results = await Promise.allSettled([
      service.endProjectMember(endCommand()),
      service.endProjectMember(endCommand()),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual(["fulfilled", "rejected"]);
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(rejected?.reason).toMatchObject({
      code: expect.stringMatching(/^(?:VERSION_CONFLICT|PROJECT_MEMBER_NOT_ACTIVE)$/u),
    });
    await expect(
      client.projectMember.count({
        where: { projectId: project.id, employeeId: fixture.memberId, endsAt: { not: null } },
      }),
    ).resolves.toBe(1);
  });

  it("rolls back status, version, and responsibility closure when status audit fails", async () => {
    const project = await createProjectService(
      client,
      databaseAuditWriter as never,
      () => now,
    ).createProject(command());
    const failure = new Error("forced status audit failure");
    const service = createProjectService(
      client,
      { append: async () => Promise.reject(failure) },
      () => now,
    );

    await expect(
      service.transitionProject({
        actor: { userId: fixture.managerId, active: true },
        correlationId: crypto.randomUUID(),
        projectId: project.id,
        input: {
          status: "completed",
          reason: "Approved project completion",
          expectedVersion: project.version,
        },
      }),
    ).rejects.toBe(failure);
    await expect(
      client.project.findUniqueOrThrow({ where: { id: project.id } }),
    ).resolves.toMatchObject({ status: "active", version: 1 });
    await expect(
      client.responsibilityWindow.findFirstOrThrow({
        where: { projectId: project.id, responsibilityType: "original" },
      }),
    ).resolves.toMatchObject({ endsAt: null });
    await expect(
      client.projectStatusTransition.count({ where: { projectId: project.id } }),
    ).resolves.toBe(0);
  });
});
