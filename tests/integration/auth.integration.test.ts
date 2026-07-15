import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "../../packages/database/src/index.js";
import {
  remoteAccessTokenValidationConfig,
  validateAccessToken,
} from "../../packages/auth/src/index.js";
import {
  finishOidcLogin,
  endSessionUrl,
  oidcSettings,
  openAuthCookie,
  sealAuthCookie,
  startOidcLogin,
} from "../../apps/web/src/auth/oidc.js";

const issuer = process.env.OIDC_ISSUER ?? "http://127.0.0.1:8081/realms/evaluation";
const keycloakBaseUrl = new URL(issuer).origin;
const realmAdminUrl = `${keycloakBaseUrl}/admin/realms/evaluation`;
const username = `auth-integration-${crypto.randomUUID()}`;
const email = `${username}@pilot.local`;
const password = `Integration-${crypto.randomUUID()}-Password`;
const wrongAudienceClientId = `wrong-audience-${crypto.randomUUID()}`;
const expiringClientId = `expiring-${crypto.randomUUID()}`;
const sessionSecret = "integration-only-session-secret-with-more-than-32-characters";

let adminAccessToken = "";
let userId = "";
const clientIds: string[] = [];
let apiProcess: import("node:child_process").ChildProcessWithoutNullStreams | undefined;
const apiOutput: string[] = [];
const apiBaseUrl = "http://127.0.0.1:3000";
let validAccessToken = "";
let validEncryptedSession = "";
const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

function adminHeaders(): HeadersInit {
  return { authorization: `Bearer ${adminAccessToken}`, "content-type": "application/json" };
}

async function adminToken(passwordOverride?: string): Promise<Response> {
  return fetch(`${keycloakBaseUrl}/realms/master/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: "admin-cli",
      grant_type: "password",
      username: process.env.KEYCLOAK_ADMIN_USERNAME ?? "",
      password: passwordOverride ?? process.env.KEYCLOAK_ADMIN_PASSWORD ?? "",
    }),
  });
}

async function createRealmClient(
  clientId: string,
  options: { audience: boolean; lifespan?: number },
) {
  const protocolMappers = options.audience
    ? [
        {
          name: "evaluation-api-audience",
          protocol: "openid-connect",
          protocolMapper: "oidc-audience-mapper",
          consentRequired: false,
          config: {
            "included.client.audience": "evaluation-api",
            "id.token.claim": "false",
            "access.token.claim": "true",
            "lightweight.claim": "false",
          },
        },
      ]
    : [];
  const response = await fetch(`${realmAdminUrl}/clients`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      clientId,
      enabled: true,
      protocol: "openid-connect",
      publicClient: true,
      standardFlowEnabled: false,
      directAccessGrantsEnabled: true,
      serviceAccountsEnabled: false,
      attributes:
        options.lifespan === undefined ? {} : { "access.token.lifespan": String(options.lifespan) },
      protocolMappers,
    }),
  });
  expect(response.status).toBe(201);
  const location = response.headers.get("location");
  expect(location).not.toBeNull();
  const internalId = location?.split("/").at(-1);
  expect(internalId).toBeTruthy();
  clientIds.push(internalId ?? "");
}

async function passwordGrant(clientId: string, suppliedPassword: string): Promise<Response> {
  return fetch(`${issuer}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "password",
      scope: "openid email profile",
      username,
      password: suppliedPassword,
    }),
  });
}

function mergeSetCookies(target: Map<string, string>, response: Response): void {
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(";", 1)[0];
    const separator = pair?.indexOf("=") ?? -1;
    if (pair !== undefined && separator > 0) target.set(pair.slice(0, separator), pair);
  }
}

function cookieHeader(cookies: Map<string, string>): string {
  return [...cookies.values()].join("; ");
}

function loginAction(html: string): string {
  const match = /<form[^>]+id="kc-form-login"[^>]+action="([^"]+)"/u.exec(html);
  if (match?.[1] === undefined) throw new Error("Keycloak login form action was not found");
  return match[1].replaceAll("&amp;", "&");
}

async function authorizationCallback(
  suppliedPassword: string,
): Promise<{ response: Response; transactionCookie: string }> {
  const settings = oidcSettings({
    APP_BASE_URL: "http://localhost:3000",
    APP_ENV: "local",
    OIDC_AUDIENCE: "evaluation-api",
    OIDC_CLIENT_ID: "evaluation-web",
    OIDC_ISSUER: issuer,
    OIDC_SESSION_SECRET: sessionSecret,
  });
  const login = await startOidcLogin(settings);
  const cookies = new Map<string, string>();
  const form = await fetch(login.authorizationUrl, { redirect: "manual" });
  mergeSetCookies(cookies, form);
  const action = loginAction(await form.text());
  const response = await fetch(action, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader(cookies),
    },
    body: new URLSearchParams({ username, password: suppliedPassword, credentialId: "" }),
  });
  return { response, transactionCookie: login.transactionCookie };
}

