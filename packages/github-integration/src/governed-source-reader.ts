import { GovernedGitHubFactsSchema, type GovernedGitHubFacts } from "@evaluation/contracts";

type DatabaseClient = import("@evaluation/database").DatabaseClient;

export type VerifiedGitHubGovernedSource = Readonly<{
  sourceEventId: string;
  bindingId: string;
  projectId: string;
  installationId: string;
  repositoryId: string;
  sourceId: string;
  occurredAt: Date;
  governedFacts: GovernedGitHubFacts;
}>;

/** Public boundary for consuming verified GitHub facts without connector-table access. */
export interface GitHubGovernedSourceReader {
  getVerifiedSource(
    input: Readonly<{ sourceEventId: string }>,
  ): Promise<VerifiedGitHubGovernedSource | null>;
}

export class DatabaseGitHubGovernedSourceReader implements GitHubGovernedSourceReader {
  private readonly client: DatabaseClient;

  constructor(client: DatabaseClient) {
    this.client = client;
  }

  async getVerifiedSource(
    input: Readonly<{ sourceEventId: string }>,
  ): Promise<VerifiedGitHubGovernedSource | null> {
    const event = await this.client.gitHubSourceEvent.findUnique({
      where: { id: input.sourceEventId },
      select: {
        id: true,
        bindingId: true,
        installationId: true,
        repositoryId: true,
        sourceId: true,
        occurredAt: true,
        verificationState: true,
        governedFacts: true,
        binding: { select: { projectId: true } },
      },
    });
    if (event === null || event.verificationState !== "VERIFIED") return null;

    return {
      sourceEventId: event.id,
      bindingId: event.bindingId,
      projectId: event.binding.projectId,
      installationId: event.installationId,
      repositoryId: event.repositoryId,
      sourceId: event.sourceId,
      occurredAt: event.occurredAt,
      governedFacts: GovernedGitHubFactsSchema.parse(event.governedFacts),
    };
  }
}
