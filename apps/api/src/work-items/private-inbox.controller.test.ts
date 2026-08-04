import { describe, expect, it, vi } from "vitest";

import { PrivateInboxController } from "./private-inbox.controller.js";

const actorId = crypto.randomUUID();
const inboxItemId = crypto.randomUUID();
const projectId = crypto.randomUUID();

function request(active = true) {
  return {
    principal: { userId: actorId, active },
    correlationId: crypto.randomUUID(),
  } as never;
}

describe("PrivateInboxController", () => {
  it("derives ownership from the principal and accepts text-only capture", async () => {
    const capture = vi.fn(async (command) => command);
    const controller = new PrivateInboxController({ capture } as never, {} as never);

    await controller.capture(request(), { text: "Follow up after the client call" });

    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { userId: actorId, active: true },
        input: { text: "Follow up after the client call", projectId: null },
      }),
    );
  });

  it("passes inactive state to the domain and never accepts caller ownership", async () => {
    const capture = vi.fn(async (command) => command);
    const controller = new PrivateInboxController({ capture } as never, {} as never);

    await controller.capture(request(false), { text: "Private note" });
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ actor: { userId: actorId, active: false } }),
    );
    expect(() =>
      controller.capture(request(false), {
        text: "Private note",
        employeeId: crypto.randomUUID(),
      }),
    ).toThrow();
  });

  it("validates list, dismiss, and Project-linked promotion commands", async () => {
    const service = {
      dismiss: vi.fn(async (command) => command),
      promote: vi.fn(async (command) => command),
    };
    const query = { list: vi.fn(async (command) => command) };
    const controller = new PrivateInboxController(service as never, query as never);

    await controller.list(request(), { status: "open", limit: "20" });
    await controller.dismiss(request(), inboxItemId, {
      expectedVersion: 1,
      reason: "No longer needed",
    });
    await controller.promote(request(), inboxItemId, {
      title: "Prepare launch notes",
      description: "",
      projectId,
      workstreamId: null,
      assigneeId: actorId,
      dueAt: null,
      priority: "normal",
      requirements: [],
      acceptanceConditions: [],
      blocker: null,
      nextAction: null,
      expectedVersion: 1,
      reason: "Employee confirmed the Task draft",
    });

    expect(query.list).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true },
      input: { status: "open", limit: 20, cursor: null },
    });
    expect(service.dismiss).toHaveBeenCalledWith(expect.objectContaining({ inboxItemId }));
    expect(service.promote).toHaveBeenCalledWith(
      expect.objectContaining({
        inboxItemId,
        input: expect.objectContaining({ projectId }),
      }),
    );
  });
});
