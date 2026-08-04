import { type GovernedGitHubFacts } from "@evaluation/contracts";

export const GITHUB_APP_MINIMUM_PERMISSIONS = Object.freeze({
  contents: "read",
  metadata: "read",
  pullRequests: "read",
  checks: "read",
  deployments: "read",
} as const);

export type ReconciledGitHubEvent = Readonly<{
  deliveryId: string;
  eventType: string;
  sourceId: string;
  sourceUrl: string;
  occurredAt: string;
  governedFacts: GovernedGitHubFacts;
}>;

export type GitHubAppListEventsResult =
  | Readonly<{ kind: "success"; nextCursor: string; events: readonly ReconciledGitHubEvent[] }>
  | Readonly<{ kind: "deleted_repository" }>
  | Readonly<{ kind: "rate_limited" }>;

export interface GitHubAppClient {
  listEvents(
    input: Readonly<{ installationId: string; repositoryId: string; cursor: string | null }>,
  ): Promise<GitHubAppListEventsResult>;
}

/** A deterministic test-only adapter; it neither authenticates nor stores GitHub credentials. */
export class DeterministicGitHubAppClient implements GitHubAppClient {
  private readonly result: GitHubAppListEventsResult;

  constructor(result: GitHubAppListEventsResult) {
    this.result = result;
  }

  async listEvents(): Promise<GitHubAppListEventsResult> {
    return this.result;
  }
}

export class ExternallyGatedGitHubAppClient implements GitHubAppClient {
  async listEvents(): Promise<GitHubAppListEventsResult> {
    throw new Error(
      "GitHub App creation, installation, organization approval, and credentials require external approval",
    );
  }
}
