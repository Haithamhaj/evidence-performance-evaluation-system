import { describe, expect, it, vi } from "vitest";

import { ProjectPolicyGuard } from "./project-policy-loaders.js";

const principal = {
  userId: "00000000-0000-4000-8000-000000000001",
  oidcSubject: "subject",
  email: "user@example.invalid",
  roles: [],
  active: true,
} as const;

function context(request: Record<string, unknown>) {
  return {
    getHandler: () => "handler",
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

describe("ProjectPolicyGuard", () => {
  it("rejects invalid resource identifiers before persistence queries", async () => {
    const reflector = { get: vi.fn(() => "project.manage") };
    const database = {
      roleAssignment: { findMany: vi.fn(async () => []) },
      project: { findUnique: vi.fn() },
    };
    const guard = new ProjectPolicyGuard(reflector as never, database as never);

    await expect(
      guard.canActivate(context({ principal, params: { projectId: "not-a-uuid" } })),
    ).rejects.toMatchObject({ code: "PROJECT_INPUT_INVALID", status: 400 });
    expect(database.roleAssignment.findMany).not.toHaveBeenCalled();
    expect(database.project.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an invalid create department before persistence queries", async () => {
    const reflector = { get: vi.fn(() => "project.create") };
    const database = {
      roleAssignment: { findMany: vi.fn(async () => []) },
      authorizationScope: { findFirst: vi.fn() },
    };
    const guard = new ProjectPolicyGuard(reflector as never, database as never);

    await expect(
      guard.canActivate(context({ principal, body: { departmentId: "not-a-uuid" }, params: {} })),
    ).rejects.toMatchObject({ code: "PROJECT_INPUT_INVALID", status: 400 });
    expect(database.roleAssignment.findMany).not.toHaveBeenCalled();
    expect(database.authorizationScope.findFirst).not.toHaveBeenCalled();
  });

  it("allows only the matching department manager to create", async () => {
    const reflector = { get: vi.fn(() => "project.create") };
    const database = {
      roleAssignment: {
        findMany: vi.fn(async () => [
          {
            role: "manager",
            scopeType: "department",
            scopeId: "00000000-0000-4000-8000-000000000002",
          },
        ]),
      },
      authorizationScope: {
        findFirst: vi.fn(async () => ({ id: "00000000-0000-4000-8000-000000000002" })),
      },
    };
    const guard = new ProjectPolicyGuard(reflector as never, database as never);

    await expect(
      guard.canActivate(
        context({
          principal,
          body: { departmentId: "00000000-0000-4000-8000-000000000003" },
        }),
      ),
    ).resolves.toBe(true);

    database.roleAssignment.findMany.mockResolvedValueOnce([
      {
        role: "system_administrator",
        scopeType: "system",
        scopeId: "00000000-0000-4000-8000-000000000004",
      },
    ]);
    await expect(
      guard.canActivate(
        context({
          principal,
          body: { departmentId: "00000000-0000-4000-8000-000000000003" },
        }),
      ),
    ).rejects.toMatchObject({ code: "AUTHZ_ROLE_REQUIRED" });
  });

  it("requires an active responsibility window for scoped owner management", async () => {
    const projectId = "00000000-0000-4000-8000-000000000005";
    const reflector = { get: vi.fn(() => "project.manage") };
    const database = {
      roleAssignment: {
        findMany: vi.fn(async () => [
          { role: "project_owner", scopeType: "project", scopeId: projectId },
        ]),
      },
      project: {
        findUnique: vi.fn(async () => ({
          departmentId: "00000000-0000-4000-8000-000000000006",
        })),
      },
      authorizationScope: {
        findFirst: vi.fn(async () => ({ id: "00000000-0000-4000-8000-000000000007" })),
      },
      responsibilityWindow: {
        findMany: vi.fn(async () => [
          {
            responsibilityType: "original",
            startsAt: new Date("2020-01-01T00:00:00Z"),
            endsAt: new Date("2020-01-02T00:00:00Z"),
          },
        ]),
      },
    };
    const guard = new ProjectPolicyGuard(reflector as never, database as never);

    await expect(
      guard.canActivate(context({ principal, params: { projectId } })),
    ).rejects.toMatchObject({ code: "AUTHZ_RESOURCE_STATE" });
  });

  it("authorizes an active workstream owner only for the matching parent and workstream", async () => {
    const projectId = "00000000-0000-4000-8000-000000000010";
    const workstreamId = "00000000-0000-4000-8000-000000000011";
    const reflector = { get: vi.fn(() => "workstream.manage") };
    const database = {
      roleAssignment: {
        findMany: vi.fn(async () => [
          { role: "workstream_owner", scopeType: "workstream", scopeId: workstreamId },
        ]),
      },
      workstream: {
        findFirst: vi.fn(async () => ({
          projectId,
          project: { departmentId: "00000000-0000-4000-8000-000000000012" },
        })),
      },
      authorizationScope: {
        findFirst: vi.fn(async () => ({ id: "00000000-0000-4000-8000-000000000013" })),
      },
      responsibilityWindow: {
        findMany: vi.fn(async () => [
          {
            projectId: null,
            workstreamId,
            responsibilityType: "original",
            startsAt: new Date("2020-01-01T00:00:00Z"),
            endsAt: null,
          },
        ]),
      },
    };
    const guard = new ProjectPolicyGuard(reflector as never, database as never);

    await expect(
      guard.canActivate(context({ principal, params: { projectId, workstreamId } })),
    ).resolves.toBe(true);
    expect(database.workstream.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: workstreamId, projectId } }),
    );
  });

  it("allows an active project owner to read a matching child workstream", async () => {
    const projectId = "00000000-0000-4000-8000-000000000020";
    const workstreamId = "00000000-0000-4000-8000-000000000021";
    const reflector = { get: vi.fn(() => "resource.read") };
    const database = {
      roleAssignment: {
        findMany: vi.fn(async () => [
          { role: "project_owner", scopeType: "project", scopeId: projectId },
        ]),
      },
      workstream: {
        findFirst: vi.fn(async () => ({
          projectId,
          project: { departmentId: "00000000-0000-4000-8000-000000000022" },
        })),
      },
      authorizationScope: {
        findFirst: vi.fn(async () => ({ id: "00000000-0000-4000-8000-000000000023" })),
      },
      responsibilityWindow: {
        findMany: vi.fn(async () => [
          {
            projectId,
            workstreamId: null,
            responsibilityType: "original",
            startsAt: new Date("2020-01-01T00:00:00Z"),
            endsAt: null,
          },
        ]),
      },
    };
    const guard = new ProjectPolicyGuard(reflector as never, database as never);

    await expect(
      guard.canActivate(context({ principal, params: { projectId, workstreamId } })),
    ).resolves.toBe(true);
  });

  it("allows an active workstream contributor to read the parent project summary", async () => {
    const projectId = "00000000-0000-4000-8000-000000000030";
    const workstreamId = "00000000-0000-4000-8000-000000000031";
    const reflector = { get: vi.fn(() => "resource.read") };
    const database = {
      roleAssignment: {
        findMany: vi.fn(async () => [
          { role: "contributor", scopeType: "workstream", scopeId: workstreamId },
        ]),
      },
      project: {
        findUnique: vi.fn(async () => ({
          departmentId: "00000000-0000-4000-8000-000000000032",
        })),
      },
      authorizationScope: {
        findFirst: vi.fn(async () => ({ id: "00000000-0000-4000-8000-000000000033" })),
      },
      responsibilityWindow: {
        findMany: vi.fn(async () => [
          {
            projectId: null,
            workstreamId,
            workstream: { projectId },
            responsibilityType: "contributor",
            startsAt: new Date("2020-01-01T00:00:00Z"),
            endsAt: null,
          },
        ]),
      },
    };
    const guard = new ProjectPolicyGuard(reflector as never, database as never);

    await expect(guard.canActivate(context({ principal, params: { projectId } }))).resolves.toBe(
      true,
    );
  });

  it("allows only the matching department manager through the workstream transfer guard", async () => {
    const projectId = "00000000-0000-4000-8000-000000000040";
    const workstreamId = "00000000-0000-4000-8000-000000000041";
    const departmentScopeId = "00000000-0000-4000-8000-000000000042";
    const reflector = { get: vi.fn(() => "responsibility.transfer") };
    const roles = [{ role: "manager", scopeType: "department", scopeId: departmentScopeId }];
    const database = {
      roleAssignment: { findMany: vi.fn(async () => roles) },
      workstream: {
        findFirst: vi.fn(async () => ({
          projectId,
          project: { departmentId: "00000000-0000-4000-8000-000000000043" },
        })),
      },
      authorizationScope: { findFirst: vi.fn(async () => ({ id: departmentScopeId })) },
      responsibilityWindow: { findMany: vi.fn(async () => []) },
    };
    const guard = new ProjectPolicyGuard(reflector as never, database as never);

    await expect(
      guard.canActivate(context({ principal, params: { projectId, workstreamId } })),
    ).resolves.toBe(true);
    roles.splice(0, 1, {
      role: "system_administrator",
      scopeType: "system",
      scopeId: crypto.randomUUID(),
    });
    await expect(
      guard.canActivate(context({ principal, params: { projectId, workstreamId } })),
    ).rejects.toMatchObject({ code: "AUTHZ_ROLE_REQUIRED" });
    roles.splice(0, 1, {
      role: "workstream_owner",
      scopeType: "workstream",
      scopeId: workstreamId,
    });
    await expect(
      guard.canActivate(context({ principal, params: { projectId, workstreamId } })),
    ).rejects.toMatchObject({ code: "AUTHZ_ROLE_REQUIRED" });
  });
});