function jwtExpiration(token: string): number {
  const parsed = jwtPayload(token);
  if (typeof parsed.exp !== "number") throw new Error("JWT expiration is missing");
  return parsed.exp;
}

function jwtPayload(token: string): Record<string, unknown> {
  const payload = token.split(".")[1];
  if (payload === undefined) throw new Error("JWT payload is missing");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
}

async function startApi(): Promise<void> {
  apiProcess = spawn("pnpm", ["exec", "tsx", "apps/api/src/main.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      OIDC_AUDIENCE: "evaluation-api",
      OIDC_ISSUER: issuer,
    },
    stdio: "pipe",
  });
  apiProcess.stdout.on("data", (chunk) => apiOutput.push(String(chunk)));
  apiProcess.stderr.on("data", (chunk) => apiOutput.push(String(chunk)));

  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (apiProcess.exitCode !== null) {
      throw new Error(`API exited before readiness: ${apiOutput.join("").slice(-1_000)}`);
    }
    try {
      const response = await fetch(`${apiBaseUrl}/health/live`);
      if (response.status === 200) return;
    } catch {
      // The process is still starting.
    }
    await delay(100);
  }
  throw new Error(`API did not become ready: ${apiOutput.join("").slice(-1_000)}`);
}

async function stopApi(): Promise<void> {
  if (apiProcess === undefined || apiProcess.exitCode !== null) return;
  const exited = new Promise<void>((resolve) => apiProcess?.once("exit", () => resolve()));
  apiProcess.kill("SIGTERM");
  await Promise.race([exited, delay(5_000)]);
  if (apiProcess.exitCode === null) apiProcess.kill("SIGKILL");
}

beforeAll(async () => {
  const tokenResponse = await adminToken();
  expect(tokenResponse.status).toBe(200);
  adminAccessToken = String(
    ((await tokenResponse.json()) as { access_token?: unknown }).access_token,
  );

  const userResponse = await fetch(`${realmAdminUrl}/users`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      username,
      email,
      emailVerified: true,
      enabled: true,
      firstName: "Integration",
      lastName: "Employee",
      credentials: [{ type: "password", value: password, temporary: false }],
    }),
  });
  expect(userResponse.status).toBe(201);
  userId = userResponse.headers.get("location")?.split("/").at(-1) ?? "";
  expect(userId).toBeTruthy();
  await createRealmClient(wrongAudienceClientId, { audience: false });
  await createRealmClient(expiringClientId, { audience: true, lifespan: 1 });

  await startApi();
}, 30_000);

