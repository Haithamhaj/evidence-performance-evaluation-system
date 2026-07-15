import { describe, expect, it, vi } from "vitest";

import { syncOidcUser } from "./index.js";

const oidcPrincipal: import("./index.js").ValidatedOidcPrincipal = {
  oidcSubject: "oidc-user-1",
  email: "employee@pilot.local",
  issuer: "http://localhost:8081/realms/evaluation",
};

function clientForUser(user: { id: string; email: string; displayName: string; active: boolean }) {
  const update = vi.fn().mockResolvedValue(user);
  const transaction = {
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

    await expect(syncOidcUser(client, oidcPrincipal, "Pilot Employee")).resolves.toEqual({
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
  });

  it("never reactivates and denies an inactive internal user", async () => {
    const { client, update } = clientForUser({
      id: "9a11bb8f-79f5-4a72-a98f-2e763e97699b",
      email: oidcPrincipal.email,
      displayName: "Pilot Employee",
      active: false,
    });

    await expect(syncOidcUser(client, oidcPrincipal, "Pilot Employee")).rejects.toMatchObject({
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
      syncOidcUser(client, oidcPrincipal, "Pilot Employee"),
      syncOidcUser(client, oidcPrincipal, "Pilot Employee"),
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

    await expect(syncOidcUser(client, oidcPrincipal)).rejects.toBe(conflict);
    expect(client.$transaction).toHaveBeenCalledTimes(3);
  });

  it("does not retry unrelated database failures", async () => {
    const failure = Object.assign(new Error("database unavailable"), { code: "P1001" });
    const client: import("./index.js").UserSyncClient = {
      $transaction: vi.fn().mockRejectedValue(failure),
    };

    await expect(syncOidcUser(client, oidcPrincipal)).rejects.toBe(failure);
    expect(client.$transaction).toHaveBeenCalledTimes(1);
  });
});
