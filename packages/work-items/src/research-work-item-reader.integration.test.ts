import { createDatabaseClient } from "@evaluation/database";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  ConfirmedTaskCreatorAdapter,
  ResearchWorkItemReader,
} from "./research-work-item-reader.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const at = new Date("2026-08-05T09:00:00.000Z");
const actorId = crypto.randomUUID();
const outsiderId = crypto.randomUUID();
const workstreamOnlyId = crypto.randomUUID();
const projectId = crypto.randomUUID();
const otherProjectId = crypto.randomUUID();
const workstreamId = crypto.randomUUID();
const itemId = crypto.randomUUID();
const terminalItemId = crypto.randomUUID();
const otherItemId = crypto.randomUUID();

beforeAll(async () => {
  const suffix = crypto.randomUUID();
  const organization = await client.organization.create({
    data: { key: `research-work-items-${suffix}`, name: "Research Work Items" },
  });
  const department = await client.department.create({
    data: {
      key: `research-work-items-${suffix}`,
      name: "Research Work Items",
      organizationId: organization.id,
    },
  });
  await client.user.createMany({
    data: [
      {
        id: actorId,
        email: `research-work-items-actor-${suffix}@example.invalid`,
        displayName: "Actor",
      },
      {
        id: outsiderId,
        email: `research-work-items-outsider-${suffix}@example.invalid`,
        displayName: "Outsider",
      },
      {
        id: workstreamOnlyId,
        email: `research-work-items-workstream-only-${suffix}@example.invalid`,
        displayName: "Workstream-only contributor",
      },
    ],
  });
  await client.authorizationScope.createMany({
    data: [
      {
        id: department.id,
        key: `research-work-items-department-${suffix}`,
        scopeType: "department",
        departmentId: department.id,
      },
      {
        id: projectId,
        key: `research-work-items-project-${suffix}`,
        scopeType: "project",
        departmentId: department.id,
      },
      {
        id: otherProjectId,
        key: `research-work-items-other-project-${suffix}`,
        scopeType: "project",
        departmentId: department.id,
      },
      {
        id: workstreamId,
        key: `research-work-items-workstream-${suffix}`,
        scopeType: "workstream",
        departmentId: department.id,
      },
    ],
  });
  await client.project.createMany({
    data: [
      {
        id: projectId,
        organizationId: organization.id,
        departmentId: department.id,
        authorizationScopeId: projectId,
        name: "Research Project",
        description: "Authorized",
        status: "active",
        createdById: actorId,
      },
      {
        id: otherProjectId,
        organizationId: organization.id,
        departmentId: department.id,
        authorizationScopeId: otherProjectId,
        name: "Other Project",
        description: "Not authorized",
        status: "active",
        createdById: actorId,
      },
    ],
  });
  await client.workstream.create({
    data: {
      id: workstreamId,
      projectId,
      authorizationScopeId: workstreamId,
      name: "Research Workstream",
      description: "Authorized",
      status: "active",
      createdById: actorId,
    },
  });
  await client.projectMember.create({
    data: {
      projectId,
      employeeId: actorId,
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      reason: "Current member",
      createdById: actorId,
    },
  });
  await client.workstreamMember.create({
    data: {
      workstreamId,
      employeeId: workstreamOnlyId,
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
      reason: "Current Workstream member",
      createdById: actorId,
    },
  });
  await client.workItem.createMany({
    data: [
      {
        id: itemId,
        projectId,
        workstreamId,
        title: "Evaluate retrieval boundary",
        description: "Use only safe citations.",
        status: "in_progress",
        priority: "high",
        assigneeId: actorId,
        requirements: ["No network access"],
        acceptanceConditions: ["Citations are opaque"],
        createdById: actorId,
      },
      {
        id: terminalItemId,
        projectId,
        title: "Completed discovery",
        description: "Retained current context.",
        status: "done",
        assigneeId: actorId,
        requirements: [],
        acceptanceConditions: [],
        createdById: actorId,
      },
      {
        id: otherItemId,
        projectId: otherProjectId,
        title: "Other Project item",
        description: "Must not leak.",
        assigneeId: actorId,
        requirements: [],
        acceptanceConditions: [],
        createdById: actorId,
      },
    ],
  });
});

