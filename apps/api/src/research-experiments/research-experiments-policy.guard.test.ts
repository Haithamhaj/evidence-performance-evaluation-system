import { AppError } from "@evaluation/contracts";
import { describe, expect, it, vi } from "vitest";

import { ResearchExperimentsPolicyGuard } from "./research-experiments-policy.guard.js";

function context(principal?: Readonly<{ userId: string; active: boolean }>) {
  const request = { headers: {}, ...(principal === undefined ? {} : { principal }) };
  return {
    request,
    execution: {
      switchToHttp: () => ({ getRequest: () => request }),
    } as never,
  };
}

describe("ResearchExperimentsPolicyGuard", () => {
  it("delegates unauthenticated requests to the shared authentication guard", async () => {
    const expected = new AppError("AUTH_REQUIRED", "errors.auth.required", 401);
    const authGuard = { canActivate: vi.fn(async () => Promise.reject(expected)) };
    const guard = new ResearchExperimentsPolicyGuard(authGuard as never);

    await expect(guard.canActivate(context().execution)).rejects.toBe(expected);
  });

  it("rejects an inactive synchronized principal before any domain service runs", async () => {
    const actor = { userId: crypto.randomUUID(), active: false };
    const prepared = context(actor);
    const authGuard = { canActivate: vi.fn(async () => true) };
    const guard = new ResearchExperimentsPolicyGuard(authGuard as never);

    await expect(guard.canActivate(prepared.execution)).rejects.toMatchObject({
      code: "RESEARCH_FORBIDDEN",
      messageKey: "errors.research.forbidden",
      status: 403,
    });
  });

  it("allows an active authenticated principal to continue to exact domain authorization", async () => {
    const prepared = context({ userId: crypto.randomUUID(), active: true });
    const authGuard = { canActivate: vi.fn(async () => true) };
    const guard = new ResearchExperimentsPolicyGuard(authGuard as never);

    await expect(guard.canActivate(prepared.execution)).resolves.toBe(true);
  });
});
