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

import { fetchEvaluationFactView } from "./evaluation-fact-view-api.js";

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.INTERNAL_API_BASE_URL = "http://127.0.0.1:3001";
  process.env.APP_ENV = "local";
  mocks.cookies.mockResolvedValue({ get: vi.fn(() => ({ value: "encrypted" })) });
  mocks.oidcSettings.mockReturnValue({ redirectUri: "http://localhost:3000/api/auth/callback" });
  mocks.sessionAccessToken.mockReturnValue("access-token");
});

describe("fetchEvaluationFactView", () => {
  it("calls the protected cycle and employee route with validated identifiers", async () => {
    const cycleId = crypto.randomUUID();
    const employeeId = crypto.randomUUID();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: 1,
          cycle: {
            id: cycleId,
            startsAt: "2026-07-01T00:00:00.000Z",
            endsAt: "2026-09-30T23:59:59.999Z",
            rubricVersionId: crypto.randomUUID(),
          },
          subjectEmployeeId: employeeId,
          generatedAt: "2026-10-01T08:00:00.000Z",
          responsibilityWindows: [],
          projectFacts: [],
          confirmedEvidence: [],
          checkInFacts: [],
          dynamicCriteriaVersions: [],
          employeeInterpretations: [],
          sourceCoverageNotes: [],
        }),
        { status: 200 },
      ),
    );

    await fetchEvaluationFactView({ cycleId, employeeId, locale: "en" });

    expect(fetch).toHaveBeenCalledWith(
      `http://127.0.0.1:3001/api/v1/evaluation-cycles/${cycleId}/employees/${employeeId}/facts`,
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer access-token" }),
      }),
    );
  });

  it("rejects invalid identifiers before sending a request", async () => {
    const request = vi.spyOn(globalThis, "fetch");
    await expect(
      fetchEvaluationFactView({ cycleId: "invalid", employeeId: "invalid", locale: "en" }),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});
