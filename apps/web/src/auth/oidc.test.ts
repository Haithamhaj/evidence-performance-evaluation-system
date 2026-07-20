import { describe, expect, it } from "vitest";

import {
  authCookieOptions,
  canonicalOidcCallbackUrl,
  oidcTransactionReturnTo,
  openAuthCookie,
  safeOidcReturnPath,
  sealAuthCookie,
  sessionAccessToken,
} from "./oidc.js";

const secret = "local-test-session-secret-with-at-least-32-characters";
const settings = {
  issuer: "http://127.0.0.1:8081/realms/evaluation",
  clientId: "evaluation-web",
  audience: "evaluation-api",
  redirectUri: "http://localhost:3000/api/auth/callback",
  postLogoutRedirectUri: "http://localhost:3000/ar",
  sessionSecret: secret,
  environment: "local",
};

describe("encrypted OIDC browser cookies", () => {
  it("uses the configured external redirect URI when the server normalizes the request host", () => {
    const configured = {
      ...settings,
      redirectUri: "http://127.0.0.1:3300/api/auth/callback",
    };

    expect(
      canonicalOidcCallbackUrl(
        configured,
        new URL("http://localhost:3300/api/auth/callback?code=code&state=state"),
      ).toString(),
    ).toBe("http://127.0.0.1:3300/api/auth/callback?code=code&state=state");
    expect(() =>
      canonicalOidcCallbackUrl(
        configured,
        new URL("http://localhost:3300/api/auth/not-callback?code=code&state=state"),
      ),
    ).toThrow(expect.objectContaining({ code: "AUTH_INVALID_SESSION" }));
  });

  it("encrypts state and rejects tampering", () => {
    const value = sealAuthCookie(
      { expiresAt: Date.now() + 60_000, kind: "transaction", nonce: "nonce", state: "state" },
      secret,
    );

    expect(value).not.toContain("nonce");
    expect(value).not.toContain("state");
    expect(openAuthCookie(value, secret, "transaction")).toMatchObject({
      nonce: "nonce",
      state: "state",
    });
    const parts = value.split(".");
    const ciphertext = Buffer.from(parts[2] ?? "", "base64url");
    ciphertext[0] = (ciphertext[0] ?? 0) ^ 1;
    const tampered = [parts[0], parts[1], ciphertext.toString("base64url")].join(".");
    expect(() => openAuthCookie(tampered, secret, "transaction")).toThrow();
  });

  it("rejects expired and cross-purpose cookies", () => {
    const value = sealAuthCookie(
      { expiresAt: Date.now() - 1, kind: "transaction", nonce: "nonce", state: "state" },
      secret,
    );

    expect(() => openAuthCookie(value, secret, "transaction")).toThrow();
    expect(() => openAuthCookie(value, secret, "session")).toThrow();
  });

  it("uses HttpOnly Lax cookies and Secure outside local", () => {
    expect(authCookieOptions("local", 300)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    });
    expect(authCookieOptions("production", 300)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
    });
  });

  it("allows only localized same-origin return paths", () => {
    expect(safeOidcReturnPath(settings, "/en/tasks?view=team&layout=board")).toBe(
      "/en/tasks?view=team&layout=board",
    );
    expect(safeOidcReturnPath(settings, "https://evil.example/steal")).toBe("/ar");
    expect(safeOidcReturnPath(settings, "//evil.example/steal")).toBe("/ar");
    expect(safeOidcReturnPath(settings, "/api/auth/callback")).toBe("/ar");
    expect(safeOidcReturnPath(settings, "/projects/internal")).toBe("/ar");
  });

  it("reads the validated return path only from the encrypted OIDC transaction", () => {
    const transaction = sealAuthCookie(
      {
        kind: "transaction",
        expiresAt: Date.now() + 60_000,
        codeVerifier: "verifier",
        nonce: "nonce",
        state: "state",
        returnTo: "/en/tasks?view=team&layout=board",
      },
      secret,
    );

    expect(oidcTransactionReturnTo(settings, transaction)).toBe("/en/tasks?view=team&layout=board");
  });

  it("returns only the non-empty access token from a valid encrypted session", () => {
    const encryptedSession = sealAuthCookie(
      {
        kind: "session",
        expiresAt: Date.now() + 60_000,
        accessToken: "access-token",
        idToken: "id-token",
      },
      secret,
    );

    expect(sessionAccessToken(encryptedSession, settings)).toBe("access-token");
  });

  it.each([
    {
      name: "expired",
      payload: {
        kind: "session" as const,
        expiresAt: Date.now() - 1,
        accessToken: "access-token",
      },
    },
    {
      name: "wrong-kind",
      payload: {
        kind: "transaction" as const,
        expiresAt: Date.now() + 60_000,
        accessToken: "access-token",
      },
    },
    {
      name: "empty-token",
      payload: {
        kind: "session" as const,
        expiresAt: Date.now() + 60_000,
        accessToken: "  ",
      },
    },
  ])("rejects a $name cookie without exposing its payload", ({ payload }) => {
    const encryptedSession = sealAuthCookie(payload, secret);

    expect(() => sessionAccessToken(encryptedSession, settings)).toThrow(
      expect.objectContaining({ code: "AUTH_INVALID_SESSION" }),
    );
  });

  it("rejects a tampered session cookie", () => {
    const encryptedSession = sealAuthCookie(
      {
        kind: "session",
        expiresAt: Date.now() + 60_000,
        accessToken: "access-token",
      },
      secret,
    );
    const parts = encryptedSession.split(".");
    const ciphertext = Buffer.from(parts[2] ?? "", "base64url");
    ciphertext[0] = (ciphertext[0] ?? 0) ^ 1;
    const tampered = [parts[0], parts[1], ciphertext.toString("base64url")].join(".");

    expect(() => sessionAccessToken(tampered, settings)).toThrow(
      expect.objectContaining({ code: "AUTH_INVALID_SESSION" }),
    );
  });
});
