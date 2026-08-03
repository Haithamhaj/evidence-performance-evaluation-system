import { GovernedGitHubFactsSchema, type GovernedGitHubFacts } from "@evaluation/contracts";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type DatabaseTransaction = import("@evaluation/database").DatabaseTransaction;

export type VerifiedGitHubGovernedSource = Readonly<{
  sourceEventId: string;
  bindingId: string;
  projectId: string;
  installationId: string;
  repositoryId: string;
  sourceId: string;
  sourceUrl: string;
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
    return readVerifiedSource(this.client, input);
  }

  async getVerifiedSourceIn(
    transaction: DatabaseTransaction,
    input: Readonly<{ sourceEventId: string }>,
  ): Promise<VerifiedGitHubGovernedSource | null> {
    return readVerifiedSource(transaction, input);
  }
}

async function readVerifiedSource(
  database: DatabaseClient | DatabaseTransaction,
  input: Readonly<{ sourceEventId: string }>,
): Promise<VerifiedGitHubGovernedSource | null> {
  const event = await database.gitHubSourceEvent.findUnique({
    where: { id: input.sourceEventId },
    select: {
      id: true,
      bindingId: true,
      installationId: true,
      repositoryId: true,
      sourceId: true,
      sourceUrl: true,
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
    sourceUrl: event.sourceUrl,
    occurredAt: event.occurredAt,
    governedFacts: GovernedGitHubFactsSchema.parse(event.governedFacts),
  };
}
