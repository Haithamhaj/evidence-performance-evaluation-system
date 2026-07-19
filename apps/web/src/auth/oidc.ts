import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";

import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  allowInsecureRequests,
  authorizationCodeGrant,
  buildAuthorizationUrl,
  buildEndSessionUrl,
  calculatePKCECodeChallenge,
  discovery,
  None,
  randomNonce,
  randomPKCECodeVerifier,
  randomState,
} from "./openid-client-adapter.mjs";

export const OIDC_TRANSACTION_COOKIE = "evaluation_oidc_transaction";
export const OIDC_SESSION_COOKIE = "evaluation_session";

export interface OidcSettings {
  readonly issuer: string;
  readonly clientId: string;
  readonly audience: string;
  readonly redirectUri: string;
  readonly postLogoutRedirectUri: string;
  readonly sessionSecret: string;
  readonly environment: string;
}

interface AuthCookiePayload {
  readonly kind: "transaction" | "session";
  readonly expiresAt: number;
  readonly [key: string]: unknown;
}

interface TransactionCookie extends AuthCookiePayload {
  readonly kind: "transaction";
  readonly codeVerifier: string;
  readonly state: string;
  readonly nonce: string;
}

interface SessionCookie extends AuthCookiePayload {
  readonly kind: "session";
  readonly accessToken: string;
  readonly idToken?: string;
}

class WebAuthError extends Error {
  readonly code: string;
  readonly messageKey: string;
  readonly status: number;

  constructor(code: string, messageKey: string, status: number) {
    super(code);
    this.name = "WebAuthError";
    this.code = code;
    this.messageKey = messageKey;
    this.status = status;
  }
}

function required(name: string, value: string | undefined): string {
  if (value === undefined || value.trim().length === 0)
    throw new Error(`${name} must be configured`);
  return value;
}

export function oidcSettings(environment: NodeJS.ProcessEnv = process.env): OidcSettings {
  const issuer = required("OIDC_ISSUER", environment.OIDC_ISSUER).replace(/\/$/u, "");
  const appBaseUrl = required("APP_BASE_URL", environment.APP_BASE_URL).replace(/\/$/u, "");
  const sessionSecret = required("OIDC_SESSION_SECRET", environment.OIDC_SESSION_SECRET);
  if (sessionSecret.length < 32)
    throw new Error("OIDC_SESSION_SECRET must contain at least 32 characters");

  return {
    issuer,
    clientId: required("OIDC_CLIENT_ID", environment.OIDC_CLIENT_ID),
    audience: required("OIDC_AUDIENCE", environment.OIDC_AUDIENCE),
    redirectUri: `${appBaseUrl}/api/auth/callback`,
    postLogoutRedirectUri: `${appBaseUrl}/ar`,
    sessionSecret,
    environment: environment.APP_ENV ?? "production",
  };
}

function encryptionKey(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

export function sealAuthCookie(payload: AuthCookiePayload, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), ciphertext]
    .map((value) => value.toString("base64url"))
    .join(".");
}

export function openAuthCookie(
  value: string,
  secret: string,
  expectedKind: AuthCookiePayload["kind"],
): AuthCookiePayload {
  try {
    const parts = value.split(".");
    if (parts.length !== 3) throw new Error("invalid encrypted cookie");
    const [ivValue, tagValue, ciphertextValue] = parts;
    if (ivValue === undefined || tagValue === undefined || ciphertextValue === undefined) {
      throw new Error("invalid encrypted cookie");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(secret),
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const parsed = JSON.parse(plaintext) as Partial<AuthCookiePayload>;
    if (
      parsed.kind !== expectedKind ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= Date.now()
    ) {
      throw new Error("invalid encrypted cookie claims");
    }
    return parsed as AuthCookiePayload;
  } catch {
    throw new WebAuthError("AUTH_INVALID_SESSION", "errors.auth.invalidSession", 401);
  }
}

export function sessionAccessToken(encryptedSession: string, settings: OidcSettings): string {
  const session = openAuthCookie(
    encryptedSession,
    settings.sessionSecret,
    "session",
  ) as SessionCookie;
  if (typeof session.accessToken !== "string" || session.accessToken.trim().length === 0) {
    throw new WebAuthError("AUTH_INVALID_SESSION", "errors.auth.invalidSession", 401);
  }
  return session.accessToken;
}

export function authCookieOptions(environment: string, maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: environment !== "local",
  };
}

async function oidcConfiguration(settings: OidcSettings) {
  const options =
    settings.environment === "local" ? { execute: [allowInsecureRequests] } : undefined;
  return discovery(
    new URL(settings.issuer),
    settings.clientId,
    { redirect_uris: [settings.redirectUri], response_types: ["code"] },
    None(),
    options,
  );
}

