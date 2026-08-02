import { createDatabaseClient } from "@evaluation/database";
import { afterAll, describe, expect, it } from "vitest";

import { ConnectedWorkConnectionService } from "./connection-service.js";
import {
  createPrivateContextProtector,
  DevelopmentOnlyMemoryCredentialVault,
} from "./credential-vault.js";
import { ConnectedWorkContextQueryService } from "./query-service.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const now = new Date("2026-07-20T09:00:00.000Z");

async function seedUsers() {
  const suffix = crypto.randomUUID();
  const ownerId = crypto.randomUUID();
  const otherEmployeeId = crypto.randomUUID();
  const managerId = crypto.randomUUID();
  await client.user.createMany({
    data: [
      {
        id: ownerId,
        email: `query-owner-${suffix}@example.invalid`,
        displayName: "Query Owner",
      },
      {
        id: otherEmployeeId,
        email: `query-other-${suffix}@example.invalid`,
        displayName: "Other Employee",
      },
      {
        id: managerId,
        email: `query-manager-${suffix}@example.invalid`,
        displayName: "Manager",
      },
    ],
  });
  return { ownerId, otherEmployeeId, managerId };
}

afterAll(async () => client.$disconnect());

describe("private connected-context queries", () => {
  it("revalidates owner, account, exclusion, deletion, and content access in the caller transaction", async () => {
    const users = await seedUsers();
    const protector = createPrivateContextProtector({ mode: "development" });
    const title = await protector.seal("Transaction-protected source");
    const account = await client.connectedWorkAccount.create({
      data: {
        employeeId: users.ownerId,
        credentialRef: `vault://${crypto.randomUUID()}`,
        connectedAt: now,
      },
    });
    const item = await client.connectedSourceItem.create({
      data: {
        connectedWorkAccountId: account.id,
        employeeId: users.ownerId,
        provider: "GOOGLE_GMAIL",
        providerSourceId: "transaction-source",
        occurredAt: now,
        titleCiphertext: title.ciphertext,
        titleKeyVersion: title.keyVersion,
      },
    });
    const query = new ConnectedWorkContextQueryService(client, protector) as unknown as {
      assertAccessibleInTransaction(
        transaction: import("@evaluation/database").DatabaseTransaction,
        command: { actor: { userId: string; active: boolean }; sourceItemId: string },
      ): Promise<void>;
    };

    await expect(
      client.$transaction((transaction) =>
        query.assertAccessibleInTransaction(transaction, {
          actor: { userId: users.ownerId, active: true },
          sourceItemId: item.id,
        }),
      ),
    ).resolves.toBeUndefined();
    await client.connectedSourceItem.update({ where: { id: item.id }, data: { excluded: true } });
    await expect(
      client.$transaction((transaction) =>
        query.assertAccessibleInTransaction(transaction, {
          actor: { userId: users.ownerId, active: true },
          sourceItemId: item.id,
        }),
      ),
    ).rejects.toMatchObject({ code: "CONNECTED_CONTEXT_FORBIDDEN" });
    await expect(
      client.$transaction((transaction) =>
        query.assertAccessibleInTransaction(transaction, {
          actor: { userId: users.otherEmployeeId, active: true },
          sourceItemId: item.id,
        }),
      ),
    ).rejects.toMatchObject({ code: "CONNECTED_CONTEXT_FORBIDDEN" });
  });

  it("returns decrypted summaries only to the owning active employee", async () => {
    const users = await seedUsers();
    const protector = createPrivateContextProtector({ mode: "development" });
    const title = await protector.seal("Private launch discussion");
    const summary = await protector.seal("Decision and next steps");
    const account = await client.connectedWorkAccount.create({
      data: {
        employeeId: users.ownerId,
        credentialRef: `vault://${crypto.randomUUID()}`,
        connectedAt: now,
      },
    });
    await client.connectedWorkAccount.createMany({
      data: [
        {
          employeeId: users.otherEmployeeId,
          credentialRef: `vault://${crypto.randomUUID()}`,
          connectedAt: now,
        },
        {
          employeeId: users.managerId,
          credentialRef: `vault://${crypto.randomUUID()}`,
          connectedAt: now,
        },
      ],
    });
    const item = await client.connectedSourceItem.create({
      data: {
        connectedWorkAccountId: account.id,
        employeeId: users.ownerId,
        provider: "GOOGLE_GMAIL",
        providerSourceId: "owner-thread",
        occurredAt: now,
        titleCiphertext: title.ciphertext,
        titleKeyVersion: title.keyVersion,
        summaryCiphertext: summary.ciphertext,
        summaryKeyVersion: summary.keyVersion,
        sourceUrl: "https://mail.example.invalid/owner-thread",
      },
    });
    const query = new ConnectedWorkContextQueryService(client, protector);

    await expect(query.list({ actor: { userId: users.ownerId, active: true } })).resolves.toEqual([
      {
        id: item.id,
        employeeId: users.ownerId,
        provider: "GOOGLE_GMAIL",
        providerSourceId: "owner-thread",
        occurredAt: now.toISOString(),
        title: "Private launch discussion",
        summary: "Decision and next steps",
        sourceUrl: "https://mail.example.invalid/owner-thread",
        privacy: "PRIVATE",
        excluded: false,
      },
    ]);
    await expect(
      query.list({ actor: { userId: users.otherEmployeeId, active: true } }),
    ).resolves.toEqual([]);
    await expect(query.list({ actor: { userId: users.managerId, active: true } })).resolves.toEqual(
      [],
    );
    await expect(
      query.get({
        actor: { userId: users.otherEmployeeId, active: true },
        sourceItemId: item.id,
      }),
    ).rejects.toMatchObject({ code: "CONNECTED_CONTEXT_FORBIDDEN" });
    await expect(
      query.get({
        actor: { userId: users.managerId, active: true },
        sourceItemId: item.id,
      }),
    ).rejects.toMatchObject({ code: "CONNECTED_CONTEXT_FORBIDDEN" });
  });

  it("makes all private content inaccessible immediately after disconnect", async () => {
    const users = await seedUsers();
    const protector = createPrivateContextProtector({ mode: "development" });
    const title = await protector.seal("Private calendar event");
    const vault = new DevelopmentOnlyMemoryCredentialVault({ runtimeMode: "development" });
    const credentialRef = (
      await vault.put({
        credential: { accessToken: "disconnect-me", refreshToken: null, expiresAt: null },
      })
    ).credentialRef;
    const account = await client.connectedWorkAccount.create({
      data: {
        employeeId: users.ownerId,
        credentialRef,
        connectedAt: now,
      },
    });
    await client.connectedSourceItem.create({
      data: {
        connectedWorkAccountId: account.id,
        employeeId: users.ownerId,
        provider: "GOOGLE_CALENDAR",
        providerSourceId: "private-calendar-event",
        occurredAt: now,
        titleCiphertext: title.ciphertext,
        titleKeyVersion: title.keyVersion,
      },
    });
    const query = new ConnectedWorkContextQueryService(client, protector);
    const connection = new ConnectedWorkConnectionService({
      database: client,
      credentialVault: vault,
      auditWriter: {
        append: async () => ({ id: crypto.randomUUID(), createdAt: now.toISOString() }),
      },
      projectAuthorization: {
        canLink: async () => false,
        authorizeCurrentMemberInTransaction: async () => undefined,
      },
      clock: () => now,
    });

    await connection.disconnect({
      actor: { userId: users.ownerId, active: true },
      correlationId: crypto.randomUUID(),
    });

    await expect(query.list({ actor: { userId: users.ownerId, active: true } })).resolves.toEqual(
      [],
    );
  });
});