afterAll(async () => client.$disconnect());

describe("ResearchWorkItemReader", () => {
  const reader = new ResearchWorkItemReader(client);

  it("lists only non-cancelled items in the authorized Project using safe fields", async () => {
    const items = await reader.listAuthorizedProjectItems({
      actor: { userId: actorId, active: true },
      projectId,
      at,
    });

    expect(items.map(({ id }) => id)).toEqual([terminalItemId, itemId].sort());
    expect(items).toContainEqual(
      expect.objectContaining({
        id: itemId,
        projectId,
        workstreamId,
        title: "Evaluate retrieval boundary",
        version: 1,
        sourceReference: `work-item:${itemId}`,
      }),
    );
    expect(JSON.stringify(items)).not.toMatch(/rating|readinessPercent|privateNarrative/iu);
  });

  it("denies an unrelated or inactive actor and a cross-Project item", async () => {
    await expect(
      reader.listAuthorizedProjectItems({
        actor: { userId: outsiderId, active: true },
        projectId,
        at,
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_SCOPE_FORBIDDEN" });
    await expect(
      reader.listAuthorizedProjectItems({
        actor: { userId: actorId, active: false },
        projectId,
        at,
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_SCOPE_FORBIDDEN" });
    await expect(
      reader.authorizeProjectItem({
        actor: { userId: actorId, active: true },
        projectId,
        workItemId: otherItemId,
        at,
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_SCOPE_FORBIDDEN" });
  });

  it("limits a Workstream-only contributor to items in their current Workstream", async () => {
    await expect(
      reader.listAuthorizedProjectItems({
        actor: { userId: workstreamOnlyId, active: true },
        projectId,
        at,
      }),
    ).resolves.toEqual([expect.objectContaining({ id: itemId, workstreamId })]);
    await expect(
      reader.authorizeProjectItem({
        actor: { userId: workstreamOnlyId, active: true },
        projectId,
        workItemId: terminalItemId,
        at,
      }),
    ).rejects.toMatchObject({ code: "RESEARCH_SCOPE_FORBIDDEN" });
  });
});

describe("ConfirmedTaskCreatorAdapter", () => {
  it("keeps the caller transaction and delegates confirmation to the existing Work Item command", async () => {
    const transaction = { marker: "caller-owned" } as never;
    const command = {
      createConfirmedTask: vi.fn(async () => ({
        id: itemId,
        projectId,
        workstreamId,
        title: "Confirmed Research task",
        description: "Human-confirmed task proposal",
        status: "planned" as const,
        priority: "normal" as const,
        assigneeId: actorId,
        dueAt: null,
        requirements: ["Retain citations"],
        acceptanceConditions: ["Employee confirms"],
        blocker: null,
        nextAction: null,
        version: 1,
        createdAt: at.toISOString(),
        updatedAt: at.toISOString(),
        checklist: [],
        collaboratorIds: [],
        allowedActions: ["edit" as const],
      })),
    };
    const adapter = new ConfirmedTaskCreatorAdapter(command);
    const input = {
      projectId,
      workstreamId,
      title: "Confirmed Research task",
      description: "Human-confirmed task proposal",
      assigneeId: actorId,
      dueAt: null,
      priority: "normal" as const,
      requirements: ["Retain citations"],
      acceptanceConditions: ["Employee confirms"],
      blocker: null,
      nextAction: null,
    };

    await expect(
      adapter.createConfirmedTask(transaction, {
        actor: { userId: actorId, active: true },
        correlationId: crypto.randomUUID(),
        workItemId: itemId,
        input,
        reason: "Employee confirmed the Research proposal",
      }),
    ).resolves.toMatchObject({
      id: itemId,
      projectId,
      version: 1,
      sourceReference: `work-item:${itemId}`,
    });
    expect(command.createConfirmedTask).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        workItemId: itemId,
        input,
        reason: "Employee confirmed the Research proposal",
      }),
    );
  });
});
