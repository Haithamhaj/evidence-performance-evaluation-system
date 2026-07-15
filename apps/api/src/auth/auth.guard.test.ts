import { describe, expect, it, vi } from "vitest";

import { AuthGuard } from "./auth.guard.js";

const validationConfig = {
  audience: "evaluation-api",
  issuer: "http://localhost:8081/realms/evaluation",
  jwks: vi.fn(),
};

function context(authorization?: string) {
  const request: { headers: { authorization?: string }; principal?: unknown } = {
    headers: authorization === undefined ? {} : { authorization },
  };
  const executionContext = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as import("@nestjs/common").ExecutionContext;
  return { executionContext, request };
}

describe("API authentication guard", () => {
  it("denies a missing bearer token with a stable safe error", async () => {
    const guard = new AuthGuard(validationConfig, {} as never, vi.fn(), vi.fn());

    await expect(guard.canActivate(context().executionContext)).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
      messageKey: "errors.auth.required",
      status: 401,
    });
  });

  it("attaches the synchronized internal principal to the request", async () => {
    const validated = {
      email: "employee@pilot.local",
      issuer: validationConfig.issuer,
      oidcSubject: "oidc-user-1",
    };
    const principal = {
      active: true,
      email: validated.email,
      oidcSubject: validated.oidcSubject,
      roles: [],
      userId: "9a11bb8f-79f5-4a72-a98f-2e763e97699b",
    };
    const validate = vi.fn().mockResolvedValue(validated);
    const sync = vi.fn().mockResolvedValue(principal);
    const guard = new AuthGuard(validationConfig, {} as never, validate, sync);
    const { executionContext, request } = context("Bearer signed-token");

    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
    expect(validate).toHaveBeenCalledWith("signed-token", validationConfig);
    expect(request.principal).toEqual(principal);
  });
});
