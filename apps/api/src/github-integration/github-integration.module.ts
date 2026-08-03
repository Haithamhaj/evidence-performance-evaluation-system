import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient, withTransaction } from "@evaluation/database";
import {
  ExternallyGatedGitHubAppClient,
  GitHubReconciliationService,
  GitHubWebhookService,
} from "@evaluation/github-integration";
import { Module } from "@nestjs/common";

import { GitHubWebhookController } from "./github-webhook.controller.js";

const GITHUB_DATABASE = Symbol("GITHUB_DATABASE");
const GITHUB_BINDINGS = Symbol("GITHUB_BINDINGS");
const GITHUB_RECEIPTS = Symbol("GITHUB_RECEIPTS");
const GITHUB_CURSORS = Symbol("GITHUB_CURSORS");
const GITHUB_DATABASE_LIFECYCLE = Symbol("GITHUB_DATABASE_LIFECYCLE");

class PrismaGitHubStore {
  private readonly database: ReturnType<typeof createDatabaseClient>;

  constructor(database: ReturnType<typeof createDatabaseClient>) {
    this.database = database;
  }

  async findActive(installationId: string, repositoryId: string) {
    const binding = await this.database.gitHubProjectBinding.findFirst({
      where: { repositoryId, unboundAt: null, installation: { installationId } },
      include: { installation: true },
      orderBy: { boundAt: "desc" },
    });
    if (binding === null) return null;
    return serializeBinding(binding);
  }

  async listActive() {
    const bindings = await this.database.gitHubProjectBinding.findMany({
      where: { unboundAt: null },
      include: { installation: true },
      orderBy: { boundAt: "asc" },
    });
    return bindings.map(serializeBinding);
  }

  async receive(receipt: import("@evaluation/github-integration").NormalizedGitHubReceipt) {
    return withTransaction(this.database, async (transaction) => {
      try {
        const event = await transaction.gitHubSourceEvent.create({
          data: {
            bindingId: receipt.bindingId,
            installationId: receipt.installationRecordId,
            repositoryId: receipt.repositoryId,
            deliveryId: receipt.deliveryId,
            eventType: receipt.eventType,
            sourceId: receipt.sourceId,
            sourceUrl: receipt.sourceUrl,
            occurredAt: new Date(receipt.occurredAt),
            verificationState: "VERIFIED",
            governedFacts: receipt.governedFacts,
          },
        });
        await databaseAuditWriter.append(transaction, {
          eventType: "github.source_event.received",
          actor: { kind: "service", id: "bootstrap" },
          effectiveSubjectId: receipt.projectId,
          scopeType: "project",
          scopeId: receipt.projectId,
          targetType: "github_source_event",
          targetId: event.id,
          safeDiff: {
            deliveryId: receipt.deliveryId,
            eventType: receipt.eventType,
            sourceId: receipt.sourceId,
            governedFactKinds: receipt.governedFacts.map((fact) => fact.kind),
          },
          correlationId: crypto.randomUUID(),
          source: "api",
        });
        return { receipt: "created" as const };
      } catch (error) {
        if (isUniqueDelivery(error)) return { receipt: "duplicate" as const };
        throw error;
      }
    });
  }
}

class PrismaGithubCursors {
  private readonly database: ReturnType<typeof createDatabaseClient>;

  constructor(database: ReturnType<typeof createDatabaseClient>) {
    this.database = database;
  }

  async find(bindingId: string) {
    const cursor = await this.database.gitHubReconciliationCursor.findUnique({
      where: { bindingId },
    });
    return cursor?.cursor ?? null;
  }

  async save(
    input: Readonly<{
      bindingId: string;
      installationId: string;
      repositoryId: string;
      cursor: string;
    }>,
  ) {
    await this.database.gitHubReconciliationCursor.upsert({
      where: { bindingId: input.bindingId },
      create: {
        bindingId: input.bindingId,
        installationId: input.installationId,
        repositoryId: input.repositoryId,
        cursor: input.cursor,
        lastReconciledAt: new Date(),
      },
      update: { cursor: input.cursor, lastReconciledAt: new Date() },
    });
  }
}

function serializeBinding(
  binding: Readonly<{
    id: string;
    projectId: string;
    installationId: string;
    repositoryId: string;
    installation: Readonly<{ installationId: string }>;
  }>,
) {
  return {
    id: binding.id,
    projectId: binding.projectId,
    installationRecordId: binding.installationId,
    installationId: binding.installation.installationId,
    repositoryId: binding.repositoryId,
  };
}

function isUniqueDelivery(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function requiredDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (url === undefined || url.length === 0) throw new Error("DATABASE_URL must be configured");
  return url;
}

/** Live GitHub setup remains unavailable until an administrator completes the external approval gate. */
export class GitHubIntegrationModule {}

Module({
  controllers: [GitHubWebhookController],
  providers: [
    {
      provide: GITHUB_DATABASE,
      useFactory: () => createDatabaseClient(requiredDatabaseUrl()),
    },
    {
      provide: GITHUB_BINDINGS,
      useFactory: (database: ReturnType<typeof createDatabaseClient>) =>
        new PrismaGitHubStore(database),
      inject: [GITHUB_DATABASE],
    },
    {
      provide: GITHUB_RECEIPTS,
      useExisting: GITHUB_BINDINGS,
    },
    {
      provide: GITHUB_CURSORS,
      useFactory: (database: ReturnType<typeof createDatabaseClient>) =>
        new PrismaGithubCursors(database),
      inject: [GITHUB_DATABASE],
    },
    {
      provide: GitHubWebhookService,
      useFactory: (
        bindings: import("@evaluation/github-integration").GitHubBindingReader,
        receipts: import("@evaluation/github-integration").GitHubReceiptWriter,
      ) =>
        new GitHubWebhookService({
          // Empty by default: a live App, installation, webhook secret, and organization approval are external gates.
          webhookSecret: process.env.GITHUB_WEBHOOK_SECRET?.trim() ?? "",
          bindingReader: bindings,
          receipts,
        }),
      inject: [GITHUB_BINDINGS, GITHUB_RECEIPTS],
    },
    {
      provide: GitHubReconciliationService,
      useFactory: (
        bindings: import("@evaluation/github-integration").ActiveGitHubBindingReader,
        cursors: PrismaGithubCursors,
        receipts: import("@evaluation/github-integration").GitHubReceiptWriter,
      ) =>
        new GitHubReconciliationService({
          bindings,
          cursors,
          client: new ExternallyGatedGitHubAppClient(),
          receipts,
        }),
      inject: [GITHUB_BINDINGS, GITHUB_CURSORS, GITHUB_RECEIPTS],
    },
    {
      provide: GITHUB_DATABASE_LIFECYCLE,
      useFactory: (database: ReturnType<typeof createDatabaseClient>) => ({
        onModuleDestroy: () => database.$disconnect(),
      }),
      inject: [GITHUB_DATABASE],
    },
  ],
})(GitHubIntegrationModule);
