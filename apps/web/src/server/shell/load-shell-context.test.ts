import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { loadShellContext, ShellContextLoadError } from "./load-shell-context.js";

describe("loadShellContext", () => {
  it("loads and validates the authorized /me principal without exposing credentials", async () => {
    const result = await loadShellContext(async () => ({
      accessToken: "must-not-project",
      active: true,
      email: "manager@example.invalid",
      oidcSubject: "subject",
      roles: ["manager"],
      userId: "00000000-0000-4000-8000-000000000001",
    }));

    expect(result).toEqual({
      principal: {
        active: true,
        roles: ["manager"],
        userId: "00000000-0000-4000-8000-000000000001",
      },
    });
    expect(result).not.toHaveProperty("accessToken");
  });

  it("fails closed when the principal is inactive or malformed", async () => {
    await expect(
      loadShellContext(async () => ({
        active: false,
        roles: [],
        userId: "not-a-uuid",
      })),
    ).rejects.toBeInstanceOf(ShellContextLoadError);
  });

  it("keeps only a safe correlation id when loading fails", async () => {
    const failure = Object.assign(new Error("Bearer secret-token"), {
      correlationId: "00000000-0000-4000-8000-000000000007",
    });

    await expect(loadShellContext(async () => Promise.reject(failure))).rejects.toMatchObject({
      code: "SHELL_CONTEXT_UNAVAILABLE",
      correlationId: "00000000-0000-4000-8000-000000000007",
    });
  });
});
