import { Controller, Get, Module } from "@nestjs/common";
import { NestFactory, Reflector } from "@nestjs/core";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../packages/contracts/src/index.js";

import {
  AUTH_DATABASE,
  AUTH_TOKEN_VALIDATOR,
  AUTH_USER_SYNCHRONIZER,
  AUTH_VALIDATION_CONFIG,
  AuthGuard,
} from "../../apps/api/src/auth/auth.guard.js";
import { AppErrorFilter } from "../../apps/api/src/platform/error.filter.js";
import { PermissionsModule } from "../../apps/api/src/permissions/permissions.module.js";
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

    await expect(new PolicyGuard(new Reflector()).canActivate(executionContext)).resolves.toBe(
      true,
    );
    expect(loader).toHaveBeenCalledWith(request, authenticatedPrincipal);
  });

  it("denies a manager from another department with a safe reason-specific error", async () => {
    const loader = responseLoader(roleAssignments("manager", "department", "department-other"));
    const { executionContext } = guardedContext(principal("manager-2"), loader);

    await expect(
      new PolicyGuard(new Reflector()).canActivate(executionContext),
    ).rejects.toMatchObject({
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

    await expect(
      new PolicyGuard(new Reflector()).canActivate(executionContext),
    ).rejects.toMatchObject({
      code: "AUTHZ_ROLE_REQUIRED",
      messageKey: "errors.authorization.denied",
      status: 403,
    });
  });

  it("denies an employee from reading another employee response", async () => {
    const loader = responseLoader(roleAssignments("employee", "department", "department-ai"));
    const { executionContext } = guardedContext(principal("employee-2"), loader);

    await expect(
      new PolicyGuard(new Reflector()).canActivate(executionContext),
    ).rejects.toMatchObject({
      code: "AUTHZ_SCOPE_MISMATCH",
      messageKey: "errors.authorization.denied",
      status: 403,
    });
  });

  it("denies an unauthenticated request before loading protected resource scope", async () => {
    const loader = responseLoader(roleAssignments("manager", "department", "department-ai"));
    const { executionContext } = guardedContext(undefined, loader);

    await expect(
      new PolicyGuard(new Reflector()).canActivate(executionContext),
    ).rejects.toMatchObject({
      code: "AUTHZ_UNAUTHENTICATED",
      messageKey: "errors.authorization.denied",
      status: 401,
    });
    expect(loader).not.toHaveBeenCalled();
  });

  it("denies an inactive principal before loading protected resource scope", async () => {
    const loader = responseLoader(roleAssignments("manager", "department", "department-ai"));
    const { executionContext } = guardedContext(principal("manager-1", false), loader);

    await expect(
      new PolicyGuard(new Reflector()).canActivate(executionContext),
    ).rejects.toMatchObject({
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

    await expect(
      new PolicyGuard(new Reflector()).canActivate(executionContext),
    ).rejects.toMatchObject({
      code: "AUTHZ_ROLE_REQUIRED",
      messageKey: "errors.authorization.denied",
      status: 403,
    });
  });
});

describe("RequirePolicy HTTP composition", () => {
  let app: import("@nestjs/common").INestApplication;
  let baseUrl: string;
  let handlerExecutions = 0;
  const originalEnvironment = {
    DATABASE_URL: process.env.DATABASE_URL,
    OIDC_AUDIENCE: process.env.OIDC_AUDIENCE,
    OIDC_ISSUER: process.env.OIDC_ISSUER,
  };

  const loader: import("../../apps/api/src/permissions/require-policy.decorator.js").PolicyResourceLoader =
    async (_request, authenticatedPrincipal) => ({
      context: { now, incompleteEligibleCount: 4, uiVisible: false },
      resource: response,
      roleAssignments: roleAssignments(
        "manager",
        "department",
        authenticatedPrincipal.userId === "manager-1" ? "department-ai" : "department-other",
      ),
    });

  class ProtectedController {
    read(): { responseId: string } {
      handlerExecutions += 1;
      return { responseId: response.responseId };
    }
  }

  const descriptor = Object.getOwnPropertyDescriptor(ProtectedController.prototype, "read");
  if (descriptor === undefined) throw new Error("protected handler descriptor is missing");
  RequirePolicy("managerFeedback.response.read", loader)(
    ProtectedController.prototype,
    "read",
    descriptor,
  );
  Controller("test")(ProtectedController);
  Get("manager-feedback")(ProtectedController.prototype, "read", descriptor);

  class TestAuthorizationModule {}

  Module({
    imports: [PermissionsModule],
    controllers: [ProtectedController],
    providers: [
      {
        provide: AUTH_VALIDATION_CONFIG,
        useValue: {
          audience: "evaluation-api",
          issuer: "https://identity.test/realms/evaluation",
          jwks: vi.fn(),
        },
      },
      { provide: AUTH_DATABASE, useValue: {} },
      {
        provide: AUTH_TOKEN_VALIDATOR,
        useValue: async (token: string) => {
          if (!["active-manager", "inactive-manager", "other-manager"].includes(token)) {
            throw new AppError("AUTH_TOKEN_INVALID", "errors.auth.invalidToken", 401);
          }
          return {
            email: `${token}@pilot.local`,
            issuer: "https://identity.test/realms/evaluation",
            oidcSubject: token,
          };
        },
      },
      {
        provide: AUTH_USER_SYNCHRONIZER,
        useValue: async (
          _database: unknown,
          externalPrincipal: import("@evaluation/auth").ValidatedOidcPrincipal,
        ) =>
          principal(
            externalPrincipal.oidcSubject === "other-manager" ? "manager-2" : "manager-1",
            externalPrincipal.oidcSubject !== "inactive-manager",
          ),
      },
      AuthGuard,
    ],
  })(TestAuthorizationModule);

  beforeAll(async () => {
    process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/evaluation";
    process.env.OIDC_AUDIENCE = "evaluation-api";
    process.env.OIDC_ISSUER = "https://identity.test/realms/evaluation";
    app = await NestFactory.create(TestAuthorizationModule, { logger: false });
    app.useGlobalFilters(new AppErrorFilter());
    await app.listen(0, "127.0.0.1");
    const address = app.getHttpServer().address() as import("node:net").AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    handlerExecutions = 0;
  });

  afterAll(async () => {
    await app.close();
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  async function request(token?: string): Promise<Response> {
    return fetch(`${baseUrl}/test/manager-feedback`, {
      headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
    });
  }

  it("fails closed before the handler when the request is unauthenticated", async () => {
    const httpResponse = await request();

    expect(httpResponse.status).toBe(401);
    await expect(httpResponse.json()).resolves.toMatchObject({
      code: "AUTH_REQUIRED",
      correlationId: expect.any(String),
      messageKey: "errors.auth.required",
    });
    expect(handlerExecutions).toBe(0);
  });

  it("fails closed before the handler when the authenticated principal is inactive", async () => {
    const httpResponse = await request("inactive-manager");

    expect(httpResponse.status).toBe(403);
    await expect(httpResponse.json()).resolves.toMatchObject({
      code: "AUTHZ_INACTIVE",
      correlationId: expect.any(String),
      messageKey: "errors.authorization.denied",
    });
    expect(handlerExecutions).toBe(0);
  });

  it("fails closed before the handler when the authenticated manager has the wrong scope", async () => {
    const httpResponse = await request("other-manager");

    expect(httpResponse.status).toBe(403);
    await expect(httpResponse.json()).resolves.toMatchObject({
      code: "AUTHZ_SCOPE_MISMATCH",
      correlationId: expect.any(String),
      messageKey: "errors.authorization.denied",
    });
    expect(handlerExecutions).toBe(0);
  });

  it("executes the handler for the authorized manager without a team-completion gate", async () => {
    const httpResponse = await request("active-manager");

    expect(httpResponse.status).toBe(200);
    await expect(httpResponse.json()).resolves.toEqual({ responseId: "response-1" });
    expect(handlerExecutions).toBe(1);
  });
});
