import { describe, expect, it, vi } from "vitest";

import { WorkItemService } from "./service.js";

describe("WorkItemService confirmed Task authorization boundary", () => {
  it("uses the injected Projects transaction lock instead of reading Project tables locally", async () => {
    const actorId = crypto.randomUUID();
    const assigneeId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const departmentId = crypto.randomUUID();
    const now = new Date("2026-08-02T12:00:00.000Z");
    const authorizeCurrentMemberInTransaction = vi.fn(async () => ({
      id: projectId,
      departmentId,
      status: "active" as const,
    }));
    const transaction = {
      project: {
        findUnique: async () => {
          throw new Error("Work Items must not authorize against Project tables directly");
        },
      },
      workstream: { findUnique: async () => null },
      projectMember: { findFirst: async () => ({ id: crypto.randomUUID() }) },
      roleAssignment: { findFirst: async () => null },
      workItem: {
        findUnique: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => ({
          ...data,
          status: "planned",
          version: 1,
          createdAt: now,
          updatedAt: now,
        }),
      },
      workItemAssignmentHistory: { create: async () => ({}) },
    };
    const service = new WorkItemService(
      {} as never,
      { append: async () => ({ id: crypto.randomUUID(), createdAt: now.toISOString() }) },
      () => now,
      { authorizeCurrentMemberInTransaction } as never,
    );

    await expect(
      service.createConfirmedTask(transaction as never, {
        actor: { userId: actorId, active: true },
        correlationId: crypto.randomUUID(),
        workItemId: crypto.randomUUID(),
        input: {
          title: "Confirm the context Task",
          description: "Created through the official confirmation boundary.",
          projectId,
          workstreamId: null,
          assigneeId,
          dueAt: null,
          priority: "normal",
          requirements: [],
          acceptanceConditions: [],
          blocker: null,
          nextAction: null,
        },
        reason: "Employee confirmed this Task",
      }),
    ).resolves.toMatchObject({ projectId, assigneeId });
    expect(authorizeCurrentMemberInTransaction).toHaveBeenCalledOnce();
    expect(authorizeCurrentMemberInTransaction).toHaveBeenCalledWith(transaction, {
      actor: { userId: actorId, active: true },
      projectId,
      at: now,
    });
  });
});
