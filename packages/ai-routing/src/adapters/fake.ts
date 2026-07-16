import { AiProviderError } from "../contracts.js";

type FakeResponse =
  unknown | Readonly<{ errorCategory: import("../contracts.js").ProviderErrorCategory }>;

export class FakeAiProviderAdapter {
  readonly requests: import("../contracts.js").ProviderRequest[] = [];
  readonly providerKey: string;
  readonly locality: import("../contracts.js").ProviderLocality;
  private readonly response: FakeResponse | (() => FakeResponse);

  constructor(
    providerKey: string,
    locality: import("../contracts.js").ProviderLocality,
    response: FakeResponse | (() => FakeResponse),
  ) {
    this.providerKey = providerKey;
    this.locality = locality;
    this.response = response;
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
    return provider.providerKey === this.providerKey && provider.locality === this.locality;
  }
}

function isUsage(value: unknown): value is import("../contracts.js").ProviderUsage {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return ["inputTokens", "outputTokens", "totalTokens"].every(
    (key) => record[key] === undefined || typeof record[key] === "number",
  );
}
