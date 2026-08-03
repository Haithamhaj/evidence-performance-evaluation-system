import { AppError } from "@evaluation/contracts";

export const GOOGLE_WORKSPACE_READ_SCOPES = Object.freeze([
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.metadata",
  "https://www.googleapis.com/auth/calendar.events.readonly",
] as const);

export type GoogleHttpTransport = (url: string, init?: RequestInit) => Promise<Response>;

export type GoogleOAuthConfiguration =
  | Readonly<{ externalConfigurationReady: false }>
  | Readonly<{
      externalConfigurationReady: true;
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    }>;

type GoogleOAuthClientDependencies = Readonly<{
  configuration: GoogleOAuthConfiguration;
  transport?: GoogleHttpTransport;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => Date;
}>;

type RefreshedCredential = Readonly<{
  accessToken: string;
  expiresAt: string | null;
}>;

const authorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
const tokenEndpoint = "https://oauth2.googleapis.com/token";
const revocationEndpoint = "https://oauth2.googleapis.com/revoke";
const maximumAttempts = 3;
const fallbackRetryDelayMilliseconds = 500;

/**
 * OAuth and authorized HTTP boundary for Google Workspace adapters.
 * It never logs request bodies, authorization headers, codes, or credentials.
 */
export class GoogleOAuthClient {
  private readonly configuration: GoogleOAuthConfiguration;
  private readonly transport: GoogleHttpTransport;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly now: () => Date;
  private readonly refreshedByRefreshToken = new Map<string, RefreshedCredential>();

  constructor(dependencies: GoogleOAuthClientDependencies) {
    this.configuration = dependencies.configuration;
    this.transport = dependencies.transport ?? ((url, init) => fetch(url, init));
    this.sleep = dependencies.sleep ?? defaultSleep;
    this.now = dependencies.now ?? (() => new Date());
    if (this.configuration.externalConfigurationReady) {
      assertNonEmpty(this.configuration.clientId);
      assertNonEmpty(this.configuration.clientSecret);
      assertUrl(this.configuration.redirectUri);
    }
  }

  createAuthorizationUrl(input: Readonly<{ state: string }>): string {
    const configuration = this.requireReadyConfiguration();
    assertNonEmpty(input.state);
    const url = new URL(authorizationEndpoint);
    url.searchParams.set("client_id", configuration.clientId);
    url.searchParams.set("redirect_uri", configuration.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", GOOGLE_WORKSPACE_READ_SCOPES.join(" "));
    url.searchParams.set("state", input.state);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("include_granted_scopes", "false");
    url.searchParams.set("prompt", "consent");
    return url.toString();
  }

  async exchangeAuthorizationCode(
    code: string,
  ): Promise<import("../credential-vault.js").OAuthCredential> {
    const configuration = this.requireReadyConfiguration();
    assertNonEmpty(code);
    const body = new URLSearchParams({
      client_id: configuration.clientId,
      client_secret: configuration.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: configuration.redirectUri,
    });
    const response = await this.requestWithTransientRetries(tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!response.ok) throw oauthProviderError();
    const payload = await readJsonObject(response);
    const accessToken = requiredString(payload, "access_token");
    const refreshToken = optionalString(payload, "refresh_token");
    return {
      accessToken,
      refreshToken,
      expiresAt: expiryFromPayload(payload, this.now()),
    };
  }

  async authorizedFetch(
    credential: import("../credential-vault.js").OAuthCredential,
    url: string,
    init: RequestInit = {},
  ): Promise<Response> {
    this.requireReadyConfiguration();
    assertGoogleApiUrl(url);
    let current = await this.resolveCredential(credential);
    let response = await this.requestWithTransientRetries(
      url,
      withAuthorization(init, current.accessToken),
    );
    if (response.status !== 401) return response;
    current = await this.refreshCredential(credential, true);
    response = await this.requestWithTransientRetries(
      url,
      withAuthorization(init, current.accessToken),
    );
    return response;
  }

  async revoke(credential: import("../credential-vault.js").OAuthCredential): Promise<void> {
    this.requireReadyConfiguration();
    const token = credential.refreshToken ?? credential.accessToken;
    assertNonEmpty(token);
    const response = await this.requestWithTransientRetries(revocationEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
    });
    if (!response.ok) throw oauthProviderError();
    if (credential.refreshToken !== null) {
      this.refreshedByRefreshToken.delete(credential.refreshToken);
    }
  }

  private async resolveCredential(
    credential: import("../credential-vault.js").OAuthCredential,
  ): Promise<RefreshedCredential> {
    const cached =
      credential.refreshToken === null
        ? undefined
        : this.refreshedByRefreshToken.get(credential.refreshToken);
    if (cached !== undefined && !isExpired(cached.expiresAt, this.now())) return cached;
    if (!isExpired(credential.expiresAt, this.now())) {
      return { accessToken: credential.accessToken, expiresAt: credential.expiresAt };
    }
    return this.refreshCredential(credential, false);
  }

