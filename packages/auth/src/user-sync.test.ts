import { describe, expect, it, vi } from "vitest";

import { syncOidcUser } from "./index.js";

const oidcPrincipal: import("./index.js").ValidatedOidcPrincipal = {
  oidcSubject: "oidc-user-1",
  email: "employee@pilot.local",
  issuer: "http://localhost:8081/realms/evaluation",
};
const systemScopeId = "82b5867a-8d1f-4df4-bf05-74586d952ab1";

function auditWriter() {
  return {
    append: vi.fn().mockResolvedValue({
      id: "e6f6ae79-4021-4a1e-b906-ef3e6a185e66",
      createdAt: "2026-07-16T00:00:00.000Z",
    }),
  };
}

function clientForUser(user: { id: string; email: string; displayName: string; active: boolean }) {
  const update = vi.fn().mockResolvedValue(user);
  const transaction = {
    auditEvent: { create: vi.fn() },
    authorizationScope: { findUnique: vi.fn().mockResolvedValue({ id: systemScopeId }) },
    oidcIdentity: {
      findUnique: vi.fn().mockResolvedValue({ user }),
      create: vi.fn(),
    },
    user: { create: vi.fn(), findUnique: vi.fn(), update },
  };

  const client: import("./index.js").UserSyncClient = {
    $transaction: async (operation) => operation(transaction),
  };

  return {
    client,
    update,
  };
}

describe("OIDC user synchronization", () => {
  it("returns the exact authenticated principal for an active internal user", async () => {
    const { client, update } = clientForUser({
      id: "9a11bb8f-79f5-4a72-a98f-2e763e97699b",
      email: oidcPrincipal.email,
      displayName: "Pilot Employee",
      active: true,
    });

    const writer = auditWriter();
    await expect(syncOidcUser(client, oidcPrincipal, writer, "Pilot Employee")).resolves.toEqual({
      userId: "9a11bb8f-79f5-4a72-a98f-2e763e97699b",
      oidcSubject: "oidc-user-1",
      email: "employee@pilot.local",
      roles: [],
      active: true,
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "9a11bb8f-79f5-4a72-a98f-2e763e97699b" },
      data: { displayName: "Pilot Employee", email: "employee@pilot.local" },
    });
    expect(writer.append).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        eventType: "identity.synchronized",
        scopeId: systemScopeId,
        targetId: "9a11bb8f-79f5-4a72-a98f-2e763e97699b",
      }),
    );
  });

  it("never reactivates and denies an inactive internal user", async () => {
    const { client, update } = clientForUser({
      id: "9a11bb8f-79f5-4a72-a98f-2e763e97699b",
      email: oidcPrincipal.email,
      displayName: "Pilot Employee",
      active: false,
    });

    await expect(
      syncOidcUser(client, oidcPrincipal, auditWriter(), "Pilot Employee"),
    ).rejects.toMatchObject({
      code: "AUTH_USER_INACTIVE",
      messageKey: "errors.auth.userInactive",
      status: 403,
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("converges concurrent first-login synchronization on one identity", async () => {
    const user = {
      id: "9a11bb8f-79f5-4a72-a98f-2e763e97699b",
      email: oidcPrincipal.email,
      displayName: "Pilot Employee",
      active: true,
    };
    let persistedUser: typeof user | null = null;
    let identityExists = false;
    let createAttempts = 0;
    let releaseCreates: (() => void) | undefined;
    const bothCreating = new Promise<void>((resolve) => {
      releaseCreates = resolve;
    });
    const transaction = {
      auditEvent: { create: vi.fn() },
      authorizationScope: { findUnique: vi.fn().mockResolvedValue({ id: systemScopeId }) },
      oidcIdentity: {
        findUnique: vi.fn(async () =>
          identityExists && persistedUser !== null ? { user: persistedUser } : null,
        ),
        create: vi.fn(),
      },
      user: {
        findUnique: vi.fn(async () => persistedUser),
        update: vi.fn(async () => persistedUser ?? user),
        create: vi.fn(async () => {
          createAttempts += 1;
          if (createAttempts === 2) releaseCreates?.();
          await bothCreating;
          if (persistedUser !== null) {
            throw Object.assign(new Error("unique conflict"), { code: "P2002" });
          }
          persistedUser = user;
          identityExists = true;
          return user;
        }),
      },
    };
    const client: import("./index.js").UserSyncClient = {
      $transaction: vi.fn(async (operation) => operation(transaction)),
    };

    const results = await Promise.all([
      syncOidcUser(client, oidcPrincipal, auditWriter(), "Pilot Employee"),
      syncOidcUser(client, oidcPrincipal, auditWriter(), "Pilot Employee"),
    ]);

    expect(results[0]).toEqual(results[1]);
    expect(transaction.user.create).toHaveBeenCalledTimes(2);
    expect(client.$transaction).toHaveBeenCalledTimes(3);
  });

  it.each(["P2002", "P2034"])("bounds retries for %s conflicts", async (code) => {
    const conflict = Object.assign(new Error("retryable conflict"), { code });
    const client: import("./index.js").UserSyncClient = {
      $transaction: vi.fn().mockRejectedValue(conflict),
    };

    await expect(syncOidcUser(client, oidcPrincipal, auditWriter())).rejects.toBe(conflict);
    expect(client.$transaction).toHaveBeenCalledTimes(3);
  });

  it("does not retry unrelated database failures", async () => {
    const failure = Object.assign(new Error("database unavailable"), { code: "P1001" });
    const client: import("./index.js").UserSyncClient = {
      $transaction: vi.fn().mockRejectedValue(failure),
    };

    await expect(syncOidcUser(client, oidcPrincipal, auditWriter())).rejects.toBe(failure);
    expect(client.$transaction).toHaveBeenCalledTimes(1);
  });
});
