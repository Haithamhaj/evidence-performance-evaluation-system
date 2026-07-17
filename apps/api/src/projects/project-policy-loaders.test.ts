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
});
