import { describe, expect, it, vi } from "vitest";
import { ProjectService } from "@evaluation/projects";

import { AuthGuard } from "../auth/auth.guard.js";
import { ProjectPolicyGuard } from "./project-policy-loaders.js";
import { ProjectsController } from "./projects.controller.js";

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
    createProject: vi.fn(async (value: unknown) => value),
    listProjects: vi.fn(async (value: unknown) => value),
    getProject: vi.fn(async (value: unknown) => value),
    addProjectMember: vi.fn(async (value: unknown) => value),
    endProjectMember: vi.fn(async (value: unknown) => value),
    transitionProject: vi.fn(async (value: unknown) => value),
  };
}

describe("ProjectsController", () => {
  it("binds the authenticated principal and correlation ID to strict create input", async () => {
    const service = serviceMock();
    const controller = new ProjectsController(service as never);
    const body = {
      departmentId: "00000000-0000-4000-8000-000000000003",
      name: "Evaluation Platform",
      description: "Pilot implementation",
      primaryOwnerId: "00000000-0000-4000-8000-000000000004",
      startsAt: "2026-07-17T06:00:00Z",
      reason: "Approved department project",
    };

    await controller.create(request, body);
    expect(service.createProject).toHaveBeenCalledWith({
      actor: { userId: request.principal.userId, active: true },
      correlationId: request.correlationId,
      input: body,
    });
    expect(() => controller.create(request, { ...body, unexpected: true })).toThrowError(
      expect.objectContaining({ code: "PROJECT_INPUT_INVALID" }),
    );
  });

  it("declares the protected REST surface", () => {
    expect(Reflect.getMetadata(PATH_METADATA, ProjectsController)).toBe("api/v1/projects");
    expect(Reflect.getMetadata(GUARDS_METADATA, ProjectsController)).toContain(AuthGuard);
    expect(Reflect.getMetadata(PATH_METADATA, ProjectsController.prototype.create)).toBe("/");
    expect(Reflect.getMetadata(METHOD_METADATA, ProjectsController.prototype.create)).toBe(1);
    expect(Reflect.getMetadata(GUARDS_METADATA, ProjectsController.prototype.create)).toContain(
      ProjectPolicyGuard,
    );
    expect(Reflect.getMetadata(PATH_METADATA, ProjectsController.prototype.transition)).toBe(
      ":projectId/status",
    );
    expect(Reflect.getMetadata("self:paramtypes", ProjectsController)).toContainEqual({
      index: 0,
      param: ProjectService,
    });
  });

  it("rejects invalid path identifiers before calling the service", () => {
    const service = serviceMock();
    const controller = new ProjectsController(service as never);

    expect(() => controller.get(request, "not-a-uuid")).toThrowError(
      expect.objectContaining({ code: "PROJECT_INPUT_INVALID", status: 400 }),
    );
    expect(() =>
      controller.endMember(request, crypto.randomUUID(), "not-a-uuid", {
        endsAt: "2026-07-17T10:00:00Z",
        reason: "Contribution completed",
        expectedVersion: 1,
      }),
    ).toThrowError(expect.objectContaining({ code: "PROJECT_INPUT_INVALID", status: 400 }));
    expect(service.getProject).not.toHaveBeenCalled();
    expect(service.endProjectMember).not.toHaveBeenCalled();
  });
});
