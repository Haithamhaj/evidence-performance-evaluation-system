import { AppError } from "@evaluation/contracts";

export type OAuthCredential = Readonly<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
}>;

export type SealedCredentialInput = Readonly<{
  credential: OAuthCredential;
}>;

export interface CredentialVault {
  put(input: SealedCredentialInput): Promise<{ credentialRef: string }>;
  use<T>(credentialRef: string, fn: (credential: OAuthCredential) => Promise<T>): Promise<T>;
  revoke(credentialRef: string): Promise<void>;
}

export interface PrivateContextProtector {
  seal(value: string): Promise<{ ciphertext: string; keyVersion: string }>;
  open(input: { ciphertext: string; keyVersion: string }): Promise<string>;
}

export interface ProductionCryptographicKeyProvider extends PrivateContextProtector {
  readonly runtimeMode: "live";
}

type PrivateContextProtectorConfiguration =
  | Readonly<{ mode: "development" }>
  | Readonly<{
      mode: "live";
      keyProvider: ProductionCryptographicKeyProvider | undefined;
    }>;

/**
 * This protector is reversible encoding for deterministic local fixtures only.
 * It is deliberately named, versioned, and constructed as development-only.
 */
export class DevelopmentOnlyDeterministicPrivateContextProtector implements PrivateContextProtector {
  static readonly keyVersion = "development-only-v1";
  private static readonly prefix = "development-only:";

  constructor(input: Readonly<{ runtimeMode: "development" }>) {
    if (input.runtimeMode !== "development") {
      throw new Error("Development-only context protection cannot be used outside development");
    }
  }

  async seal(value: string): Promise<{ ciphertext: string; keyVersion: string }> {
    return {
      ciphertext: `${DevelopmentOnlyDeterministicPrivateContextProtector.prefix}${encodeURIComponent(value)}`,
      keyVersion: DevelopmentOnlyDeterministicPrivateContextProtector.keyVersion,
    };
  }

  async open(input: { ciphertext: string; keyVersion: string }): Promise<string> {
    if (
      input.keyVersion !== DevelopmentOnlyDeterministicPrivateContextProtector.keyVersion ||
      !input.ciphertext.startsWith(DevelopmentOnlyDeterministicPrivateContextProtector.prefix)
    ) {
      throw new AppError(
        "PRIVATE_CONTEXT_PROTECTION_MISMATCH",
        "errors.connectedContext.protectionMismatch",
        500,
      );
    }
    return decodeURIComponent(
      input.ciphertext.slice(DevelopmentOnlyDeterministicPrivateContextProtector.prefix.length),
    );
  }
}

export function createPrivateContextProtector(
  configuration: PrivateContextProtectorConfiguration,
): PrivateContextProtector {
  if (configuration.mode === "development") {
    return new DevelopmentOnlyDeterministicPrivateContextProtector({
      runtimeMode: "development",
    });
  }
  if (configuration.keyProvider === undefined || configuration.keyProvider.runtimeMode !== "live") {
    throw new Error("Production cryptographic key provider is required for live mode");
  }
  return configuration.keyProvider;
}

/**
 * Process-local credential storage for deterministic development and tests.
 * Live composition must supply a production credential vault.
 */
export class DevelopmentOnlyMemoryCredentialVault implements CredentialVault {
  private readonly credentials = new Map<string, OAuthCredential>();
  private readonly revoked = new Set<string>();

  constructor(input: Readonly<{ runtimeMode: "development" }>) {
    if (input.runtimeMode !== "development") {
      throw new Error("Development-only credential vault cannot be used outside development");
    }
  }

  async put(input: SealedCredentialInput): Promise<{ credentialRef: string }> {
    assertCredential(input.credential);
    const credentialRef = `development-vault://${crypto.randomUUID()}`;
    this.credentials.set(credentialRef, Object.freeze({ ...input.credential }));
    return { credentialRef };
  }

  async use<T>(credentialRef: string, fn: (credential: OAuthCredential) => Promise<T>): Promise<T> {
    const credential = this.credentials.get(credentialRef);
    if (credential === undefined || this.revoked.has(credentialRef)) {
      throw new AppError("CREDENTIAL_REVOKED", "errors.connectedContext.credentialRevoked", 409);
    }
    return fn(credential);
  }

  async revoke(credentialRef: string): Promise<void> {
    this.credentials.delete(credentialRef);
    this.revoked.add(credentialRef);
  }
}

function assertCredential(credential: OAuthCredential): void {
  if (credential.accessToken.trim().length === 0) {
    throw new AppError(
      "CONNECTED_CONTEXT_CREDENTIAL_INVALID",
      "errors.connectedContext.credentialInvalid",
      400,
    );
  }
  if (credential.refreshToken !== null && credential.refreshToken.trim().length === 0) {
    throw new AppError(
      "CONNECTED_CONTEXT_CREDENTIAL_INVALID",
      "errors.connectedContext.credentialInvalid",
      400,
    );
  }
  if (credential.expiresAt !== null && Number.isNaN(Date.parse(credential.expiresAt))) {
    throw new AppError(
      "CONNECTED_CONTEXT_CREDENTIAL_INVALID",
      "errors.connectedContext.credentialInvalid",
      400,
    );
  }
}
