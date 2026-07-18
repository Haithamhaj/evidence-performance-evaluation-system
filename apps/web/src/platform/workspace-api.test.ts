import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OIDC_SESSION_COOKIE, sealAuthCookie } from "../auth/oidc.js";

const mocks = vi.hoisted(() => ({
  cookieDelete: vi.fn(),
  cookieGet: vi.fn(),
  cookies: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));

import { fetchWorkspaceUpstream, mutateCriteriaUpstream } from "./workspace-api.js";

const secret = "local-test-session-secret-with-at-least-32-characters";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const projectId = "11111111-1111-4111-8111-111111111111";
const workstreamId = "99999999-9999-4999-8999-999999999999";
const documentId = "22222222-2222-4222-8222-222222222222";
const documentVersionId = "33333333-3333-4333-8333-333333333333";
const departmentId = "44444444-4444-4444-8444-444444444444";
const ownerId = "55555555-5555-4555-8555-555555555555";
const templateVersionId = "66666666-6666-4666-8666-666666666666";
const sourceId = "77777777-7777-4777-8777-777777777777";

const projectWorkspace = {
  project: {
    id: projectId,
    departmentId,
    name: "Project",
    description: "Project description",
    status: "active",
    version: 1,
    primaryOwnerId: ownerId,
  },
  people: [],
  workstreams: [],
};
const workstreamWorkspace = {
  workstream: {
    id: workstreamId,
    projectId,
    name: "Workstream",
    description: "Workstream description",
    status: "active",
    version: 1,
    primaryOwnerId: ownerId,
  },
  people: [],
};

const document = {
  id: documentId,
  kind: "project",
  resourceId: projectId,
  templateVersionId,
  currentVersion: 1,
  createdAt: "2026-07-18T00:00:00.000Z",
  versions: [
    {
      id: documentVersionId,
      documentId,
      version: 1,
      templateVersionId,
      createdById: ownerId,
      reason: "Initial source",
      sources: [
        {
          id: sourceId,
          position: 1,
          sourceType: "external_link",
          url: "https://example.test/project.md",
        },
      ],
      createdAt: "2026-07-18T00:00:00.000Z",
    },
  ],
};

const criteria = {
  proposal: null,
  activeSet: null,
  replacementRequest: null,
  allowedActions: ["generate"],
};

type ProjectScreen = {
  readonly workspace: typeof projectWorkspace;
  readonly document: typeof document | null;
  readonly readiness: unknown;
  readonly criteria: typeof criteria;
};

const projectScreenSchema = {
  parse(value: unknown): ProjectScreen {
    if (typeof value !== "object" || value === null || !("workspace" in value)) {
      throw new Error("invalid project screen");
    }
    return value as ProjectScreen;
  },
};

const identitySchema = {
  parse(value: unknown): { readonly projects: readonly string[] } {
    if (
      typeof value !== "object" ||
      value === null ||
      !Array.isArray((value as { projects?: unknown }).projects)
    ) {
      throw new Error("invalid workspace response");
    }
    return value as { readonly projects: readonly string[] };
  },
};

beforeEach(() => {
  vi.stubEnv("APP_ENV", "local");
  vi.stubEnv("INTERNAL_API_BASE_URL", "http://127.0.0.1:3001");
  vi.stubEnv("OIDC_ISSUER", "http://127.0.0.1:8081/realms/evaluation");
  vi.stubEnv("OIDC_AUDIENCE", "evaluation-api");
  vi.stubEnv("OIDC_CLIENT_ID", "evaluation-web");
  vi.stubEnv("APP_BASE_URL", "http://localhost:3000");
  vi.stubEnv("OIDC_SESSION_SECRET", secret);

  const encryptedSession = sealAuthCookie(
    {
      kind: "session",
      expiresAt: Date.now() + 60_000,
      accessToken: "access-token",
      idToken: "id-token",
    },
    secret,
  );
  mocks.cookieGet.mockImplementation((name: string) =>
    name === OIDC_SESSION_COOKIE ? { value: encryptedSession } : undefined,
  );
  mocks.cookies.mockResolvedValue({
    get: mocks.cookieGet,
    delete: mocks.cookieDelete,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("server-only workspace upstream", () => {
  it("builds the approved project-list URL and keeps the bearer token server-only", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ projects: ["project-1"] })));

    const result = await fetchWorkspaceUpstream({
      route: { kind: "projects" },
      schema: identitySchema,
    });

    expect(result).toEqual({ projects: ["project-1"] });
    expect(JSON.stringify(result)).not.toContain("access-token");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/api/v1/projects",
      expect.objectContaining({
        cache: "no-store",
        method: "GET",
        headers: expect.objectContaining({
          authorization: "Bearer access-token",
          "x-correlation-id": expect.stringMatching(UUID_PATTERN),
        }),
      }),
    );
  });

  it("maps authorization failure to a redacted safe error without mutating cookies", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Bearer access-token" }), { status: 401 }),
    );

    const failure = await fetchWorkspaceUpstream({
      route: { kind: "projects" },
      schema: identitySchema,
    }).catch((error: unknown) => error);

    expect(failure).toMatchObject({
      status: 401,
      messageKey: "errors.unauthorized",
      correlationId: expect.stringMatching(UUID_PATTERN),
    });
    expect(JSON.stringify(failure)).not.toContain("access-token");
    expect(mocks.cookieDelete).not.toHaveBeenCalled();
  });

  it("fails closed on malformed upstream JSON with only a correlation reference", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not-json", {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );

    const failure = await fetchWorkspaceUpstream({
      route: { kind: "projects" },
      schema: identitySchema,
    }).catch((error: unknown) => error);

    expect(failure).toMatchObject({
      status: 503,
      messageKey: "errors.internal",
      correlationId: expect.stringMatching(UUID_PATTERN),
    });
    expect(JSON.stringify(failure)).not.toContain("not-json");
  });

  it("requires a loopback HTTP base locally and HTTPS otherwise", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    vi.stubEnv("INTERNAL_API_BASE_URL", "http://evil.example");
    await expect(
      fetchWorkspaceUpstream({ route: { kind: "projects" }, schema: identitySchema }),
    ).rejects.toMatchObject({ status: 500, messageKey: "errors.internal" });

    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("INTERNAL_API_BASE_URL", "http://127.0.0.1:3001");
    await expect(
      fetchWorkspaceUpstream({ route: { kind: "projects" }, schema: identitySchema }),
    ).rejects.toMatchObject({ status: 500, messageKey: "errors.internal" });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redacts invalid server authentication configuration", async () => {
    vi.stubEnv("OIDC_SESSION_SECRET", "");

    const failure = await fetchWorkspaceUpstream({
      route: { kind: "projects" },
      schema: identitySchema,
    }).catch((error: unknown) => error);

    expect(failure).toMatchObject({ status: 500, messageKey: "errors.internal" });
    expect(JSON.stringify(failure)).not.toContain("OIDC_SESSION_SECRET");
  });

  it("composes only the approved project endpoints and skips readiness without a document", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(projectWorkspace)))
      .mockResolvedValueOnce(new Response("null"))
      .mockResolvedValueOnce(new Response(JSON.stringify(criteria)));

    const result = await fetchWorkspaceUpstream({
      route: { kind: "project", projectId },
      schema: projectScreenSchema,
    });

    expect(result).toEqual({
      workspace: projectWorkspace,
      document: null,
      readiness: null,
      criteria,
    });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `http://127.0.0.1:3001/api/v1/projects/${projectId}/workspace`,
      `http://127.0.0.1:3001/api/v1/documents/resource?kind=project&resourceId=${projectId}`,
      `http://127.0.0.1:3001/api/v1/dynamic-criteria/workspace?kind=project&resourceId=${projectId}`,
    ]);
  });

  it("falls back to manager operational readiness only on detail authorization denial", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(projectWorkspace)))
      .mockResolvedValueOnce(new Response(JSON.stringify(document)))
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ state: "needs_attention" })))
      .mockResolvedValueOnce(new Response(JSON.stringify(criteria)));

    const result = await fetchWorkspaceUpstream({
      route: { kind: "project", projectId },
      schema: projectScreenSchema,
    });

    expect(result.readiness).toEqual({
      audience: "manager",
      state: "needs_attention",
    });
    expect(JSON.stringify(result.readiness)).not.toMatch(
      /missingItems|percentage|rank|correctionInstruction/u,
    );
    expect(fetchMock.mock.calls.map(([url]) => url)).toContain(
      `http://127.0.0.1:3001/api/v1/documents/${documentId}/readiness-checks/latest/operational-state`,
    );
  });

  it("returns no readiness when a manager can access the document before its first check", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(projectWorkspace)))
      .mockResolvedValueOnce(new Response(JSON.stringify(document)))
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(criteria)));

    const result = await fetchWorkspaceUpstream({
      route: { kind: "project", projectId },
      schema: projectScreenSchema,
    });

    expect(result.readiness).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("does not use the manager readiness fallback for non-authorization failures", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(projectWorkspace)))
      .mockResolvedValueOnce(new Response(JSON.stringify(document)))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));

    await expect(
      fetchWorkspaceUpstream({
        route: { kind: "project", projectId },
        schema: projectScreenSchema,
      }),
    ).rejects.toMatchObject({ status: 500, messageKey: "errors.internal" });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain(
      `http://127.0.0.1:3001/api/v1/documents/${documentId}/readiness-checks/latest/operational-state`,
    );
  });

  it("composes the exact workstream endpoints without forwarding arbitrary paths", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(workstreamWorkspace)))
      .mockResolvedValueOnce(new Response("null"))
      .mockResolvedValueOnce(new Response(JSON.stringify(criteria)));

    await fetchWorkspaceUpstream({
      route: { kind: "workstream", projectId, workstreamId },
      schema: projectScreenSchema,
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `http://127.0.0.1:3001/api/v1/projects/${projectId}/workstreams/${workstreamId}/workspace`,
      `http://127.0.0.1:3001/api/v1/documents/resource?kind=workstream&resourceId=${workstreamId}`,
      `http://127.0.0.1:3001/api/v1/dynamic-criteria/workspace?kind=workstream&resourceId=${workstreamId}`,
    ]);
  });

  it("falls back to the authorized frozen criteria snapshot without workspace or document data", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(criteria)));

    const result = await fetchWorkspaceUpstream({
      route: { kind: "workstream", projectId, workstreamId },
      schema: projectScreenSchema,
    });

    expect(result).toEqual({
      workspace: null,
      document: null,
      readiness: null,
      criteria,
    });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `http://127.0.0.1:3001/api/v1/projects/${projectId}/workstreams/${workstreamId}/workspace`,
      `http://127.0.0.1:3001/api/v1/dynamic-criteria/workspace?kind=workstream&resourceId=${workstreamId}`,
    ]);
  });

  it("keeps the criteria-only fallback forbidden when the frozen snapshot endpoint denies access", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(new Response(null, { status: 403 }));

    await expect(
      fetchWorkspaceUpstream({
        route: { kind: "workstream", projectId, workstreamId },
        schema: projectScreenSchema,
      }),
    ).rejects.toMatchObject({ status: 403, messageKey: "errors.forbidden" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a manager operational response containing participant detail", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(projectWorkspace)))
      .mockResolvedValueOnce(new Response(JSON.stringify(document)))
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            state: "needs_attention",
            missingItems: [{ correctionInstruction: "private correction" }],
          }),
        ),
      );

    await expect(
      fetchWorkspaceUpstream({
        route: { kind: "project", projectId },
        schema: projectScreenSchema,
      }),
    ).rejects.toMatchObject({ status: 503, messageKey: "errors.internal" });
  });

  it.each([
    ["generate", { kind: "generate" }, "/api/v1/dynamic-criteria/proposals"],
    [
      "owner review",
      { kind: "owner_review", proposalId: sourceId },
      `/api/v1/dynamic-criteria/${sourceId}/owner-reviews`,
    ],
    [
      "publish",
      { kind: "publish", proposalId: sourceId },
      `/api/v1/dynamic-criteria/${sourceId}/publish`,
    ],
    [
      "respond",
      { kind: "respond", proposalId: sourceId },
      `/api/v1/dynamic-criteria/${sourceId}/responses`,
    ],
    [
      "manager resolve",
      { kind: "manager_resolve", proposalId: sourceId },
      `/api/v1/dynamic-criteria/${sourceId}/manager-resolutions`,
    ],
    [
      "activate",
      { kind: "activate", proposalId: sourceId },
      `/api/v1/dynamic-criteria/${sourceId}/activate`,
    ],
  ] as const)("posts only to the exact %s mutation path", async (_name, route, path) => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ignored: true }), {
        headers: { "content-type": "application/json" },
      }),
    );

    await mutateCriteriaUpstream({ route, body: { reason: "Approved reason" } });

    expect(fetchMock).toHaveBeenCalledWith(
      `http://127.0.0.1:3001${path}`,
      expect.objectContaining({
        cache: "no-store",
        method: "POST",
        body: JSON.stringify({ reason: "Approved reason" }),
        headers: expect.objectContaining({
          authorization: "Bearer access-token",
          "content-type": "application/json",
        }),
      }),
    );
  });

  it("rejects a malformed proposal mutation identity before fetch", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      mutateCriteriaUpstream({
        route: { kind: "respond", proposalId: "not-a-uuid" },
        body: { action: "acknowledge" },
      }),
    ).rejects.toMatchObject({ status: 404, messageKey: "errors.notFound" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
