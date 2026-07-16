import { AiProviderError } from "../contracts.js";

type FakeResponse =
  unknown | Readonly<{ errorCategory: import("../contracts.js").ProviderErrorCategory }>;

export class FakeAiProviderAdapter {
  readonly requests: import("../contracts.js").ProviderRequest[] = [];
  readonly providerKey: string;
  readonly adapterKey: string;
  readonly locality: import("../contracts.js").ProviderLocality;
  private readonly response: FakeResponse | (() => FakeResponse);
  private readonly localTrustPolicy:
    Readonly<{ id: string; version: number; allowedIp: string }> | undefined;

  constructor(
    providerKey: string,
    locality: import("../contracts.js").ProviderLocality,
    response: FakeResponse | (() => FakeResponse),
    localTrustPolicy?: Readonly<{ id: string; version: number; allowedIp: string }>,
  ) {
    this.providerKey = providerKey;
    this.adapterKey = providerKey;
    this.locality = locality;
    this.response = response;
    this.localTrustPolicy = localTrustPolicy;
  }

  async generate(
    request: import("../contracts.js").ProviderRequest,
    signal: AbortSignal,
  ): Promise<import("../contracts.js").ProviderResult> {
    if (signal.aborted) throw new AiProviderError("timeout");
    this.requests.push(request);
    const fixture = typeof this.response === "function" ? this.response() : this.response;
    if (
      fixture !== null &&
      typeof fixture === "object" &&
      "errorCategory" in fixture &&
      typeof fixture.errorCategory === "string"
    ) {
      throw new AiProviderError(
        fixture.errorCategory as import("../contracts.js").ProviderErrorCategory,
      );
    }
    if (fixture !== null && typeof fixture === "object" && !Array.isArray(fixture)) {
      const { usage, costUsd, ...output } = fixture as Record<string, unknown>;
      return {
        output,
        ...(isUsage(usage) ? { usage } : {}),
        ...(typeof costUsd === "number" ? { costUsd } : {}),
      };
    }
    return { output: fixture };
  }

  matchesConfiguration(provider: import("../contracts.js").AiProviderRoute): boolean {
    return (
      provider.providerKey === this.providerKey &&
      provider.adapterKey === this.adapterKey &&
      provider.locality === this.locality &&
      provider.localTrustPolicyId === (this.localTrustPolicy?.id ?? null) &&
      provider.localTrustPolicyVersion === (this.localTrustPolicy?.version ?? null) &&
      provider.localTrustAllowedIp === (this.localTrustPolicy?.allowedIp ?? null)
    );
  }
}

function isUsage(value: unknown): value is import("../contracts.js").ProviderUsage {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return ["inputTokens", "outputTokens", "totalTokens"].every(
    (key) => record[key] === undefined || typeof record[key] === "number",
  );
}
