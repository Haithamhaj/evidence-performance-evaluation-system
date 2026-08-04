import { beforeEach, describe, expect, it, vi } from "vitest";

const transactionCookies = vi.hoisted(() => new Map<string, string>());
const auth = vi.hoisted(() => ({
  finishOidcLogin: vi.fn(async (_settings: unknown, _callback: URL, transaction: string) => {
    if (transaction.length === 0) throw new Error("missing transaction");
    return "new-encrypted-session";
  }),
  oidcTransactionReturnTo: vi.fn((_settings: unknown, transaction: string) => {
    if (transaction.length === 0) throw new Error("missing transaction");
    return "/en/tasks";
  }),
  states: ["state-a", "state-b"] as string[],
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const value = transactionCookies.get(name);
      return value === undefined ? undefined : { value };
    },
  })),
}));

vi.mock("../../../auth/oidc.js", () => ({
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
  oidcSettings: () => ({
    redirectUri: "http://localhost:3000/api/auth/callback",
    postLogoutRedirectUri: "http://localhost:3000/ar",
    sessionSecret: "local-test-session-secret-with-at-least-32-characters",
    environment: "local",
  }),
  oidcTransactionCookieName: (state: string | null) =>
    state === null ? undefined : `evaluation_oidc_transaction_${state}`,
  oidcTransactionReturnTo: auth.oidcTransactionReturnTo,
  safeAuthError: () => ({
    status: 401,
    body: {
      code: "AUTH_INVALID_SESSION",
      messageKey: "errors.auth.invalidSession",
      correlationId: "test-correlation",
    },
  }),
  safeOidcReturnPath: (_settings: unknown, candidate?: string) => candidate ?? "/ar",
  startOidcLogin: vi.fn(async () => {
    const state = auth.states.shift();
    if (state === undefined) throw new Error("missing test OIDC state");
    return {
      authorizationUrl: new URL(`http://issuer.example/authorize?state=${state}`),
      state,
      transactionCookie: `encrypted-${state}`,
    };
  }),
}));

import { GET as callback } from "./callback/route.js";
import { GET as login } from "./login/route.js";

beforeEach(() => {
  auth.states = ["state-a", "state-b"];
  transactionCookies.clear();
  vi.clearAllMocks();
});

describe("OIDC transaction cookie isolation", () => {
  it("keeps concurrent login transactions available to their matching callbacks", async () => {
    const loginA = await login(new Request("http://localhost:3000/api/auth/login"));
    const loginB = await login(new Request("http://localhost:3000/api/auth/login"));
    const cookieA = "evaluation_oidc_transaction_state-a";
    const cookieB = "evaluation_oidc_transaction_state-b";

    expect(loginA.status).toBe(307);
    expect(loginB.status).toBe(307);
    expect(loginA.cookies.get(cookieA)).toMatchObject({ value: "encrypted-state-a" });
    expect(loginB.cookies.get(cookieB)).toMatchObject({ value: "encrypted-state-b" });
    expect(cookieA).not.toBe(cookieB);
    transactionCookies.set(cookieA, "encrypted-state-a");
    transactionCookies.set(cookieB, "encrypted-state-b");

    const callbackA = await callback(
      new Request("http://localhost:3000/api/auth/callback?code=code-a&state=state-a"),
    );

    expect(auth.finishOidcLogin).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.any(URL),
      "encrypted-state-a",
    );
    expect(callbackA.cookies.get(cookieA)).toMatchObject({ value: "" });
    expect(callbackA.cookies.get(cookieB)).toBeUndefined();

    const callbackB = await callback(
      new Request("http://localhost:3000/api/auth/callback?code=code-b&state=state-b"),
    );

    expect(auth.finishOidcLogin).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.any(URL),
      "encrypted-state-b",
    );
    expect(callbackB.cookies.get(cookieB)).toMatchObject({ value: "" });
  });

  it("fails closed without clearing another login transaction when state is missing or mismatched", async () => {
    const cookieA = "evaluation_oidc_transaction_state-a";
    transactionCookies.set(cookieA, "encrypted-state-a");

    const missingState = await callback(
      new Request("http://localhost:3000/api/auth/callback?code=code-a"),
    );
    const mismatchedState = await callback(
      new Request("http://localhost:3000/api/auth/callback?code=code-b&state=state-b"),
    );

    expect(missingState.status).toBe(401);
    expect(missingState.cookies.get(cookieA)).toBeUndefined();
    expect(mismatchedState.status).toBe(401);
    expect(mismatchedState.cookies.get(cookieA)).toBeUndefined();
    expect(mismatchedState.cookies.get("evaluation_oidc_transaction_state-b")).toMatchObject({
      value: "",
    });
  });
});
