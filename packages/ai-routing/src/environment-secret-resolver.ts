export class EnvironmentAiCredentialSecretResolver {
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
