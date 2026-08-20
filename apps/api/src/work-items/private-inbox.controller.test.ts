import { describe, expect, it, vi } from "vitest";

import { PrivateInboxController } from "./private-inbox.controller.js";

const actorId = crypto.randomUUID();
const inboxItemId = crypto.randomUUID();
const projectId = crypto.randomUUID();

function request(active = true, roles: readonly string[] = ["employee"]) {
  return {
    principal: { userId: actorId, active, roles },
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
        actor: { userId: actorId, active: true, roles: ["employee"] },
        input: {
          text: "Follow up after the client call",
          projectId: null,
          sourceType: "text",
          sourceUploadId: null,
        },
      }),
    );
  });

  it.each([["manager"], ["system_administrator"]])(
    "denies %s-only principals across private Inbox APIs",
    async (role) => {
      const service = { capture: vi.fn(), dismiss: vi.fn(), promote: vi.fn() };
      const query = { list: vi.fn() };
      const controller = new PrivateInboxController(service as never, query as never);
      const denied = request(true, [role]);

      expect(() => controller.capture(denied, { text: "Private" })).toThrowError(
        "PRIVATE_INBOX_FORBIDDEN",
      );
      expect(() => controller.list(denied, {})).toThrowError("PRIVATE_INBOX_FORBIDDEN");
      expect(() =>
        controller.dismiss(denied, inboxItemId, { expectedVersion: 1, reason: "Denied" }),
      ).toThrowError("PRIVATE_INBOX_FORBIDDEN");
      expect(() =>
        controller.promote(denied, inboxItemId, {
          title: "Denied",
          projectId,
          assigneeId: actorId,
          expectedVersion: 1,
          reason: "Denied",
        }),
      ).toThrowError("PRIVATE_INBOX_FORBIDDEN");
      expect(service.capture).not.toHaveBeenCalled();
      expect(query.list).not.toHaveBeenCalled();
    },
  );

  it("allows a manager who also has employee authority", async () => {
    const capture = vi.fn(async (command) => command);
    const controller = new PrivateInboxController({ capture } as never, {} as never);
    await controller.capture(request(true, ["manager", "employee"]), { text: "My note" });
    expect(capture).toHaveBeenCalledOnce();
  });

  it("denies inactive principals and never accepts caller ownership", async () => {
    const capture = vi.fn(async (command) => command);
    const controller = new PrivateInboxController({ capture } as never, {} as never);

    expect(() => controller.capture(request(false), { text: "Private note" })).toThrowError(
      "PRIVATE_INBOX_FORBIDDEN",
    );
    expect(capture).not.toHaveBeenCalled();
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
      actor: { userId: actorId, active: true, roles: ["employee"] },
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
