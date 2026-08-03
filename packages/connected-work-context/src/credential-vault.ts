import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

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

type GoogleLocalRuntimeGuard = Readonly<{
  appEnvironment: string | undefined;
  nodeEnvironment: string | undefined;
  runtimeMode: string | undefined;
}>;

const googleLocalKeyVersion = "google-local-aes-256-gcm-v1";
const googleLocalCiphertextPrefix = "aesgcm:";

/**
 * Local-preview-only authenticated protection. The AES key is derived and retained only in memory.
 * Existing deterministic fixture rows can still be opened so switching local modes is reversible.
 */
export class GoogleLocalPrivateContextProtector implements PrivateContextProtector {
  private readonly key: Buffer;
  private readonly fixtureProtector = new DevelopmentOnlyDeterministicPrivateContextProtector({
    runtimeMode: "development",
  });

  constructor(input: GoogleLocalRuntimeGuard & Readonly<{ clientSecret: string }>) {
    assertGoogleLocalRuntime(input);
    if (input.clientSecret.trim().length === 0) {
      throw new Error("Google client secret is required for local context protection");
    }
    this.key = Buffer.from(
      hkdfSync(
        "sha256",
        Buffer.from(input.clientSecret, "utf8"),
        Buffer.from("evaluation-system/google-local/v1", "utf8"),
        Buffer.from("connected-work-context/private-title/aes-256-gcm", "utf8"),
        32,
      ),
    );
  }

  async seal(value: string): Promise<{ ciphertext: string; keyVersion: string }> {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, nonce);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      ciphertext: `${googleLocalCiphertextPrefix}${nonce.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`,
      keyVersion: googleLocalKeyVersion,
    };
  }

  async open(input: { ciphertext: string; keyVersion: string }): Promise<string> {
    if (input.keyVersion === DevelopmentOnlyDeterministicPrivateContextProtector.keyVersion) {
      return this.fixtureProtector.open(input);
    }
    if (
      input.keyVersion !== googleLocalKeyVersion ||
      !input.ciphertext.startsWith(googleLocalCiphertextPrefix)
    ) {
      throw protectionMismatchError();
    }
    const parts = input.ciphertext.slice(googleLocalCiphertextPrefix.length).split(".");
    if (parts.length !== 3) throw protectionMismatchError();
    try {
      const nonce = Buffer.from(parts[0]!, "base64url");
      const tag = Buffer.from(parts[1]!, "base64url");
      const encrypted = Buffer.from(parts[2]!, "base64url");
      if (nonce.length !== 12 || tag.length !== 16) throw protectionMismatchError();
      const decipher = createDecipheriv("aes-256-gcm", this.key, nonce);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw protectionMismatchError();
    }
  }
}

/** Process-memory-only local OAuth storage. Local disconnect wins even if Google is unavailable. */
export class GoogleLocalMemoryCredentialVault implements CredentialVault {
  private readonly credentials = new Map<string, OAuthCredential>();
  private readonly revoked = new Set<string>();
  private readonly revokeProviderCredential: (credential: OAuthCredential) => Promise<void>;

  constructor(
    input: GoogleLocalRuntimeGuard &
      Readonly<{ revokeProviderCredential: (credential: OAuthCredential) => Promise<void> }>,
  ) {
    assertGoogleLocalRuntime(input);
    this.revokeProviderCredential = input.revokeProviderCredential;
  }

  async put(input: SealedCredentialInput): Promise<{ credentialRef: string }> {
    assertCredential(input.credential);
    const credentialRef = `google-local-memory://${crypto.randomUUID()}`;
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
    const credential = this.credentials.get(credentialRef);
    this.credentials.delete(credentialRef);
    this.revoked.add(credentialRef);
    if (credential === undefined) return;
    try {
      await this.revokeProviderCredential(credential);
    } catch {
      // Local credential use is already disabled. Provider unavailability cannot undo disconnect.
    }
  }
}

function assertGoogleLocalRuntime(input: GoogleLocalRuntimeGuard): void {
  if (
    input.appEnvironment !== "local" ||
    input.nodeEnvironment === "production" ||
    input.runtimeMode !== "google-local"
  ) {
    throw new Error("Local Google context protection requires explicit local development mode");
  }
}

function protectionMismatchError(): AppError {
  return new AppError(
    "PRIVATE_CONTEXT_PROTECTION_MISMATCH",
    "errors.connectedContext.protectionMismatch",
    500,
  );
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
