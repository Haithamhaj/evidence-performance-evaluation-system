import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient } from "@evaluation/database";
import { afterAll, describe, expect, it } from "vitest";

import { ConnectedWorkConnectionService } from "./connection-service.js";
import {
  createPrivateContextProtector,
  DevelopmentOnlyMemoryCredentialVault,
} from "./credential-vault.js";
import { FakeGoogleWorkspaceAdapter } from "./fake-google-workspace-adapter.js";
import { ConnectedWorkSyncService } from "./sync-service.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const now = new Date("2026-07-20T09:00:00.000Z");

async function seedSyncAccount(vault: DevelopmentOnlyMemoryCredentialVault) {
  const suffix = crypto.randomUUID();
  const employeeId = crypto.randomUUID();
  await client.user.create({
    data: {
      id: employeeId,
      email: `sync-owner-${suffix}@example.invalid`,
      displayName: "Sync Owner",
    },
  });
  const { credentialRef } = await vault.put({
    credential: {
      accessToken: "fake-adapter-access",
      refreshToken: "fake-adapter-refresh",
      expiresAt: "2026-07-20T10:00:00.000Z",
    },
  });
  const account = await client.connectedWorkAccount.create({
    data: { employeeId, credentialRef, connectedAt: now },
  });
  return { account, employeeId };
}

function gmailItem(providerSourceId: string, title: string, minute: number) {
  return {
    providerSourceId,
    occurredAt: `2026-07-20T09:${String(minute).padStart(2, "0")}:00.000Z`,
    title,
    summary: `${title} summary`,
    sourceUrl: `https://mail.example.invalid/${providerSourceId}`,
  };
}

afterAll(async () => client.$disconnect());

