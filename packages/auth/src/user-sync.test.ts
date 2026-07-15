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
});
