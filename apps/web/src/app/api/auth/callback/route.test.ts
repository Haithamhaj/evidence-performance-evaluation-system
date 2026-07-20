import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  failConfiguration: false,
  finishOidcLogin: vi.fn(async () => "new-encrypted-session"),
  oidcTransactionReturnTo: vi.fn(() => "/en/tasks?view=team&layout=board"),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === "evaluation_oidc_transaction" ? { value: "encrypted-transaction" } : undefined,
  })),
}));

vi.mock("../../../../auth/oidc.js", () => ({
  authCookieOptions: (_environment: string, maxAge: number) => ({
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax",
    secure: false,
  }),
  finishOidcLogin: auth.finishOidcLogin,
  OIDC_SESSION_COOKIE: "evaluation_session",
  OIDC_TRANSACTION_COOKIE: "evaluation_oidc_transaction",
  oidcSettings: () => {
    if (auth.failConfiguration) throw new Error("configuration failed");
    return {
      redirectUri: "http://localhost:3000/api/auth/callback",
      postLogoutRedirectUri: "http://localhost:3000/ar",
      sessionSecret: "local-test-session-secret-with-at-least-32-characters",
      environment: "local",
    };
  },
  oidcTransactionReturnTo: auth.oidcTransactionReturnTo,
  safeAuthError: () => ({
    status: 500,
    body: {
      code: "INTERNAL_ERROR",
      messageKey: "errors.internal",
      correlationId: "test-correlation",
    },
  }),
}));

import { OIDC_SESSION_COOKIE, OIDC_TRANSACTION_COOKIE } from "../../../../auth/oidc.js";
import { GET } from "./route.js";

beforeEach(() => {
  auth.failConfiguration = false;
  vi.clearAllMocks();
});

afterEach(() => vi.unstubAllEnvs());

describe("OIDC callback cookie finalization", () => {
  it("clears only the transaction cookie when configuration fails", async () => {
    auth.failConfiguration = true;

    const response = await GET(new Request("http://localhost:3000/api/auth/callback"));

    expect(response.status).toBe(500);
    expect(response.cookies.get(OIDC_TRANSACTION_COOKIE)).toMatchObject({ value: "" });
    expect(response.cookies.get(OIDC_SESSION_COOKIE)).toBeUndefined();
  });

  it("returns to the safe draft route stored in the OIDC transaction", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/auth/callback?code=code&state=state"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/en/tasks?view=team&layout=board",
    );
    expect(auth.oidcTransactionReturnTo).toHaveBeenCalledWith(
      expect.objectContaining({ redirectUri: "http://localhost:3000/api/auth/callback" }),
      "encrypted-transaction",
    );
    expect(response.cookies.get(OIDC_SESSION_COOKIE)).toMatchObject({
      value: "new-encrypted-session",
    });
  });
});