describe("connected work synchronization", () => {
  it("does not commit an item or cursor after disconnect succeeds during a blocked provider pull", async () => {
    const vault = new DevelopmentOnlyMemoryCredentialVault({ runtimeMode: "development" });
    const graph = await seedSyncAccount(vault);
    const protector = createPrivateContextProtector({ mode: "development" });
    let signalPullStarted!: () => void;
    let releasePull!: () => void;
    const pullStarted = new Promise<void>((resolve) => {
      signalPullStarted = resolve;
    });
    const pullReleased = new Promise<void>((resolve) => {
      releasePull = resolve;
    });
    const syncService = new ConnectedWorkSyncService({
      database: client,
      credentialVault: vault,
      protector,
      adapter: {
        pull: async () => {
          signalPullStarted();
          await pullReleased;
          return {
            kind: "page",
            items: [gmailItem("late-thread", "Must not persist", 4)],
            nextPageCursor: null,
            checkpointCursor: "late-checkpoint",
            cursorExpiresAt: null,
          };
        },
      },
      clock: () => now,
    });
    const disconnectService = new ConnectedWorkConnectionService({
      database: client,
      credentialVault: vault,
      auditWriter: databaseAuditWriter,
      projectAuthorization: {
        canLink: async () => false,
        authorizeCurrentMemberInTransaction: async () => undefined,
      },
      clock: () => now,
    });
    const syncResult = syncService.sync({
      actor: { userId: graph.employeeId, active: true },
      provider: "GOOGLE_GMAIL",
    });

    await pullStarted;
    await disconnectService.disconnect({
      actor: { userId: graph.employeeId, active: true },
      correlationId: crypto.randomUUID(),
    });
    await disconnectService.connect({
      actor: { userId: graph.employeeId, active: true },
      correlationId: crypto.randomUUID(),
      credential: {
        accessToken: "replacement-credential",
        refreshToken: null,
        expiresAt: null,
      },
    });
    releasePull();

    await expect(syncResult).rejects.toMatchObject({ code: "CONNECTED_CONTEXT_FORBIDDEN" });
    await expect(
      client.connectedSourceItem.count({
        where: { connectedWorkAccountId: graph.account.id },
      }),
    ).resolves.toBe(0);
    await expect(
      client.connectorSyncCursor.count({
        where: { connectedWorkAccountId: graph.account.id },
      }),
    ).resolves.toBe(0);
  });

  it("honors reversible Gmail-label and Calendar exclusions during synchronization", async () => {
    const vault = new DevelopmentOnlyMemoryCredentialVault({ runtimeMode: "development" });
    const graph = await seedSyncAccount(vault);
    const connection = new ConnectedWorkConnectionService({
      database: client,
      credentialVault: vault,
      auditWriter: databaseAuditWriter,
      projectAuthorization: {
        canLink: async () => false,
        authorizeCurrentMemberInTransaction: async () => undefined,
      },
      clock: () => new Date("2026-07-28T09:00:00.000Z"),
    });
    const actor = { userId: graph.employeeId, active: true };
    await connection.setSourceExclusion({
      actor,
      correlationId: crypto.randomUUID(),
      provider: "GOOGLE_GMAIL",
      kind: "GMAIL_LABEL",
      providerExclusionId: "private-project-label",
      excluded: true,
    });
    await connection.setSourceExclusion({
      actor,
      correlationId: crypto.randomUUID(),
      provider: "GOOGLE_CALENDAR",
      kind: "CALENDAR",
      providerExclusionId: "private-work-calendar",
      excluded: true,
    });
    const adapter = new FakeGoogleWorkspaceAdapter({
      pageSize: 2,
      fixtures: {
        GOOGLE_GMAIL: [
          {
            ...gmailItem("excluded-thread", "Excluded Gmail", 5),
            exclusionKeys: [{ kind: "GMAIL_LABEL", providerExclusionId: "private-project-label" }],
          },
        ],
        GOOGLE_CALENDAR: [
          {
            ...gmailItem("excluded-event", "Excluded Calendar", 6),
            exclusionKeys: [{ kind: "CALENDAR", providerExclusionId: "private-work-calendar" }],
          },
        ],
      },
    });
    const sync = new ConnectedWorkSyncService({
      database: client,
      credentialVault: vault,
      protector: createPrivateContextProtector({ mode: "development" }),
      adapter,
      clock: () => now,
    });

    await sync.sync({ actor, provider: "GOOGLE_GMAIL" });
    await sync.sync({ actor, provider: "GOOGLE_CALENDAR" });
    await expect(
      client.connectedSourceItem.count({ where: { connectedWorkAccountId: graph.account.id } }),
    ).resolves.toBe(0);

    await connection.setSourceExclusion({
      actor,
      correlationId: crypto.randomUUID(),
      provider: "GOOGLE_GMAIL",
      kind: "GMAIL_LABEL",
      providerExclusionId: "private-project-label",
      excluded: false,
    });
    await sync.sync({ actor, provider: "GOOGLE_GMAIL" });
    await expect(
      client.connectedSourceItem.count({
        where: { connectedWorkAccountId: graph.account.id, provider: "GOOGLE_GMAIL" },
      }),
    ).resolves.toBe(1);
  });

  it("ingests repeated provider events across repeated pages idempotently", async () => {
    const vault = new DevelopmentOnlyMemoryCredentialVault({ runtimeMode: "development" });
    const graph = await seedSyncAccount(vault);
    const protector = createPrivateContextProtector({ mode: "development" });
    const adapter = new FakeGoogleWorkspaceAdapter({
      pageSize: 1,
      fixtures: {
        GOOGLE_GMAIL: [
          gmailItem("thread-1", "First thread", 0),
          gmailItem("thread-1", "First thread updated", 1),
          gmailItem("thread-2", "Second thread", 2),
        ],
        GOOGLE_CALENDAR: [],
      },
    });
    const service = new ConnectedWorkSyncService({
      database: client,
      credentialVault: vault,
      protector,
      adapter,
      clock: () => now,
    });

    const result = await service.sync({
      actor: { userId: graph.employeeId, active: true },
      provider: "GOOGLE_GMAIL",
    });

    expect(result).toEqual({
      processedCount: 3,
      normalizedItemCount: 2,
      recoveredFromExpiredCursor: false,
    });
    await expect(
      client.connectedSourceItem.count({
        where: { employeeId: graph.employeeId, provider: "GOOGLE_GMAIL" },
      }),
    ).resolves.toBe(2);
    await expect(
      client.connectedSourceItem.findUniqueOrThrow({
        where: {
          employeeId_provider_providerSourceId: {
            employeeId: graph.employeeId,
            provider: "GOOGLE_GMAIL",
            providerSourceId: "thread-1",
          },
        },
      }),
    ).resolves.toMatchObject({ occurredAt: new Date("2026-07-20T09:01:00.000Z") });
    await expect(
      client.connectorSyncCursor.findUniqueOrThrow({
        where: {
          connectedWorkAccountId_provider: {
            connectedWorkAccountId: graph.account.id,
            provider: "GOOGLE_GMAIL",
          },
        },
      }),
    ).resolves.toMatchObject({ lastSuccessfulSyncAt: now });
  });

  it("recovers an expired provider cursor with a full replay and no duplicate normalized items", async () => {
    const vault = new DevelopmentOnlyMemoryCredentialVault({ runtimeMode: "development" });
    const graph = await seedSyncAccount(vault);
    const protector = createPrivateContextProtector({ mode: "development" });
    const initialAdapter = new FakeGoogleWorkspaceAdapter({
      pageSize: 10,
      fixtures: {
        GOOGLE_GMAIL: [gmailItem("thread-1", "Original thread", 0)],
        GOOGLE_CALENDAR: [],
      },
    });
    await new ConnectedWorkSyncService({
      database: client,
      credentialVault: vault,
      protector,
      adapter: initialAdapter,
      clock: () => now,
    }).sync({
      actor: { userId: graph.employeeId, active: true },
      provider: "GOOGLE_GMAIL",
    });
    const cursor = await client.connectorSyncCursor.findUniqueOrThrow({
      where: {
        connectedWorkAccountId_provider: {
          connectedWorkAccountId: graph.account.id,
          provider: "GOOGLE_GMAIL",
        },
      },
    });
    const openedCursor = await protector.open({
      ciphertext: cursor.cursorCiphertext,
      keyVersion: cursor.cursorKeyVersion,
    });
    const recoveryAdapter = new FakeGoogleWorkspaceAdapter({
      pageSize: 10,
      expiredSyncCursors: [openedCursor],
      fixtures: {
        GOOGLE_GMAIL: [
          gmailItem("thread-1", "Original thread", 0),
          gmailItem("thread-2", "Recovered thread", 3),
        ],
        GOOGLE_CALENDAR: [],
      },
    });
    const result = await new ConnectedWorkSyncService({
      database: client,
      credentialVault: vault,
      protector,
      adapter: recoveryAdapter,
      clock: () => now,
    }).sync({
      actor: { userId: graph.employeeId, active: true },
      provider: "GOOGLE_GMAIL",
    });

    expect(result).toEqual({
      processedCount: 2,
      normalizedItemCount: 2,
      recoveredFromExpiredCursor: true,
    });
    await expect(
      client.connectedSourceItem.count({
        where: { employeeId: graph.employeeId, provider: "GOOGLE_GMAIL" },
      }),
    ).resolves.toBe(2);
  });

  it("labels deterministic protection as development-only and blocks live mode without a production key provider", async () => {
    const protector = createPrivateContextProtector({ mode: "development" });
    const sealed = await protector.seal("private value");

    expect(sealed.keyVersion).toBe("development-only-v1");
    expect(sealed.ciphertext).toMatch(/^development-only:/u);
    expect(() => createPrivateContextProtector({ mode: "live", keyProvider: undefined })).toThrow(
      "Production cryptographic key provider is required for live mode",
    );
    expect(() =>
      createPrivateContextProtector({
        mode: "live",
        keyProvider: {
          runtimeMode: "development",
          seal: async (value: string) => ({
            ciphertext: value,
            keyVersion: "not-production",
          }),
          open: async ({ ciphertext }: { ciphertext: string }) => ciphertext,
        } as never,
      }),
    ).toThrow("Production cryptographic key provider is required for live mode");
  });
});
