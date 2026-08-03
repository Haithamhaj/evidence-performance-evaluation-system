import { describe, expect, it, vi } from "vitest";

import {
  GoogleLocalMemoryCredentialVault,
  GoogleLocalPrivateContextProtector,
} from "../credential-vault.js";
import { GoogleWorkspaceRestAdapter } from "./google-workspace-rest-adapter.js";

const credential = {
  accessToken: "local-access",
  refreshToken: "local-refresh",
  expiresAt: "2026-08-03T12:00:00.000Z",
} as const;

describe("local Google private-context protection", () => {
  it("seals new private titles with authenticated AES and can still open deterministic fixture rows", async () => {
    const protector = new GoogleLocalPrivateContextProtector({
      appEnvironment: "local",
      clientSecret: "local-client-secret-with-enough-entropy",
      nodeEnvironment: "development",
      runtimeMode: "google-local",
    });

    const first = await protector.seal("Private Gmail subject");
    const second = await protector.seal("Private Gmail subject");

    expect(first.keyVersion).toBe("google-local-aes-256-gcm-v1");
    expect(first.ciphertext).not.toBe(second.ciphertext);
    await expect(protector.open(first)).resolves.toBe("Private Gmail subject");
    await expect(
      protector.open({
        ciphertext: "development-only:Synthetic%20fixture",
        keyVersion: "development-only-v1",
      }),
    ).resolves.toBe("Synthetic fixture");
    await expect(
      protector.open({ ...first, ciphertext: `${first.ciphertext.slice(0, -1)}A` }),
    ).rejects.toMatchObject({ code: "PRIVATE_CONTEXT_PROTECTION_MISMATCH" });
  });

  it("refuses the local protector outside the explicit non-production local mode", () => {
    expect(
      () =>
        new GoogleLocalPrivateContextProtector({
          appEnvironment: "production",
          clientSecret: "local-client-secret-with-enough-entropy",
          nodeEnvironment: "production",
          runtimeMode: "google-local",
        }),
    ).toThrow("Local Google context protection requires explicit local development mode");
  });
});

describe("local Google credential lifetime", () => {
  it("removes local credential use even when provider-side revocation is unavailable", async () => {
    const revokeProviderCredential = vi.fn(async () => {
      throw new Error("provider unavailable");
    });
    const vault = new GoogleLocalMemoryCredentialVault({
      appEnvironment: "local",
      nodeEnvironment: "development",
      revokeProviderCredential,
      runtimeMode: "google-local",
    });
    const { credentialRef } = await vault.put({ credential });

    await vault.revoke(credentialRef);

    expect(revokeProviderCredential).toHaveBeenCalledOnce();
    await expect(vault.use(credentialRef, async () => "usable")).rejects.toMatchObject({
      code: "CREDENTIAL_REVOKED",
    });
  });
});

describe("provider-delegating Google adapter", () => {
  it("routes Gmail and Calendar pulls to their matching adapter only", async () => {
    const gmail = { pull: vi.fn(async () => ({ kind: "cursor_expired" as const })) };
    const calendar = { pull: vi.fn(async () => ({ kind: "cursor_expired" as const })) };
    const adapter = new GoogleWorkspaceRestAdapter({ gmail, calendar });

    await adapter.pull({
      provider: "GOOGLE_GMAIL",
      credential,
      syncCursor: null,
      pageCursor: null,
      exclusions: [],
    });
    await adapter.pull({
      provider: "GOOGLE_CALENDAR",
      credential,
      syncCursor: null,
      pageCursor: null,
      exclusions: [],
    });

    expect(gmail.pull).toHaveBeenCalledOnce();
    expect(calendar.pull).toHaveBeenCalledOnce();
  });
});