  private async refreshCredential(
    credential: import("../credential-vault.js").OAuthCredential,
    force: boolean,
  ): Promise<RefreshedCredential> {
    const configuration = this.requireReadyConfiguration();
    if (credential.refreshToken === null) throw reauthorizationRequiredError();
    const cached = this.refreshedByRefreshToken.get(credential.refreshToken);
    if (!force && cached !== undefined && !isExpired(cached.expiresAt, this.now())) return cached;
    const body = new URLSearchParams({
      client_id: configuration.clientId,
      client_secret: configuration.clientSecret,
      refresh_token: credential.refreshToken,
      grant_type: "refresh_token",
    });
    const response = await this.requestWithTransientRetries(tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!response.ok) {
      if (response.status === 400 || response.status === 401) throw reauthorizationRequiredError();
      throw oauthProviderError();
    }
    const payload = await readJsonObject(response);
    const refreshed = {
      accessToken: requiredString(payload, "access_token"),
      expiresAt: expiryFromPayload(payload, this.now()),
    };
    this.refreshedByRefreshToken.set(credential.refreshToken, refreshed);
    return refreshed;
  }

  private async requestWithTransientRetries(url: string, init: RequestInit): Promise<Response> {
    for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
      try {
        const response = await this.transport(url, init);
        if (!isTransientStatus(response.status) || attempt === maximumAttempts - 1) return response;
        await this.sleep(retryDelay(response.headers.get("retry-after"), this.now));
      } catch {
        if (attempt === maximumAttempts - 1) throw googleTransportError();
        await this.sleep(fallbackRetryDelayMilliseconds);
      }
    }
    throw googleTransportError();
  }

  private requireReadyConfiguration(): Extract<
    GoogleOAuthConfiguration,
    { externalConfigurationReady: true }
  > {
    if (!this.configuration.externalConfigurationReady) {
      throw new AppError(
        "EXTERNAL_CONFIGURATION_REQUIRED",
        "errors.connectedContext.externalConfigurationRequired",
        503,
      );
    }
    return this.configuration;
  }
}

function withAuthorization(init: RequestInit, accessToken: string): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${accessToken}`);
  headers.set("accept", "application/json");
  return { ...init, headers };
}

function isTransientStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function retryDelay(value: string | null, now: () => Date): number {
  if (value === null) return fallbackRetryDelayMilliseconds;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 30_000);
  const date = Date.parse(value);
  if (Number.isNaN(date)) return fallbackRetryDelayMilliseconds;
  return Math.max(0, Math.min(date - now().getTime(), 30_000));
}

function isExpired(expiresAt: string | null, now: Date): boolean {
  if (expiresAt === null) return false;
  const parsed = Date.parse(expiresAt);
  return Number.isNaN(parsed) || parsed <= now.getTime() + 30_000;
}

function expiryFromPayload(payload: Record<string, unknown>, now: Date): string | null {
  const expiresIn = payload.expires_in;
  if (typeof expiresIn !== "number" || !Number.isFinite(expiresIn) || expiresIn <= 0) return null;
  return new Date(now.getTime() + expiresIn * 1_000).toISOString();
}

async function readJsonObject(response: Response): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw oauthProviderError();
  }
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw oauthProviderError();
  return value as Record<string, unknown>;
}

function requiredString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || value.trim().length === 0) throw oauthProviderError();
  return value;
}

function optionalString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  if (value === undefined) return null;
  if (typeof value !== "string" || value.trim().length === 0) throw oauthProviderError();
  return value;
}

function assertNonEmpty(value: string): void {
  if (value.trim().length === 0) throw new Error("Google OAuth configuration value is required");
}

function assertUrl(value: string): void {
  try {
    new URL(value);
  } catch {
    throw new Error("Google OAuth redirect URI must be an absolute URL");
  }
}

function assertGoogleApiUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw googleTransportError();
  }
  if (
    url.protocol !== "https:" ||
    (url.hostname !== "gmail.googleapis.com" && url.hostname !== "www.googleapis.com")
  ) {
    throw googleTransportError();
  }
}

function oauthProviderError(): AppError {
  return new AppError("GOOGLE_OAUTH_FAILED", "errors.connectedContext.googleOauthFailed", 502);
}

function reauthorizationRequiredError(): AppError {
  return new AppError(
    "GOOGLE_REAUTHORIZATION_REQUIRED",
    "errors.connectedContext.googleReauthorizationRequired",
    409,
  );
}

function googleTransportError(): AppError {
  return new AppError(
    "GOOGLE_WORKSPACE_UNAVAILABLE",
    "errors.connectedContext.googleWorkspaceUnavailable",
    502,
  );
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
