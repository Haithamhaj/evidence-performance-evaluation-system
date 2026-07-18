import { describe, expect, it, vi } from "vitest";

import { WorkItemsController } from "./work-items.controller.js";

const actorId = crypto.randomUUID();
const projectId = crypto.randomUUID();
const workItemId = crypto.randomUUID();
const request = {
  principal: { userId: actorId, active: true },
  correlationId: crypto.randomUUID(),
} as never;

describe("WorkItemsController", () => {
  it("derives the actor from the authenticated principal", async () => {
    const service = {
      create: vi.fn(async (command) => command),
      transition: vi.fn(),
      assign: vi.fn(),
    };
    const controller = new WorkItemsController(service as never, {} as never);
    await controller.create(request, {
      title: "Confirm pilot",
      description: "",
      projectId,
      workstreamId: null,
      assigneeId: actorId,
      dueAt: null,
      priority: "high",
      requirements: [],
      acceptanceConditions: ["Owner accepted"],
      blocker: null,
      nextAction: "Run review",
    });

    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ actor: { userId: actorId, active: true } }),
    );
  });

  it("rejects caller-supplied actor and protected scoring fields", () => {
    const controller = new WorkItemsController({} as never, {} as never);
    expect(() =>
      controller.create(request, {
        title: "Invalid",
        projectId,
        actorId: crypto.randomUUID(),
        productivityScore: 90,
      }),
    ).toThrow();
  });

  it("passes only a validated transition and URL identity", async () => {
    const transition = vi.fn(async (command) => command);
    const controller = new WorkItemsController({ transition } as never, {} as never);
    await controller.transition(request, workItemId, {
      status: "in_progress",
      expectedVersion: 2,
      reason: "Started the accepted scope.",
    });
    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({ workItemId, actor: { userId: actorId, active: true } }),
    );
  });
});
