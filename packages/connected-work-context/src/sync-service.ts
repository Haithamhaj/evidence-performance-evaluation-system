import { AppError } from "@evaluation/contracts";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type Transaction = import("@evaluation/database").DatabaseTransaction;
type ConnectedSourceProvider = import("@evaluation/contracts").ConnectedSourceProvider;

type SyncServiceDependencies = Readonly<{
  database: DatabaseClient;
  credentialVault: import("./credential-vault.js").CredentialVault;
  protector: import("./credential-vault.js").PrivateContextProtector;
  adapter: import("./source-adapter.js").ConnectedSourceAdapter;
  clock?: () => Date;
}>;

type SyncCommand = Readonly<{
  actor: Readonly<{ userId: string; active: boolean }>;
  provider: ConnectedSourceProvider;
}>;

export type SyncResult = Readonly<{
  processedCount: number;
  normalizedItemCount: number;
  recoveredFromExpiredCursor: boolean;
}>;

export class ConnectedWorkSyncService {
  private readonly database: DatabaseClient;
  private readonly credentialVault: import("./credential-vault.js").CredentialVault;
  private readonly protector: import("./credential-vault.js").PrivateContextProtector;
  private readonly adapter: import("./source-adapter.js").ConnectedSourceAdapter;
  private readonly clock: () => Date;

  constructor(dependencies: SyncServiceDependencies) {
    this.database = dependencies.database;
    this.credentialVault = dependencies.credentialVault;
    this.protector = dependencies.protector;
    this.adapter = dependencies.adapter;
    this.clock = dependencies.clock ?? (() => new Date());
  }

  async sync(command: SyncCommand): Promise<SyncResult> {
    assertActive(command.actor);
    const account = await this.database.connectedWorkAccount.findUnique({
      where: { employeeId: command.actor.userId },
    });
    if (
      account === null ||
      account.disconnectedAt !== null ||
      account.contentInaccessibleAt !== null
    ) {
      throw forbiddenError();
    }

    const cursorRow = await this.database.connectorSyncCursor.findUnique({
      where: {
        connectedWorkAccountId_provider: {
          connectedWorkAccountId: account.id,
          provider: command.provider,
        },
      },
    });
    let syncCursor =
      cursorRow === null
        ? null
        : await this.protector.open({
            ciphertext: cursorRow.cursorCiphertext,
            keyVersion: cursorRow.cursorKeyVersion,
          });
    const exclusions = await this.loadExclusions(account.id, command.provider);
    let recoveredFromExpiredCursor = false;
    let pageCursor: string | null = null;
    let processedCount = 0;
    let pageCount = 0;
    const normalizedIds = new Set<string>();

    await this.credentialVault.use(account.credentialRef, async (credential) => {
      while (true) {
        pageCount += 1;
        if (pageCount > 1_000) {
          throw new AppError(
            "CONNECTED_CONTEXT_SYNC_PAGE_LIMIT",
            "errors.connectedContext.syncPageLimit",
            502,
          );
        }
        const page = await this.adapter.pull({
          provider: command.provider,
          credential,
          syncCursor,
          pageCursor,
          exclusions,
        });
        if (page.kind === "cursor_expired") {
          if (syncCursor === null || recoveredFromExpiredCursor || pageCursor !== null) {
            throw new AppError(
              "CONNECTED_CONTEXT_CURSOR_RECOVERY_FAILED",
              "errors.connectedContext.cursorRecoveryFailed",
              502,
            );
          }
          await this.database.$transaction(async (transaction) => {
            await lockActiveAccount(transaction, account.id, account.credentialRef);
            await transaction.connectorSyncCursor.deleteMany({
              where: {
                connectedWorkAccountId: account.id,
                provider: command.provider,
              },
            });
          });
          recoveredFromExpiredCursor = true;
          syncCursor = null;
          pageCursor = null;
          continue;
        }

        const protectedItems = await Promise.all(
          page.items.map(async (item) => {
            const normalized = normalizeItem(item);
            const title = await this.protector.seal(normalized.title);
            const summary =
              normalized.summary === null ? null : await this.protector.seal(normalized.summary);
            return { normalized, title, summary };
          }),
        );
        const cursorUpdate =
          page.nextPageCursor === null
            ? {
                sealed: await this.protector.seal(page.checkpointCursor),
                synchronizedAt: validDate(this.clock()),
                expiresAt: page.cursorExpiresAt === null ? null : validDate(page.cursorExpiresAt),
              }
            : null;
        await this.database.$transaction(async (transaction) => {
          await lockActiveAccount(transaction, account.id, account.credentialRef);
          for (const item of protectedItems) {
            await upsertSourceItem(transaction, {
              accountId: account.id,
              employeeId: account.employeeId,
              provider: command.provider,
              ...item,
            });
          }
          if (cursorUpdate !== null) {
            await transaction.connectorSyncCursor.upsert({
              where: {
                connectedWorkAccountId_provider: {
                  connectedWorkAccountId: account.id,
                  provider: command.provider,
                },
              },
              create: {
                connectedWorkAccountId: account.id,
                employeeId: account.employeeId,
                provider: command.provider,
                cursorCiphertext: cursorUpdate.sealed.ciphertext,
                cursorKeyVersion: cursorUpdate.sealed.keyVersion,
                lastSuccessfulSyncAt: cursorUpdate.synchronizedAt,
                cursorExpiresAt: cursorUpdate.expiresAt,
              },
              update: {
                cursorCiphertext: cursorUpdate.sealed.ciphertext,
                cursorKeyVersion: cursorUpdate.sealed.keyVersion,
                lastSuccessfulSyncAt: cursorUpdate.synchronizedAt,
                cursorExpiresAt: cursorUpdate.expiresAt,
              },
            });
          }
        });

        processedCount += page.items.length;
        for (const item of page.items) normalizedIds.add(item.providerSourceId);
        if (page.nextPageCursor === null) break;
        pageCursor = page.nextPageCursor;
      }
    });

    return {
      processedCount,
      normalizedItemCount: normalizedIds.size,
      recoveredFromExpiredCursor,
    };
  }

