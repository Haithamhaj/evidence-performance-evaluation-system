import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OIDC_SESSION_COOKIE, sealAuthCookie } from "../../../../auth/oidc.js";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookies: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));

import { GET } from "./route.js";

const secret = "local-test-session-secret-with-at-least-32-characters";
const projectId = "11111111-1111-4111-8111-111111111111";
const departmentId = "22222222-2222-4222-8222-222222222222";
const ownerId = "33333333-3333-4333-8333-333333333333";
const projectWorkspace = {
  project: {
    id: projectId,
    departmentId,
    name: "Project",
    description: "Description",
    status: "active",
    version: 1,
    primaryOwnerId: ownerId,
  },
  people: [],
  workstreams: [],
};
const criteria = {
  proposal: null,
  activeSet: null,
  replacementRequest: null,
  allowedActions: ["generate"],
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
  mocks.cookies.mockResolvedValue({ get: mocks.cookieGet });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("composed workspace response boundary", () => {
  it("returns a schema-validated project screen without browser-visible tokens", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(projectWorkspace)))
      .mockResolvedValueOnce(new Response("null"))
      .mockResolvedValueOnce(new Response(JSON.stringify(criteria)));

    const response = await GET(
      new Request(`http://localhost:3000/api/workspace/projects/${projectId}`),
      { params: Promise.resolve({ path: ["projects", projectId] }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      workspace: projectWorkspace,
      document: null,
      readiness: null,
      criteria,
    });
    expect(JSON.stringify(body)).not.toMatch(/access-token|id-token/u);
  });

  it("fails closed when an upstream response adds a token-shaped field", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...projectWorkspace,
            project: { ...projectWorkspace.project, accessToken: "access-token" },
          }),
        ),
      )
      .mockResolvedValueOnce(new Response("null"))
      .mockResolvedValueOnce(new Response(JSON.stringify(criteria)));

    const response = await GET(
      new Request(`http://localhost:3000/api/workspace/projects/${projectId}`),
      { params: Promise.resolve({ path: ["projects", projectId] }) },
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      status: 503,
      messageKey: "errors.internal",
      correlationId: expect.any(String),
    });
    expect(JSON.stringify(body)).not.toContain("access-token");
  });
});
