import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  oidcSettings: vi.fn(),
  sessionAccessToken: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("../auth/oidc", () => ({
  OIDC_SESSION_COOKIE: "evaluation_session",
  oidcSettings: mocks.oidcSettings,
  sessionAccessToken: mocks.sessionAccessToken,
}));

import { fetchDailyWorkUpstream } from "./daily-work-api.js";

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.INTERNAL_API_BASE_URL = "http://127.0.0.1:3001";
  process.env.APP_ENV = "local";
  mocks.cookies.mockResolvedValue({
    get: vi.fn(() => ({ value: "encrypted" })),
  });
  mocks.oidcSettings.mockReturnValue({});
  mocks.sessionAccessToken.mockReturnValue("access-token");
});

describe("fetchDailyWorkUpstream", () => {
  it("calls the protected My Work route without exposing actor input", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ groups: [], nextCursor: null }), { status: 200 }),
    );
    const schema = { parse: (value: unknown) => value };
    await fetchDailyWorkUpstream({ route: { kind: "my_work" }, schema });

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/api/v1/daily-work/my-work",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer access-token" }),
      }),
    );
  });

  it("validates a Project identity before creating the URL", async () => {
    const request = vi.spyOn(globalThis, "fetch");
    await expect(
      fetchDailyWorkUpstream({
        route: { kind: "project", projectId: "not-a-uuid" },
        schema: { parse: (value: unknown) => value },
      }),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});
