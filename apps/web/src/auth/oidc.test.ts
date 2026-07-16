import { describe, expect, it } from "vitest";

import { authCookieOptions, openAuthCookie, sealAuthCookie } from "./oidc.js";

const secret = "local-test-session-secret-with-at-least-32-characters";

describe("encrypted OIDC browser cookies", () => {
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
});
