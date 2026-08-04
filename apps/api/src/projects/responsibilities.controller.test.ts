import { ResponsibilityService } from "@evaluation/projects";
import { describe, expect, it, vi } from "vitest";

import { ProjectPolicyGuard } from "./project-policy-loaders.js";
import { ProjectsAuthenticationGuard } from "./projects-authentication.guard.js";
import { ResponsibilitiesController } from "./responsibilities.controller.js";

const GUARDS_METADATA = "__guards__";
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
    transferProjectOwner: vi.fn(async (value: unknown) => value),
    transferWorkstreamOwner: vi.fn(async (value: unknown) => value),
    responsibilitiesAt: vi.fn(async (value: unknown) => value),
    workstreamResponsibilitiesAt: vi.fn(async (value: unknown) => value),
    responsibilityHistory: vi.fn(async (value: unknown) => value),
    workstreamResponsibilityHistory: vi.fn(async (value: unknown) => value),
  };
}

describe("ResponsibilitiesController", () => {
  it("binds a strict permanent transfer to the authenticated manager context", async () => {
    const service = serviceMock();
    const controller = new ResponsibilitiesController(service as never);
    const projectId = "00000000-0000-4000-8000-000000000003";
    const body = {
      transferKind: "permanent",
      toUserId: "00000000-0000-4000-8000-000000000004",
      effectiveAt: "2026-08-01T00:00:00Z",
      reason: "Approved transfer",
      expectedVersion: 1,
    };

    await controller.transferProject(request, projectId, body);
    expect(service.transferProjectOwner).toHaveBeenCalledWith({
      actor: { userId: request.principal.userId, active: true },
      correlationId: request.correlationId,
      projectId,
      input: body,
    });
    expect(() =>
      controller.transferProject(request, projectId, { ...body, endsAt: body.effectiveAt }),
    ).toThrowError(expect.objectContaining({ code: "RESPONSIBILITY_INPUT_INVALID", status: 400 }));
  });

  it("declares protected transfer and history routes with dependency injection", () => {
    expect(Reflect.getMetadata(PATH_METADATA, ResponsibilitiesController)).toBe(
      "api/v1/projects/:projectId",
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, ResponsibilitiesController)).toContain(
      ProjectsAuthenticationGuard,
    );
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ResponsibilitiesController.prototype.transferProject),
    ).toContain(ProjectPolicyGuard);
    expect(
      Reflect.getMetadata(PATH_METADATA, ResponsibilitiesController.prototype.transferProject),
    ).toBe("owner-transfers");
    expect(
      Reflect.getMetadata(PATH_METADATA, ResponsibilitiesController.prototype.transferWorkstream),
    ).toBe("workstreams/:workstreamId/owner-transfers");
    expect(Reflect.getMetadata("self:paramtypes", ResponsibilitiesController)).toContainEqual({
      index: 0,
      param: ResponsibilityService,
    });
  });

  it("rejects invalid path and point-in-time values before service calls", () => {
    const service = serviceMock();
    const controller = new ResponsibilitiesController(service as never);
    const projectId = crypto.randomUUID();

    expect(() => controller.projectAt(request, "not-a-uuid", "2026-08-01T00:00:00Z")).toThrowError(
      expect.objectContaining({ code: "RESPONSIBILITY_INPUT_INVALID", status: 400 }),
    );
    expect(() => controller.projectAt(request, projectId, "2026-08-01")).toThrowError(
      expect.objectContaining({ code: "RESPONSIBILITY_INPUT_INVALID", status: 400 }),
    );
    expect(() => controller.workstreamHistory(request, projectId, "not-a-uuid")).toThrowError(
      expect.objectContaining({ code: "RESPONSIBILITY_INPUT_INVALID", status: 400 }),
    );
    expect(service.responsibilitiesAt).not.toHaveBeenCalled();
    expect(service.workstreamResponsibilityHistory).not.toHaveBeenCalled();
  });
});
