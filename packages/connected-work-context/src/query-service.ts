import { AppError, ConnectedSourceItemSchema } from "@evaluation/contracts";

import { assertAccessibleConnectedSource } from "./source-authorization.js";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type Transaction = import("@evaluation/database").DatabaseTransaction;
type Actor = Readonly<{ userId: string; active: boolean }>;
type ContextReview = Readonly<{
  connection: Readonly<{
    status: "connected" | "disconnected";
    lastSuccessfulSyncAt: string | null;
  }>;
  items: readonly (import("@evaluation/contracts").ConnectedSourceItem &
    Readonly<{ projectId: string | null }>)[];
  sourceExclusions: readonly (import("./source-adapter.js").SourceExclusion &
    Readonly<{ provider: import("@evaluation/contracts").ConnectedSourceProvider }>)[];
}>;

export class ConnectedWorkContextQueryService {
  private readonly database: DatabaseClient;
  private readonly protector: import("./credential-vault.js").PrivateContextProtector;

  constructor(
    database: DatabaseClient,
    protector: import("./credential-vault.js").PrivateContextProtector,
  ) {
    this.database = database;
    this.protector = protector;
  }

  async list(command: Readonly<{ actor: Actor }>) {
    assertActive(command.actor);
    const account = await this.database.connectedWorkAccount.findUnique({
      where: { employeeId: command.actor.userId },
    });
    if (
      account === null ||
      account.disconnectedAt !== null ||
      account.contentInaccessibleAt !== null
    ) {
      return [];
    }
    const rows = await this.database.connectedSourceItem.findMany({
      where: {
        connectedWorkAccountId: account.id,
        employeeId: command.actor.userId,
        deletedAt: null,
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    });
    return Promise.all(rows.map((row) => this.serialize(row)));
  }

  async review(command: Readonly<{ actor: Actor }>): Promise<ContextReview> {
    assertActive(command.actor);
    const account = await this.database.connectedWorkAccount.findUnique({
      where: { employeeId: command.actor.userId },
    });
    if (
      account === null ||
      account.disconnectedAt !== null ||
      account.contentInaccessibleAt !== null
    ) {
      return {
        connection: { status: "disconnected" as const, lastSuccessfulSyncAt: null },
        items: [],
        sourceExclusions: [],
      };
    }
    const [cursor, rows, sourceExclusions] = await Promise.all([
      this.database.connectorSyncCursor.findFirst({
        where: { connectedWorkAccountId: account.id, employeeId: command.actor.userId },
        orderBy: { lastSuccessfulSyncAt: "desc" },
        select: { lastSuccessfulSyncAt: true },
      }),
      this.database.connectedSourceItem.findMany({
        where: {
          connectedWorkAccountId: account.id,
          employeeId: command.actor.userId,
          deletedAt: null,
        },
        include: {
          projectLinks: {
            where: { unlinkedAt: null },
            select: { projectId: true },
            take: 1,
          },
        },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      }),
      this.database.connectedSourceExclusion.findMany({
        where: {
          connectedWorkAccountId: account.id,
          employeeId: command.actor.userId,
          revokedAt: null,
        },
        select: {
          provider: true,
          kind: true,
          providerExclusionId: true,
        },
      }),
    ]);
    return {
      connection: {
        status: "connected" as const,
        lastSuccessfulSyncAt: cursor?.lastSuccessfulSyncAt.toISOString() ?? null,
      },
      items: await Promise.all(
        rows.map(async (row) => ({
          ...(await this.serialize(row)),
          projectId: row.projectLinks[0]?.projectId ?? null,
        })),
      ),
      sourceExclusions,
    };
  }

  async get(command: Readonly<{ actor: Actor; sourceItemId: string }>) {
    assertActive(command.actor);
    const row = await this.database.connectedSourceItem.findUnique({
      where: { id: command.sourceItemId },
      include: {
        connectedWorkAccount: {
          select: { disconnectedAt: true, contentInaccessibleAt: true },
        },
      },
    });
    if (
      row === null ||
      row.employeeId !== command.actor.userId ||
      row.deletedAt !== null ||
      row.connectedWorkAccount.disconnectedAt !== null ||
      row.connectedWorkAccount.contentInaccessibleAt !== null
    ) {
      throw forbiddenError();
    }
    return this.serialize(row);
  }

  async assertAccessibleInTransaction(
    transaction: Transaction,
    command: Readonly<{ actor: Actor; sourceItemId: string }>,
  ): Promise<void> {
    await assertAccessibleConnectedSource(transaction, command);
  }

  async readProjectAnchorFacts(command: Readonly<{ actor: Actor; sourceItemId: string }>): Promise<
    Readonly<{
      links: readonly Readonly<{
        id: string;
        projectId: string;
        linkedAt: Date;
        unlinkedAt: Date | null;
      }>[];
      corrections: readonly Readonly<{
        id: string;
        action: "CORRECT" | "REJECT";
        previousProjectId: string | null;
        correctedProjectId: string | null;
        createdAt: Date;
      }>[];
    }>
  > {
    assertActive(command.actor);
    return this.database.$transaction(async (transaction) => {
      await assertAccessibleConnectedSource(transaction, command);
      const [links, corrections] = await Promise.all([
        transaction.sourceProjectLink.findMany({
          where: {
            sourceItemId: command.sourceItemId,
            employeeId: command.actor.userId,
          },
          select: {
            id: true,
            projectId: true,
            linkedAt: true,
            unlinkedAt: true,
          },
          orderBy: [{ linkedAt: "desc" }, { id: "desc" }],
        }),
        transaction.sourceLinkCorrection.findMany({
          where: {
            sourceItemId: command.sourceItemId,
            employeeId: command.actor.userId,
          },
          select: {
            id: true,
            action: true,
            previousProjectId: true,
            correctedProjectId: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
      ]);
      return { links, corrections };
    });
  }

  private async serialize(row: {
    id: string;
    employeeId: string;
    provider: "GOOGLE_GMAIL" | "GOOGLE_CALENDAR";
    providerSourceId: string;
    occurredAt: Date;
    titleCiphertext: string;
    titleKeyVersion: string;
    summaryCiphertext: string | null;
    summaryKeyVersion: string | null;
    sourceUrl: string | null;
    privacy: "PRIVATE";
    excluded: boolean;
  }) {
    const title = await this.protector.open({
      ciphertext: row.titleCiphertext,
      keyVersion: row.titleKeyVersion,
    });
    const summary =
      row.summaryCiphertext === null || row.summaryKeyVersion === null
        ? null
        : await this.protector.open({
            ciphertext: row.summaryCiphertext,
            keyVersion: row.summaryKeyVersion,
          });
    return ConnectedSourceItemSchema.parse({
      id: row.id,
      employeeId: row.employeeId,
      provider: row.provider,
      providerSourceId: row.providerSourceId,
      occurredAt: row.occurredAt.toISOString(),
      title,
      summary,
      sourceUrl: row.sourceUrl,
      privacy: row.privacy,
      excluded: row.excluded,
    });
  }
}

function assertActive(actor: Actor): void {
  if (!actor.active) throw forbiddenError();
}

function forbiddenError(): AppError {
  return new AppError("CONNECTED_CONTEXT_FORBIDDEN", "errors.connectedContext.forbidden", 403);
}
