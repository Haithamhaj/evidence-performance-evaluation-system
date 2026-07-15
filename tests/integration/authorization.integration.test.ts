import { describe, expect, it, vi } from "vitest";

import { PolicyGuard } from "../../apps/api/src/permissions/policy.guard.js";
import { RequirePolicy } from "../../apps/api/src/permissions/require-policy.decorator.js";

const now = "2026-07-15T12:00:00.000Z";

function principal(
  userId: string,
  active = true,
): import("@evaluation/auth").AuthenticatedPrincipal {
  return {
    active,
    email: `${userId}@pilot.local`,
    oidcSubject: `oidc-${userId}`,
    roles: [],
    userId,
  };
}

const response: import("@evaluation/permissions").PolicyResource = {
  kind: "managerFeedback.response",
  responseId: "response-1",
  departmentId: "department-ai",
  managerId: "manager-1",
  submitterId: "employee-1",
  status: "submitted",
  visibilityMode: "identified",
};

function roleAssignments(
  role: import("@evaluation/permissions").PolicyInput["roles"][number]["role"],
  scopeType: import("@evaluation/permissions").PolicyInput["roles"][number]["scopeType"],
  scopeId: string,
): import("@evaluation/permissions").PolicyInput["roles"] {
  return [{ role, scopeType, scopeId }];
}

function guardedContext(
  authenticatedPrincipal: import("@evaluation/auth").AuthenticatedPrincipal | undefined,
  loader: import("../../apps/api/src/permissions/require-policy.decorator.js").PolicyResourceLoader,
) {
  class TestController {
    read(): void {}
  }
  const descriptor = Object.getOwnPropertyDescriptor(TestController.prototype, "read");
  if (descriptor === undefined) throw new Error("test handler descriptor is missing");
  RequirePolicy("managerFeedback.response.read", loader)(
    TestController.prototype,
    "read",
    descriptor,
  );

  const request: Record<string, unknown> & {
    principal?: import("@evaluation/auth").AuthenticatedPrincipal;
  } = {};
  if (authenticatedPrincipal !== undefined) request.principal = authenticatedPrincipal;
  const executionContext = {
    getHandler: () => TestController.prototype.read,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as import("@nestjs/common").ExecutionContext;
  return { executionContext, request };
}

function responseLoader(
  roles: import("@evaluation/permissions").PolicyInput["roles"],
  overrides: Partial<{
    resource: import("@evaluation/permissions").PolicyResource;
    incompleteEligibleCount: number;
  }> = {},
): import("../../apps/api/src/permissions/require-policy.decorator.js").PolicyResourceLoader {
  return vi.fn().mockResolvedValue({
    context: {
      now,
      incompleteEligibleCount: overrides.incompleteEligibleCount ?? 4,
      uiVisible: false,
    },
    resource: overrides.resource ?? response,
    roleAssignments: roles,
  });
}

describe("Nest authorization adapter", () => {
  it("allows the authorized manager to read each submitted identified response immediately", async () => {
    const loader = responseLoader(roleAssignments("manager", "department", "department-ai"));
    const authenticatedPrincipal = principal("manager-1");
    const { executionContext, request } = guardedContext(authenticatedPrincipal, loader);

    await expect(new PolicyGuard().canActivate(executionContext)).resolves.toBe(true);
    expect(loader).toHaveBeenCalledWith(request, authenticatedPrincipal);
  });

  it("denies a manager from another department with a safe reason-specific error", async () => {
    const loader = responseLoader(roleAssignments("manager", "department", "department-other"));
    const { executionContext } = guardedContext(principal("manager-2"), loader);

    await expect(new PolicyGuard().canActivate(executionContext)).rejects.toMatchObject({
      code: "AUTHZ_SCOPE_MISMATCH",
      message: "AUTHZ_SCOPE_MISMATCH",
      messageKey: "errors.authorization.denied",
      status: 403,
    });
  });

  it("does not treat a System Administrator identity as the pilot manager", async () => {
    const loader = responseLoader(
      roleAssignments("system_administrator", "system", "evaluation-system"),
    );
    const { executionContext } = guardedContext(principal("administrator-1"), loader);

    await expect(new PolicyGuard().canActivate(executionContext)).rejects.toMatchObject({
      code: "AUTHZ_ROLE_REQUIRED",
      messageKey: "errors.authorization.denied",
      status: 403,
    });
  });

  it("denies an employee from reading another employee response", async () => {
    const loader = responseLoader(roleAssignments("employee", "department", "department-ai"));
    const { executionContext } = guardedContext(principal("employee-2"), loader);

    await expect(new PolicyGuard().canActivate(executionContext)).rejects.toMatchObject({
      code: "AUTHZ_SCOPE_MISMATCH",
      messageKey: "errors.authorization.denied",
      status: 403,
    });
  });

  it("denies an unauthenticated request before loading protected resource scope", async () => {
    const loader = responseLoader(roleAssignments("manager", "department", "department-ai"));
    const { executionContext } = guardedContext(undefined, loader);

    await expect(new PolicyGuard().canActivate(executionContext)).rejects.toMatchObject({
      code: "AUTHZ_UNAUTHENTICATED",
      messageKey: "errors.authorization.denied",
      status: 401,
    });
    expect(loader).not.toHaveBeenCalled();
  });

  it("denies an inactive principal before loading protected resource scope", async () => {
    const loader = responseLoader(roleAssignments("manager", "department", "department-ai"));
    const { executionContext } = guardedContext(principal("manager-1", false), loader);

    await expect(new PolicyGuard().canActivate(executionContext)).rejects.toMatchObject({
      code: "AUTHZ_INACTIVE",
      messageKey: "errors.authorization.denied",
      status: 403,
    });
    expect(loader).not.toHaveBeenCalled();
  });

  it("defaults to deny when a protected handler has no policy requirement", async () => {
    const executionContext = {
      getHandler: () => (): void => undefined,
      switchToHttp: () => ({ getRequest: () => ({ principal: principal("manager-1") }) }),
    } as unknown as import("@nestjs/common").ExecutionContext;

    await expect(new PolicyGuard().canActivate(executionContext)).rejects.toMatchObject({
      code: "AUTHZ_ROLE_REQUIRED",
      messageKey: "errors.authorization.denied",
      status: 403,
    });
  });
});
