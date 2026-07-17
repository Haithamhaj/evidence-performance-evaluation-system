import { WorkstreamService } from "@evaluation/projects";
import { describe, expect, it, vi } from "vitest";

import { AuthGuard } from "../auth/auth.guard.js";
import { ProjectPolicyGuard } from "./project-policy-loaders.js";
import { WorkstreamsController } from "./workstreams.controller.js";

const GUARDS_METADATA = "__guards__";
const METHOD_METADATA = "method";
const PATH_METADATA = "path";

const request = {
  principal: {
    userId: "00000000-0000-4000-8000-000000000001",
    oidcSubject: "manager",
    email: "manager@example.invalid",
    roles: ["manager"],
    active: true,
  },
  correlationId: "00000000-0000-4000-8000-000000000002",
} as const;

function serviceMock() {
  return {
    createWorkstream: vi.fn(async (value: unknown) => value),
    listWorkstreams: vi.fn(async (value: unknown) => value),
    getWorkstream: vi.fn(async (value: unknown) => value),
    addContributor: vi.fn(async (value: unknown) => value),
    endContributor: vi.fn(async (value: unknown) => value),
    transitionWorkstream: vi.fn(async (value: unknown) => value),
  };
}

describe("WorkstreamsController", () => {
  it("binds strict workstream input and authenticated request context", async () => {
    const service = serviceMock();
    const controller = new WorkstreamsController(service as never);
    const projectId = "00000000-0000-4000-8000-000000000003";
    const body = {
      name: "API delivery",
      description: "Governed workstream",
      primaryOwnerId: "00000000-0000-4000-8000-000000000004",
      startsAt: "2026-07-17T07:00:00Z",
      reason: "Approved workstream",
    };

    await controller.create(request, projectId, body);
    expect(service.createWorkstream).toHaveBeenCalledWith({
      actor: { userId: request.principal.userId, active: true },
      correlationId: request.correlationId,
      projectId,
      input: body,
    });
    expect(() => controller.create(request, projectId, { ...body, unexpected: true })).toThrowError(
      expect.objectContaining({ code: "WORKSTREAM_INPUT_INVALID", status: 400 }),
    );
  });

  it("declares the protected REST surface and service injection token", () => {
    expect(Reflect.getMetadata(PATH_METADATA, WorkstreamsController)).toBe(
      "api/v1/projects/:projectId/workstreams",
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, WorkstreamsController)).toContain(AuthGuard);
    expect(Reflect.getMetadata(PATH_METADATA, WorkstreamsController.prototype.create)).toBe("/");
    expect(Reflect.getMetadata(METHOD_METADATA, WorkstreamsController.prototype.create)).toBe(1);
    expect(Reflect.getMetadata(GUARDS_METADATA, WorkstreamsController.prototype.create)).toContain(
      ProjectPolicyGuard,
    );
    expect(Reflect.getMetadata(PATH_METADATA, WorkstreamsController.prototype.transition)).toBe(
      ":workstreamId/status",
    );
    expect(Reflect.getMetadata("self:paramtypes", WorkstreamsController)).toContainEqual({
      index: 0,
      param: WorkstreamService,
    });
  });

  it("rejects invalid project, workstream, and user identifiers before service calls", () => {
    const service = serviceMock();
    const controller = new WorkstreamsController(service as never);
    const validId = crypto.randomUUID();

    expect(() => controller.list(request, "not-a-uuid")).toThrowError(
      expect.objectContaining({ code: "WORKSTREAM_INPUT_INVALID", status: 400 }),
    );
    expect(() => controller.get(request, validId, "not-a-uuid")).toThrowError(
      expect.objectContaining({ code: "WORKSTREAM_INPUT_INVALID", status: 400 }),
    );
    expect(() =>
      controller.endContributor(request, validId, validId, "not-a-uuid", {
        endsAt: "2026-07-17T10:00:00Z",
        reason: "Contribution completed",
        expectedVersion: 1,
      }),
    ).toThrowError(expect.objectContaining({ code: "WORKSTREAM_INPUT_INVALID", status: 400 }));
    expect(service.listWorkstreams).not.toHaveBeenCalled();
    expect(service.getWorkstream).not.toHaveBeenCalled();
    expect(service.endContributor).not.toHaveBeenCalled();
  });
});
