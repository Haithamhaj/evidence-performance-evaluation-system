import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  oidcSettings: vi.fn(),
  redirect: vi.fn(),
  sessionAccessToken: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../auth/oidc", () => ({
  OIDC_SESSION_COOKIE: "evaluation_session",
  oidcSettings: mocks.oidcSettings,
  sessionAccessToken: mocks.sessionAccessToken,
}));

import { fetchDailyWorkUpstream, WebDailyWorkspaceSnapshotSchema } from "./daily-work-api.js";

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.INTERNAL_API_BASE_URL = "http://127.0.0.1:3001";
  process.env.APP_ENV = "local";
  mocks.cookies.mockResolvedValue({
    get: vi.fn(() => ({ value: "encrypted" })),
  });
  mocks.oidcSettings.mockReturnValue({
    redirectUri: "http://localhost:3000/api/auth/callback",
  });
  mocks.redirect.mockImplementation(() => {
    throw new Error("NEXT_REDIRECT");
  });
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

  it("rejects scoring fields in the daily workspace response", () => {
    expect(() =>
      WebDailyWorkspaceSnapshotSchema.parse({
        needsMyAction: [],
        today: [],
        overdue: [],
        reviewQueue: [],
        inbox: [],
        projectPulse: [],
        upcoming: [],
        readinessPercentage: 90,
      }),
    ).toThrow();
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

  it("loads the authorized Update context without caller-supplied scope", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ projects: [] }), { status: 200 }),
    );

    await fetchDailyWorkUpstream({
      route: { kind: "update_context" },
      schema: { parse: (value: unknown) => value },
    });

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/api/v1/daily-work/update-context",
      expect.any(Object),
    );
  });

  it("loads the current identity for account-scoped local drafts", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ userId: crypto.randomUUID() }), { status: 200 }),
    );

    await fetchDailyWorkUpstream({
      route: { kind: "me" },
      schema: { parse: (value: unknown) => value },
    });

    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:3001/api/v1/me", expect.any(Object));
  });

  it("redirects an expired browser session to login instead of rendering a server error", async () => {
    const request = vi.spyOn(globalThis, "fetch");
    mocks.sessionAccessToken.mockImplementation(() => {
      throw new Error("AUTH_INVALID_SESSION");
    });

    await expect(
      fetchDailyWorkUpstream({
        route: { kind: "my_work" },
        reauthenticateTo: "/en/tasks?view=team&layout=board",
        schema: { parse: (value: unknown) => value },
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.redirect).toHaveBeenCalledWith(
      "/api/auth/login?returnTo=%2Fen%2Ftasks%3Fview%3Dteam%26layout%3Dboard",
    );
    expect(request).not.toHaveBeenCalled();
  });
});
