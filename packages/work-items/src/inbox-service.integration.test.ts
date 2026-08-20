import { afterAll, describe, expect, it, vi } from "vitest";

import { createDatabaseClient } from "@evaluation/database";

import { PrivateInboxQueryService } from "./inbox-query-service.js";
import { PrivateInboxService } from "./inbox-service.js";
import { DatabasePrivateInboxExperiencePublisher } from "./private-inbox-experience.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const now = new Date("2026-07-20T08:00:00.000Z");

const auditWriter: import("@evaluation/contracts").AuditWriter<
  import("@evaluation/database").DatabaseTransaction
> = {
  append: async () => ({ id: crypto.randomUUID(), createdAt: now.toISOString() }),
};
const privateUploads = { assertOwned: async () => undefined };

async function seedInboxGraph() {
  const suffix = crypto.randomUUID();
  const organizationId = crypto.randomUUID();
  const departmentId = crypto.randomUUID();
  const employeeAId = crypto.randomUUID();
  const employeeBId = crypto.randomUUID();
  const managerId = crypto.randomUUID();
  const projectId = crypto.randomUUID();

  await client.organization.create({
    data: { id: organizationId, key: `inbox-org-${suffix}`, name: "Inbox" },
  });
  await client.department.create({
    data: {
      id: departmentId,
      key: `inbox-dept-${suffix}`,
      name: "Inbox",
      organizationId,
    },
  });
  await client.user.createMany({
    data: [
      { id: employeeAId, email: `inbox-a-${suffix}@example.invalid`, displayName: "Employee A" },
      { id: employeeBId, email: `inbox-b-${suffix}@example.invalid`, displayName: "Employee B" },
      { id: managerId, email: `inbox-manager-${suffix}@example.invalid`, displayName: "Manager" },
    ],
  });
  await client.authorizationScope.createMany({
    data: [
      {
        id: departmentId,
        key: `inbox-department-${suffix}`,
        scopeType: "department",
        departmentId,
      },
      { id: projectId, key: `inbox-project-${suffix}`, scopeType: "project", departmentId },
    ],
  });
  await client.project.create({
    data: {
      id: projectId,
      organizationId,
      departmentId,
      authorizationScopeId: projectId,
      name: "Daily workspace",
      description: "",
      status: "active",
      createdById: employeeAId,
    },
  });
  for (const userId of [employeeAId, employeeBId]) {
    await client.roleAssignment.create({
      data: { userId, role: "employee", scopeType: "department", scopeId: departmentId },
    });
    await client.projectMember.create({
      data: {
        projectId,
        employeeId: userId,
        startsAt: new Date("2026-07-01T00:00:00.000Z"),
        reason: "Active contributor",
        createdById: employeeAId,
      },
    });
  }
  await client.roleAssignment.create({
    data: { userId: managerId, role: "manager", scopeType: "department", scopeId: departmentId },
  });
  return { employeeAId, employeeBId, managerId, projectId };
}

afterAll(async () => client.$disconnect());

