export interface Configuration {
  serverMetadata(): Readonly<{ end_session_endpoint?: string }>;
}

export function None(): unknown;
export function allowInsecureRequests(configuration: Configuration): void;
export function discovery(
  issuer: URL,
  clientId: string,
  metadata: { redirect_uris: string[]; response_types: string[] },
  clientAuthentication: unknown,
  options?: { execute: Array<(configuration: Configuration) => void> },
): Promise<Configuration>;
export function randomPKCECodeVerifier(): string;
export function calculatePKCECodeChallenge(verifier: string): Promise<string>;
export function randomNonce(): string;
export function randomState(): string;
export function buildAuthorizationUrl(
  configuration: Configuration,
  parameters: Record<string, string>,
): URL;
export function authorizationCodeGrant(
  configuration: Configuration,
  currentUrl: URL,
  checks: {
    expectedNonce: string;
    expectedState: string;
    idTokenExpected: true;
    pkceCodeVerifier: string;
  },
): Promise<{
  access_token: string;
  expires_in?: number;
  id_token?: string;
}>;
export function buildEndSessionUrl(
  configuration: Configuration,
  parameters: Record<string, string>,
): URL;
