import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchProtectedUpstream: vi.fn(),
  fetchWorkspaceUpstream: vi.fn(),
}));

vi.mock("../../../../platform/workspace-api.js", () => ({
  fetchProtectedUpstream: mocks.fetchProtectedUpstream,
  fetchWorkspaceUpstream: mocks.fetchWorkspaceUpstream,
  safeWorkspaceError: (error: unknown) => error,
}));

import { DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT } from "./route.js";

const projectId = "11111111-1111-4111-8111-111111111111";
const workstreamId = "22222222-2222-4222-8222-222222222222";

afterEach(() => vi.clearAllMocks());

describe("same-origin workspace GET allowlist", () => {
  it("forwards an approved private connected-context request server-side", async () => {
    mocks.fetchProtectedUpstream.mockResolvedValue({
      mode: "synthetic",
      synthetic: true,
      items: [],
    });

    const response = await GET(
      new Request("http://localhost:3000/api/workspace/connected-work/items"),
      {
        params: Promise.resolve({ path: ["connected-work", "items"] }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      mode: "synthetic",
      synthetic: true,
      items: [],
    });
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GET", path: "/api/v1/connected-work/items" }),
    );
  });

  it("forwards only the approved synthetic connection callback fields", async () => {
    mocks.fetchProtectedUpstream.mockResolvedValue({
      mode: "synthetic",
      synthetic: true,
      connected: true,
      synchronizedProviders: ["GOOGLE_GMAIL", "GOOGLE_CALENDAR"],
    });
    const response = await GET(
      new Request(
        "http://localhost:3000/api/workspace/connected-work/google/callback?state=a&nonce=b&redirectUri=http%3A%2F%2Flocalhost%3A3000%2Fsettings%2Fconnections",
      ),
      { params: Promise.resolve({ path: ["connected-work", "google", "callback"] }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.fetchProtectedUpstream).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/api/v1/connected-work/google/callback?state=a&nonce=b&redirectUri=http%3A%2F%2Flocalhost%3A3000%2Fsettings%2Fconnections",
      }),
    );
  });

  it.each([
    {
      path: ["projects"],
      url: "http://localhost:3000/api/workspace/projects",
      route: { kind: "projects" },
    },
    {
      path: ["projects", projectId],
      url: `http://localhost:3000/api/workspace/projects/${projectId}`,
      route: { kind: "project", projectId },
    },
    {
      path: ["projects", projectId, "workstreams", workstreamId],
      url: `http://localhost:3000/api/workspace/projects/${projectId}/workstreams/${workstreamId}`,
      route: { kind: "workstream", projectId, workstreamId },
    },
  ])("allows only $url", async ({ path, route, url }) => {
    mocks.fetchWorkspaceUpstream.mockResolvedValue({ safe: true });

    const response = await GET(new Request(url), {
      params: Promise.resolve({ path }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ safe: true });
    expect(mocks.fetchWorkspaceUpstream).toHaveBeenCalledOnce();
    expect(mocks.fetchWorkspaceUpstream).toHaveBeenCalledWith(expect.objectContaining({ route }));
  });

  it.each([
    {
      name: "query",
      path: ["projects"],
      url: "http://localhost:3000/api/workspace/projects?path=https://evil.example",
    },
    {
      name: "encoded slash",
      path: ["https:/evil.example"],
      url: "http://localhost:3000/api/workspace/https:%2F%2Fevil.example",
    },
    {
      name: "invalid project UUID",
      path: ["projects", "not-a-uuid"],
      url: "http://localhost:3000/api/workspace/projects/not-a-uuid",
    },
    {
      name: "unapproved child route",
      path: ["projects", projectId, "documents"],
      url: `http://localhost:3000/api/workspace/projects/${projectId}/documents`,
    },
    {
      name: "dot segment",
      path: ["projects", ".."],
      url: "http://localhost:3000/api/workspace/projects/%2E%2E",
    },
  ])("returns 404 without upstream access for $name", async ({ path, url }) => {
    const response = await GET(new Request(url), {
      params: Promise.resolve({ path }),
    });

    expect(response.status).toBe(404);
    expect(mocks.fetchWorkspaceUpstream).not.toHaveBeenCalled();
  });

  it.each([
    ["POST", POST],
    ["PUT", PUT],
    ["PATCH", PATCH],
    ["DELETE", DELETE],
    ["HEAD", HEAD],
    ["OPTIONS", OPTIONS],
  ] as const)("rejects %s without upstream access", async (method, handler) => {
    const response = await handler(
      new Request("http://localhost:3000/api/workspace/projects", { method }),
    );

    expect(response.status).toBe(404);
    expect(mocks.fetchWorkspaceUpstream).not.toHaveBeenCalled();
  });
});