  private async loadExclusions(
    accountId: string,
    provider: ConnectedSourceProvider,
  ): Promise<import("./source-adapter.js").SourceExclusion[]> {
    return this.database.connectedSourceExclusion.findMany({
      where: { connectedWorkAccountId: accountId, provider, revokedAt: null },
      select: { kind: true, providerExclusionId: true },
    });
  }
}

async function lockActiveAccount(
  transaction: Transaction,
  accountId: string,
  credentialRef: string,
): Promise<void> {
  const active = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "ConnectedWorkAccount"
    WHERE id = ${accountId}::uuid
      AND "disconnectedAt" IS NULL
      AND "contentInaccessibleAt" IS NULL
      AND "credentialRef" = ${credentialRef}
    FOR UPDATE
  `;
  if (active.length === 0) throw forbiddenError();
}

async function upsertSourceItem(
  transaction: Transaction,
  input: Readonly<{
    accountId: string;
    employeeId: string;
    provider: ConnectedSourceProvider;
    normalized: import("./source-adapter.js").NormalizedSourceItemInput;
    title: Readonly<{ ciphertext: string; keyVersion: string }>;
    summary: Readonly<{ ciphertext: string; keyVersion: string }> | null;
  }>,
): Promise<void> {
  const protectedFields = {
    occurredAt: validDate(input.normalized.occurredAt),
    titleCiphertext: input.title.ciphertext,
    titleKeyVersion: input.title.keyVersion,
    summaryCiphertext: input.summary?.ciphertext ?? null,
    summaryKeyVersion: input.summary?.keyVersion ?? null,
    sourceUrl: input.normalized.sourceUrl,
  };
  await transaction.connectedSourceItem.upsert({
    where: {
      employeeId_provider_providerSourceId: {
        employeeId: input.employeeId,
        provider: input.provider,
        providerSourceId: input.normalized.providerSourceId,
      },
    },
    create: {
      connectedWorkAccountId: input.accountId,
      employeeId: input.employeeId,
      provider: input.provider,
      providerSourceId: input.normalized.providerSourceId,
      ...protectedFields,
    },
    update: protectedFields,
  });
}

function normalizeItem(
  item: import("./source-adapter.js").NormalizedSourceItemInput,
): import("./source-adapter.js").NormalizedSourceItemInput {
  if (item.providerSourceId.trim().length === 0 || item.providerSourceId.length > 1_000) {
    throw new AppError(
      "CONNECTED_CONTEXT_SOURCE_INVALID",
      "errors.connectedContext.sourceInvalid",
      502,
    );
  }
  validDate(item.occurredAt);
  if (item.sourceUrl !== null) {
    try {
      new URL(item.sourceUrl);
    } catch {
      throw new AppError(
        "CONNECTED_CONTEXT_SOURCE_INVALID",
        "errors.connectedContext.sourceInvalid",
        502,
      );
    }
  }
  return item;
}

function validDate(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(
      "CONNECTED_CONTEXT_SOURCE_INVALID",
      "errors.connectedContext.sourceInvalid",
      502,
    );
  }
  return date;
}

function assertActive(actor: Readonly<{ active: boolean }>): void {
  if (!actor.active) throw forbiddenError();
}

function forbiddenError(): AppError {
  return new AppError("CONNECTED_CONTEXT_FORBIDDEN", "errors.connectedContext.forbidden", 403);
}