describe("Private Inbox ownership and promotion", () => {
  it("commits a capture receipt atomically and returns the capture when queue wake-up fails", async () => {
    const graph = await seedInboxGraph();
    const wake = vi.fn(async () => {
      throw new Error("queue unavailable");
    });
    const experience = new DatabasePrivateInboxExperiencePublisher({ enqueue: wake });
    const service = new PrivateInboxService(
      client,
      auditWriter,
      privateUploads,
      () => now,
      experience,
    );
    const correlationId = crypto.randomUUID();

    const captured = await service.capture({
      actor: { userId: graph.employeeAId, active: true, roles: ["employee"] },
      correlationId,
      input: { text: "Record a durable change", projectId: null },
    });

    await expect(
      client.workSignalReceipt.findUnique({
        where: { idempotencyKey: `private-inbox:${captured.id}:v1` },
      }),
    ).resolves.toMatchObject({
      recipientId: graph.employeeAId,
      correlationId,
      deliveryState: "queued",
      signalType: "user.capture_submitted",
    });
    expect(wake).toHaveBeenCalledOnce();
  });

  it("keeps an unlinked capture private to its employee", async () => {
    const graph = await seedInboxGraph();
    const service = new PrivateInboxService(client, auditWriter, privateUploads, () => now);
    const query = new PrivateInboxQueryService(client);
    const captured = await service.capture({
      actor: { userId: graph.employeeAId, active: true, roles: ["employee"] },
      correlationId: crypto.randomUUID(),
      input: { text: "Follow up on the client decision", projectId: null },
    });

    await expect(
      query.list({
        actor: { userId: graph.employeeAId, active: true, roles: ["employee"] },
        input: { status: "open", limit: 50, cursor: null },
      }),
    ).resolves.toMatchObject({ items: [{ id: captured.id, projectId: null }] });
    await expect(
      query.list({
        actor: { userId: graph.employeeBId, active: true, roles: ["employee"] },
        input: { status: "open", limit: 50, cursor: null },
      }),
    ).resolves.toEqual({ items: [], nextCursor: null });
    await expect(
      query.list({
        actor: { userId: graph.managerId, active: true, roles: ["manager"] },
        input: { status: "open", limit: 50, cursor: null },
      }),
    ).rejects.toMatchObject({ code: "PRIVATE_INBOX_FORBIDDEN" });
    await expect(
      service.dismiss({
        actor: { userId: graph.employeeBId, active: true, roles: ["employee"] },
        correlationId: crypto.randomUUID(),
        inboxItemId: captured.id,
        input: { expectedVersion: 1, reason: "Not mine" },
      }),
    ).rejects.toMatchObject({ code: "PRIVATE_INBOX_FORBIDDEN" });
    await expect(
      service.promote({
        actor: { userId: graph.employeeBId, active: true, roles: ["employee"] },
        correlationId: crypto.randomUUID(),
        inboxItemId: captured.id,
        input: {
          title: "Should not be created",
          description: "",
          projectId: graph.projectId,
          workstreamId: null,
          assigneeId: graph.employeeBId,
          dueAt: null,
          priority: "normal",
          requirements: [],
          acceptanceConditions: [],
          blocker: null,
          nextAction: null,
          expectedVersion: 1,
          reason: "Not mine",
        },
      }),
    ).rejects.toMatchObject({ code: "PRIVATE_INBOX_FORBIDDEN" });
  });

  it("promotes once and rolls back both records if the transaction fails", async () => {
    const graph = await seedInboxGraph();
    const service = new PrivateInboxService(client, auditWriter, privateUploads, () => now);
    const captured = await service.capture({
      actor: { userId: graph.employeeAId, active: true, roles: ["employee"] },
      correlationId: crypto.randomUUID(),
      input: { text: "Prepare the launch checklist", projectId: graph.projectId },
    });
    const failingAudit = {
      append: vi.fn(async () => {
        throw new Error("simulated audit failure");
      }),
    };
    const failingService = new PrivateInboxService(
      client,
      failingAudit as never,
      privateUploads,
      () => now,
    );
    const promoteCommand = {
      actor: { userId: graph.employeeAId, active: true, roles: ["employee"] },
      correlationId: crypto.randomUUID(),
      inboxItemId: captured.id,
      input: {
        title: "Prepare the launch checklist",
        description: "Review the release requirements.",
        projectId: graph.projectId,
        workstreamId: null,
        assigneeId: graph.employeeAId,
        dueAt: null,
        priority: "high" as const,
        requirements: [],
        acceptanceConditions: ["Checklist approved"],
        blocker: null,
        nextAction: "Draft the first version",
        expectedVersion: 1,
        reason: "Employee confirmed the task draft",
      },
    };

    await expect(failingService.promote(promoteCommand)).rejects.toThrow("simulated audit failure");
    await expect(
      client.privateInboxItem.findUnique({ where: { id: captured.id } }),
    ).resolves.toMatchObject({ status: "open", promotedWorkItemId: null, version: 1 });
    await expect(
      client.workItem.count({
        where: {
          createdById: graph.employeeAId,
          title: "Prepare the launch checklist",
        },
      }),
    ).resolves.toBe(0);

    const promoted = await service.promote(promoteCommand);
    expect(promoted).toMatchObject({
      projectId: graph.projectId,
      title: "Prepare the launch checklist",
      assigneeId: graph.employeeAId,
    });
    await expect(
      client.privateInboxItem.findUnique({ where: { id: captured.id } }),
    ).resolves.toMatchObject({
      status: "promoted",
      promotedWorkItemId: promoted.id,
      version: 2,
    });
    await expect(service.promote(promoteCommand)).rejects.toMatchObject({
      code: "PRIVATE_INBOX_ALREADY_RESOLVED",
    });
  });
});
