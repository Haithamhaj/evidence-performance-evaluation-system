import { GovernedGitHubFactsSchema } from "@evaluation/contracts";

export interface ActiveGitHubBindingReader {
  listActive(): Promise<readonly import("./webhook-service.js").GitHubBinding[]>;
}

export interface GitHubReconciliationCursorStore {
  find(bindingId: string): Promise<string | null>;
  save(
    input: Readonly<{
      bindingId: string;
      installationId: string;
      repositoryId: string;
      cursor: string;
    }>,
  ): Promise<void>;
}

export class GitHubReconciliationService {
  private readonly dependencies: Readonly<{
    bindings: ActiveGitHubBindingReader;
    cursors: GitHubReconciliationCursorStore;
    client: import("./github-app-client.js").GitHubAppClient;
    receipts: Pick<import("./webhook-service.js").GitHubReceiptWriter, "receive">;
  }>;

  constructor(
    dependencies: Readonly<{
      bindings: ActiveGitHubBindingReader;
      cursors: GitHubReconciliationCursorStore;
      client: import("./github-app-client.js").GitHubAppClient;
      receipts: Pick<import("./webhook-service.js").GitHubReceiptWriter, "receive">;
    }>,
  ) {
    this.dependencies = dependencies;
  }

  async reconcile(): Promise<
    Readonly<{ recovered: number; rateLimited: number; deleted: number }>
  > {
    const result = { recovered: 0, rateLimited: 0, deleted: 0 };
    for (const binding of await this.dependencies.bindings.listActive()) {
      const response = await this.dependencies.client.listEvents({
        installationId: binding.installationId,
        repositoryId: binding.repositoryId,
        cursor: await this.dependencies.cursors.find(binding.id),
      });
      if (response.kind === "rate_limited") {
        result.rateLimited += 1;
        continue;
      }
      if (response.kind === "deleted_repository") {
        result.deleted += 1;
        continue;
      }
      for (const event of response.events) {
        await this.dependencies.receipts.receive({
          bindingId: binding.id,
          projectId: binding.projectId,
          installationRecordId: binding.installationRecordId,
          installationId: binding.installationId,
          repositoryId: binding.repositoryId,
          deliveryId: event.deliveryId,
          eventType: event.eventType,
          sourceId: event.sourceId,
          sourceUrl: event.sourceUrl,
          occurredAt: event.occurredAt,
          governedFacts: GovernedGitHubFactsSchema.parse(event.governedFacts),
        });
        result.recovered += 1;
      }
      await this.dependencies.cursors.save({
        bindingId: binding.id,
        installationId: binding.installationRecordId,
        repositoryId: binding.repositoryId,
        cursor: response.nextCursor,
      });
    }
    return result;
  }
}
