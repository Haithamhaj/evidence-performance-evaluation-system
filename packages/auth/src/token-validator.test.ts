import { exportJWK, generateKeyPair, importJWK, SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";

import { validateAccessToken } from "./index.js";

const issuer = "http://localhost:8081/realms/evaluation";
const audience = "evaluation-api";
const now = Math.floor(Date.now() / 1000);
let privateKey: CryptoKey;
let publicJwk: import("jose").JWK;

beforeAll(async () => {
  const keys = await generateKeyPair("RS256", { extractable: true });
  privateKey = keys.privateKey;
  publicJwk = { ...(await exportJWK(keys.publicKey)), alg: "RS256", kid: "local-test-key" };
});

async function token(overrides: Record<string, unknown> = {}): Promise<string> {
  const claims = {
    sub: "oidc-user-1",
    email: "employee@pilot.local",
    email_verified: true,
    iss: issuer,
    aud: audience,
    iat: now,
    exp: now + 300,
    ...overrides,
  };

  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "local-test-key" })
    .sign(privateKey);
}

function validationConfig() {
  return {
    audience,
    issuer,
    jwks: async ({ kid }: { kid?: string }) => {
      if (kid !== publicJwk.kid) throw new Error("unknown signing key");
      return importJWK(publicJwk, "RS256");
    },
  };
}

describe("OIDC access-token validation", () => {
  it("returns only the validated external identity", async () => {
    const principal = await validateAccessToken(await token(), validationConfig());

    expect(principal).toEqual({
      oidcSubject: "oidc-user-1",
      email: "employee@pilot.local",
      issuer: "http://localhost:8081/realms/evaluation",
    });
  });

  it.each([
    ["expired token", { exp: now - 60 }],
    ["wrong issuer", { iss: "https://untrusted.example/realms/evaluation" }],
    ["wrong audience", { aud: "another-api" }],
    ["missing subject", { sub: undefined }],
    ["unverified email", { email_verified: false }],
  ])("rejects an %s with the stable safe error", async (_label, overrides) => {
    await expect(
      validateAccessToken(await token(overrides), validationConfig()),
    ).rejects.toMatchObject({
      code: "AUTH_INVALID_TOKEN",
      messageKey: "errors.auth.invalidToken",
      status: 401,
    });
  });
});