export async function startOidcLogin(settings: OidcSettings): Promise<{
  readonly authorizationUrl: URL;
  readonly transactionCookie: string;
}> {
  const configuration = await oidcConfiguration(settings);
  const codeVerifier = randomPKCECodeVerifier();
  const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);
  const state = randomState();
  const nonce = randomNonce();
  const authorizationUrl = buildAuthorizationUrl(configuration, {
    redirect_uri: settings.redirectUri,
    scope: "openid email profile",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    nonce,
  });
  const transaction: TransactionCookie = {
    kind: "transaction",
    expiresAt: Date.now() + 5 * 60_000,
    codeVerifier,
    state,
    nonce,
  };
  return {
    authorizationUrl,
    transactionCookie: sealAuthCookie(transaction, settings.sessionSecret),
  };
}

function asTransaction(payload: AuthCookiePayload): TransactionCookie {
  if (
    typeof payload.codeVerifier !== "string" ||
    typeof payload.state !== "string" ||
    typeof payload.nonce !== "string"
  ) {
    throw new WebAuthError("AUTH_INVALID_SESSION", "errors.auth.invalidSession", 401);
  }
  return payload as TransactionCookie;
}

export function canonicalOidcCallbackUrl(settings: OidcSettings, callbackUrl: URL): URL {
  const configured = new URL(settings.redirectUri);
  if (callbackUrl.pathname !== configured.pathname) {
    throw new WebAuthError("AUTH_INVALID_SESSION", "errors.auth.invalidSession", 401);
  }
  configured.search = callbackUrl.search;
  return configured;
}

export async function finishOidcLogin(
  settings: OidcSettings,
  callbackUrl: URL,
  transactionCookie: string,
): Promise<string> {
  const transaction = asTransaction(
    openAuthCookie(transactionCookie, settings.sessionSecret, "transaction"),
  );
  const configuration = await oidcConfiguration(settings);
  let tokens: Awaited<ReturnType<typeof authorizationCodeGrant>>;
  try {
    tokens = await authorizationCodeGrant(
      configuration,
      canonicalOidcCallbackUrl(settings, callbackUrl),
      {
        expectedNonce: transaction.nonce,
        expectedState: transaction.state,
        idTokenExpected: true,
        pkceCodeVerifier: transaction.codeVerifier,
      },
    );
  } catch {
    throw new WebAuthError("AUTH_INVALID_SESSION", "errors.auth.invalidSession", 401);
  }
  try {
    const { payload } = await jwtVerify(
      tokens.access_token,
      createRemoteJWKSet(new URL(`${settings.issuer}/protocol/openid-connect/certs`)),
      { algorithms: ["RS256"], audience: settings.audience, issuer: settings.issuer },
    );
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      payload.email_verified !== true
    ) {
      throw new Error("access token identity claims are incomplete");
    }
  } catch {
    throw new WebAuthError("AUTH_INVALID_TOKEN", "errors.auth.invalidToken", 401);
  }

  const session: SessionCookie = {
    kind: "session",
    expiresAt: Date.now() + Math.max(1, tokens.expires_in ?? 300) * 1_000,
    accessToken: tokens.access_token,
    ...(tokens.id_token === undefined ? {} : { idToken: tokens.id_token }),
  };
  return sealAuthCookie(session, settings.sessionSecret);
}

export async function endSessionUrl(
  settings: OidcSettings,
  encryptedSession: string | undefined,
): Promise<URL> {
  const localUrl = new URL(settings.postLogoutRedirectUri);
  if (encryptedSession === undefined) return localUrl;

  const session = openAuthCookie(
    encryptedSession,
    settings.sessionSecret,
    "session",
  ) as SessionCookie;
  const configuration = await oidcConfiguration(settings);
  if (typeof configuration.serverMetadata().end_session_endpoint !== "string") return localUrl;

  return buildEndSessionUrl(configuration, {
    post_logout_redirect_uri: settings.postLogoutRedirectUri,
    ...(session.idToken === undefined ? {} : { id_token_hint: session.idToken }),
  });
}

export function safeAuthError(error: unknown): {
  readonly status: number;
  readonly body: {
    readonly code: string;
    readonly messageKey: string;
    readonly correlationId: string;
  };
} {
  if (error instanceof WebAuthError) {
    return {
      status: error.status,
      body: { code: error.code, messageKey: error.messageKey, correlationId: randomUUID() },
    };
  }
  return {
    status: 500,
    body: { code: "INTERNAL_ERROR", messageKey: "errors.internal", correlationId: randomUUID() },
  };
}
