import { afterAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@evaluation/database";

import { WorkItemService } from "./service.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const now = new Date("2026-07-18T12:00:00Z");

const auditWriter: import("@evaluation/contracts").AuditWriter<
  import("@evaluation/database").DatabaseTransaction
> = {
  append: async () => ({ id: crypto.randomUUID(), createdAt: now.toISOString() }),
};

type Graph = Readonly<{
  actorId: string;
  assigneeId: string;
  projectId: string;
  workstreamId: string;
  otherProjectId: string;
  otherWorkstreamId: string;
}>;

async function seedGraph(): Promise<Graph> {
  const suffix = crypto.randomUUID();
  const organizationId = crypto.randomUUID();
  const departmentId = crypto.randomUUID();
  const actorId = crypto.randomUUID();
  const assigneeId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const workstreamId = crypto.randomUUID();
  const otherProjectId = crypto.randomUUID();
  const otherWorkstreamId = crypto.randomUUID();

  await client.organization.create({
    data: { id: organizationId, key: `wi-org-${suffix}`, name: "Work Items" },
  });
  await client.department.create({
    data: {
      id: departmentId,
      key: `wi-dept-${suffix}`,
      name: "Work Items",
      organizationId,
    },
  });
  await client.user.createMany({
    data: [
      { id: actorId, email: `actor-${suffix}@example.invalid`, displayName: "Actor" },
      { id: assigneeId, email: `assignee-${suffix}@example.invalid`, displayName: "Assignee" },
    ],
  });
  await client.authorizationScope.createMany({
    data: [
      {
        id: departmentId,
        key: `wi-department-${suffix}`,
        scopeType: "department",
        departmentId,
      },
      { id: projectId, key: `wi-project-${suffix}`, scopeType: "project", departmentId },
      {
        id: workstreamId,
        key: `wi-workstream-${suffix}`,
        scopeType: "workstream",
        departmentId,
      },
      {
        id: otherProjectId,
        key: `wi-other-project-${suffix}`,
        scopeType: "project",
        departmentId,
      },
      {
        id: otherWorkstreamId,
        key: `wi-other-workstream-${suffix}`,
        scopeType: "workstream",
        departmentId,
      },
    ],
  });
  for (const id of [actorId, assigneeId]) {
    await client.roleAssignment.create({
      data: { userId: id, role: "employee", scopeType: "department", scopeId: departmentId },
    });
  }
  await client.project.createMany({
    data: [
      {
        id: projectId,
        organizationId,
        departmentId,
        authorizationScopeId: projectId,
        name: "Primary",
        description: "",
        status: "active",
        createdById: actorId,
      },
      {
        id: otherProjectId,
        organizationId,
        departmentId,
        authorizationScopeId: otherProjectId,
        name: "Other",
        description: "",
        status: "active",
        createdById: actorId,
      },
    ],
  });
  await client.workstream.createMany({
    data: [
      {
        id: workstreamId,
        projectId,
        authorizationScopeId: workstreamId,
        name: "Primary Stream",
        description: "",
        status: "active",
        createdById: actorId,
      },
      {
        id: otherWorkstreamId,
        projectId: otherProjectId,
        authorizationScopeId: otherWorkstreamId,
        name: "Other Stream",
        description: "",
        status: "active",
        createdById: actorId,
      },
    ],
  });
  await client.projectMember.createMany({
    data: [actorId, assigneeId].map((employeeId) => ({
      projectId,
      employeeId,
      startsAt: new Date("2026-07-01T00:00:00Z"),
      reason: "Active contributor",
      createdById: actorId,
    })),
  });
  await client.workstreamMember.createMany({
    data: [actorId, assigneeId].map((employeeId) => ({
      workstreamId,
      employeeId,
      startsAt: new Date("2026-07-01T00:00:00Z"),
      reason: "Active contributor",
      createdById: actorId,
    })),
  });
  return { actorId, assigneeId, projectId, workstreamId, otherProjectId, otherWorkstreamId };
}

afterAll(async () => client.$disconnect());

describe("WorkItemService", () => {
  it("creates and transitions with append-only history and no automatic progress", async () => {
    const graph = await seedGraph();
    const service = new WorkItemService(client, auditWriter, () => now);
    const created = await service.create({
      actor: { userId: graph.actorId, active: true },
      correlationId: crypto.randomUUID(),
      input: {
        title: "Review evidence",
        description: "",
        projectId: graph.projectId,
        workstreamId: graph.workstreamId,
        assigneeId: graph.assigneeId,
        dueAt: null,
        priority: "high",
        requirements: [],
        acceptanceConditions: ["Owner confirms"],
        blocker: null,
        nextAction: "Start review",
      },
    });
    expect(created).toMatchObject({ status: "planned", version: 1 });

    let current = created;
    for (const status of ["ready", "in_progress", "in_review", "done"] as const) {
      current = await service.transition({
        actor: { userId: graph.actorId, active: true },
        correlationId: crypto.randomUUID(),
        workItemId: created.id,
        input: { status, expectedVersion: current.version, reason: `Move to ${status}` },
      });
    }
    expect(current).toMatchObject({ status: "done", version: 5 });
    await expect(
      client.workItemStatusHistory.count({ where: { workItemId: created.id } }),
    ).resolves.toBe(4);
    await expect(
      client.progressSnapshot.count({
        where: { contract: { projectId: graph.projectId } },
      }),
    ).resolves.toBe(0);
  });

  it("rejects a cross-Project Workstream and stale assignment", async () => {
    const graph = await seedGraph();
    const service = new WorkItemService(client, auditWriter, () => now);
    await expect(
      service.create({
        actor: { userId: graph.actorId, active: true },
        correlationId: crypto.randomUUID(),
        input: {
          title: "Invalid scope",
          description: "",
          projectId: graph.projectId,
          workstreamId: graph.otherWorkstreamId,
          assigneeId: graph.actorId,
          dueAt: null,
          priority: "normal",
          requirements: [],
          acceptanceConditions: [],
          blocker: null,
          nextAction: null,
        },
      }),
    ).rejects.toMatchObject({ code: "WORK_ITEM_SCOPE_MISMATCH" });

    const item = await service.create({
      actor: { userId: graph.actorId, active: true },
      correlationId: crypto.randomUUID(),
      input: {
        title: "Assign",
        description: "",
        projectId: graph.projectId,
        workstreamId: null,
        assigneeId: graph.actorId,
        dueAt: null,
        priority: "normal",
        requirements: [],
        acceptanceConditions: [],
        blocker: null,
        nextAction: null,
      },
    });
    await expect(
      service.assign({
        actor: { userId: graph.actorId, active: true },
        correlationId: crypto.randomUUID(),
        workItemId: item.id,
        input: {
          assigneeId: graph.assigneeId,
          expectedVersion: 99,
          reason: "Stale client",
        },
      }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  });

  it("updates editable Task fields, checklist, assignee, and collaborators atomically", async () => {
    const graph = await seedGraph();
    const events: Array<Record<string, unknown>> = [];
    const recordingAuditWriter = {
      append: async (
        _transaction: import("@evaluation/database").DatabaseTransaction,
        event: Record<string, unknown>,
      ) => {
        events.push(event);
        return { id: crypto.randomUUID(), createdAt: now.toISOString() };
      },
    };
    const service = new WorkItemService(client, recordingAuditWriter as never, () => now);
    const created = await service.create({
      actor: { userId: graph.actorId, active: true },
      correlationId: crypto.randomUUID(),
      input: {
        title: "Initial title",
        description: "",
        projectId: graph.projectId,
        workstreamId: null,
        assigneeId: graph.actorId,
        dueAt: null,
        priority: "normal",
        requirements: [],
        acceptanceConditions: [],
        blocker: null,
        nextAction: null,
      },
    });

    const updated = await service.update({
      actor: { userId: graph.actorId, active: true },
      correlationId: crypto.randomUUID(),
      workItemId: created.id,
      input: {
        title: "Prepare launch evidence",
        description: "Collect the approved launch artifacts.",
        workstreamId: graph.workstreamId,
        assigneeId: graph.assigneeId,
        dueAt: "2026-07-23T09:00:00.000Z",
        priority: "high",
        checklist: [
          { text: "Confirm acceptance conditions", completed: true },
          { text: "Attach approved evidence", completed: false },
        ],
        collaboratorIds: [graph.actorId],
        expectedVersion: 1,
        reason: "Employee edited the task",
      },
    });

    expect(updated).toMatchObject({
      title: "Prepare launch evidence",
      workstreamId: graph.workstreamId,
      assigneeId: graph.assigneeId,
      priority: "high",
      version: 2,
      collaboratorIds: [graph.actorId],
      checklist: [
        { text: "Confirm acceptance conditions", completed: true, position: 0 },
        { text: "Attach approved evidence", completed: false, position: 1 },
      ],
    });
    await expect(
      client.workItemAssignmentHistory.count({ where: { workItemId: created.id } }),
    ).resolves.toBe(2);
    await expect(
      client.workItemParticipant.count({
        where: { workItemId: created.id, employeeId: graph.actorId, endsAt: null },
      }),
    ).resolves.toBe(1);
    expect(events.at(-1)).toMatchObject({
      eventType: "work_item.changed",
      reason: "Employee edited the task",
    });

    await client.workstream.update({
      where: { id: graph.workstreamId },
      data: { status: "completed" },
    });
    await expect(
      service.update({
        actor: { userId: graph.actorId, active: true },
        correlationId: crypto.randomUUID(),
        workItemId: created.id,
        input: {
          workstreamId: null,
          expectedVersion: 2,
          reason: "Move the Task back to its Project",
        },
      }),
    ).resolves.toMatchObject({ workstreamId: null, version: 3 });

    await expect(
      service.update({
        actor: { userId: graph.actorId, active: true },
        correlationId: crypto.randomUUID(),
        workItemId: created.id,
        input: {
          workstreamId: graph.otherWorkstreamId,
          expectedVersion: 3,
          reason: "Invalid cross-project edit",
        },
      }),
    ).rejects.toMatchObject({ code: "WORK_ITEM_SCOPE_MISMATCH" });
    await expect(
      service.update({
        actor: { userId: graph.actorId, active: true },
        correlationId: crypto.randomUUID(),
        workItemId: created.id,
        input: {
          title: "Stale edit",
          expectedVersion: 1,
          reason: "Stale browser",
        },
      }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  });
});