afterAll(async () => {
  await stopApi();
  await database.oidcIdentity.deleteMany({ where: { issuer, subject: userId } });
  await database.user.deleteMany({ where: { email } });
  if (adminAccessToken !== "") {
    for (const clientId of clientIds) {
      if (clientId !== "") {
        await fetch(`${realmAdminUrl}/clients/${clientId}`, {
          method: "DELETE",
          headers: adminHeaders(),
        });
      }
    }
    if (userId !== "") {
      await fetch(`${realmAdminUrl}/users/${userId}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
    }
  }
  await database.$disconnect();
}, 30_000);

describe.sequential("real Keycloak authentication", () => {
  it("completes Authorization Code with PKCE and serves /api/v1/me", async () => {
    const settings = oidcSettings({
      APP_BASE_URL: "http://localhost:3000",
      APP_ENV: "local",
      OIDC_AUDIENCE: "evaluation-api",
      OIDC_CLIENT_ID: "evaluation-web",
      OIDC_ISSUER: issuer,
      OIDC_SESSION_SECRET: sessionSecret,
    });
    const authorization = await authorizationCallback(password);
    expect(authorization.response.status).toBe(302);
    const callbackLocation = authorization.response.headers.get("location");
    expect(callbackLocation).toContain("/api/auth/callback?state=");
    validEncryptedSession = await finishOidcLogin(
      settings,
      new URL(callbackLocation ?? ""),
      authorization.transactionCookie,
    );
    const session = openAuthCookie(validEncryptedSession, sessionSecret, "session");
    validAccessToken = String(session.accessToken);
    expect(jwtPayload(validAccessToken)).toMatchObject({ email });
    await expect(
      validateAccessToken(
        validAccessToken,
        remoteAccessTokenValidationConfig(issuer, "evaluation-api"),
      ),
    ).resolves.toMatchObject({ email, issuer, oidcSubject: userId });

    const meResponses = await Promise.all(
      Array.from({ length: 8 }, () =>
        fetch(`${apiBaseUrl}/api/v1/me`, {
          headers: { authorization: `Bearer ${validAccessToken}` },
        }),
      ),
    );
    const principals = await Promise.all(meResponses.map((response) => response.json()));
    expect(
      meResponses.map((response) => response.status),
      JSON.stringify(principals),
    ).toEqual(Array.from({ length: 8 }, () => 200));
    for (const principal of principals) {
      expect(principal).toMatchObject({
        active: true,
        email,
        oidcSubject: userId,
        roles: [],
      });
    }
    expect(new Set(principals.map((principal) => principal.userId)).size).toBe(1);
    await expect(database.user.count({ where: { email } })).resolves.toBe(1);
    await expect(database.oidcIdentity.count({ where: { issuer, subject: userId } })).resolves.toBe(
      1,
    );
  });

  it("rejects callback state and nonce mismatches", async () => {
    const settings = oidcSettings({
      APP_BASE_URL: "http://localhost:3000",
      APP_ENV: "local",
      OIDC_AUDIENCE: "evaluation-api",
      OIDC_CLIENT_ID: "evaluation-web",
      OIDC_ISSUER: issuer,
      OIDC_SESSION_SECRET: sessionSecret,
    });
    const wrongState = await authorizationCallback(password);
    const wrongStateUrl = new URL(wrongState.response.headers.get("location") ?? "");
    wrongStateUrl.searchParams.set("state", "incorrect-state");
    await expect(
      finishOidcLogin(settings, wrongStateUrl, wrongState.transactionCookie),
    ).rejects.toMatchObject({ code: "AUTH_INVALID_SESSION", status: 401 });

    const wrongNonce = await authorizationCallback(password);
    const transaction = openAuthCookie(wrongNonce.transactionCookie, sessionSecret, "transaction");
    const wrongNonceCookie = sealAuthCookie(
      { ...transaction, nonce: "incorrect-nonce" },
      sessionSecret,
    );
    await expect(
      finishOidcLogin(
        settings,
        new URL(wrongNonce.response.headers.get("location") ?? ""),
        wrongNonceCookie,
      ),
    ).rejects.toMatchObject({ code: "AUTH_INVALID_SESSION", status: 401 });
  });

  it("uses the provider-advertised end-session endpoint", async () => {
    const settings = oidcSettings({
      APP_BASE_URL: "http://localhost:3000",
      APP_ENV: "local",
      OIDC_AUDIENCE: "evaluation-api",
      OIDC_CLIENT_ID: "evaluation-web",
      OIDC_ISSUER: issuer,
      OIDC_SESSION_SECRET: sessionSecret,
    });
    const logout = await endSessionUrl(settings, validEncryptedSession);

    expect(logout.origin).toBe(keycloakBaseUrl);
    expect(logout.pathname).toBe("/realms/evaluation/protocol/openid-connect/logout");
    expect(logout.searchParams.get("id_token_hint")).toBeTruthy();
    expect(logout.searchParams.get("post_logout_redirect_uri")).toBe("http://localhost:3000/ar");
  });

  it("rejects wrong credentials at Keycloak", async () => {
    const response = await passwordGrant(wrongAudienceClientId, "definitely-wrong-password");
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "invalid_grant" });
  });

  it("returns AUTH_INVALID_TOKEN for a real wrong-audience token", async () => {
    const grant = await passwordGrant(wrongAudienceClientId, password);
    expect(grant.status).toBe(200);
    const token = String(((await grant.json()) as { access_token?: unknown }).access_token);
    const response = await fetch(`${apiBaseUrl}/api/v1/me`, {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "AUTH_INVALID_TOKEN" });
  });

  it("returns AUTH_INVALID_TOKEN for a real expired token", async () => {
    const grant = await passwordGrant(expiringClientId, password);
    expect(grant.status).toBe(200);
    const token = String(((await grant.json()) as { access_token?: unknown }).access_token);
    await delay(Math.max(0, jwtExpiration(token) * 1_000 - Date.now() + 100));
    const response = await fetch(`${apiBaseUrl}/api/v1/me`, {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "AUTH_INVALID_TOKEN" });
  });

  it("denies an inactive internal user without deleting the identity", async () => {
    await database.user.update({ where: { email }, data: { active: false } });
    const response = await fetch(`${apiBaseUrl}/api/v1/me`, {
      headers: { authorization: `Bearer ${validAccessToken}` },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "AUTH_USER_INACTIVE" });
    await expect(
      database.oidcIdentity.findUnique({ where: { issuer_subject: { issuer, subject: userId } } }),
    ).resolves.not.toBeNull();
  });
});
