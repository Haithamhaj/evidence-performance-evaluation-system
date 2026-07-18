import { createRuntimeAiRouter } from "@evaluation/ai-routing";

export const ANALYSIS_CRITERIA_DATABASE = Symbol("ANALYSIS_CRITERIA_DATABASE");
export const ANALYSIS_CRITERIA_AI_ROUTER = Symbol("ANALYSIS_CRITERIA_AI_ROUTER");
export const ANALYSIS_CRITERIA_SECRET_RESOLVER = Symbol("ANALYSIS_CRITERIA_SECRET_RESOLVER");

export class WorkerEnvironmentAiCredentialSecretResolver {
  private readonly environment: Readonly<Record<string, string | undefined>>;

  constructor(environment: Readonly<Record<string, string | undefined>> = process.env) {
    this.environment = environment;
  }

  async get(providerKey: string): Promise<string | undefined> {
    const normalized = providerKey.toUpperCase().replace(/[^A-Z0-9]+/gu, "_");
    if (normalized.length === 0) return undefined;
    const providerSpecific = this.environment[`AI_PROVIDER_${normalized}_API_KEY`]?.trim();
    const value =
      providerSpecific === undefined || providerSpecific.length === 0
        ? normalized === "OPENAI"
          ? this.environment.OPENAI_API_KEY?.trim()
          : undefined
        : providerSpecific;
    return value === undefined || value.length === 0 ? undefined : value;
  }
}

export function createWorkerRuntimeAiRouter(
  database: import("@evaluation/database").DatabaseClient,
  secretResolver: import("@evaluation/ai-routing").AiCredentialSecretResolver,
): Promise<
  import("@evaluation/ai-routing").AiRouter<import("@evaluation/database").DatabaseTransaction>
> {
  return createRuntimeAiRouter({ database, secretResolver });
}
