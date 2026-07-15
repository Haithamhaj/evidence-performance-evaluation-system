import { AppError } from "@evaluation/contracts";

import { AiProviderError } from "../contracts.js";

type FetchImplementation = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type OpenAiCompatibleAdapterOptions = Readonly<{
  providerKey: string;
  locality: import("../contracts.js").ProviderLocality;
  baseUrl: string;
  credentialProvider: () => Promise<string | undefined>;
  fetchImplementation?: FetchImplementation;
}>;

export class OpenAiCompatibleAdapter {
  readonly providerKey: string;
  readonly locality: import("../contracts.js").ProviderLocality;
  private readonly endpoint: URL;
  private readonly credentialProvider: () => Promise<string | undefined>;
  private readonly fetchImplementation: FetchImplementation;

  constructor(options: OpenAiCompatibleAdapterOptions) {
    this.providerKey = options.providerKey;
    this.locality = options.locality;
    this.endpoint = safeEndpoint(options.baseUrl, options.locality);
    this.credentialProvider = options.credentialProvider;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  async generate(
    request: import("../contracts.js").ProviderRequest,
    signal: AbortSignal,
  ): Promise<import("../contracts.js").ProviderResult> {
    try {
      const credential = await this.credentialProvider();
      const response = await this.fetchImplementation(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(credential === undefined ? {} : { authorization: `Bearer ${credential}` }),
        },
        body: JSON.stringify({
          model: request.modelKey,
          messages: [{ role: "user", content: JSON.stringify(request.input) }],
          response_format: { type: "json_object" },
        }),
        signal,
      });
      if (!response.ok) throw new AiProviderError(categoryForStatus(response.status));
      const payload: unknown = await response.json();
      return parseResponse(payload);
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      if (signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        throw new AiProviderError("timeout");
      }
      throw new AiProviderError("retryable");
    }
  }
}

function safeEndpoint(baseUrl: string, locality: import("../contracts.js").ProviderLocality): URL {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new AppError("AI_ADAPTER_URL_INVALID", "errors.ai.adapterUrlInvalid", 500);
  }
  if (
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    parsed.search.length > 0 ||
    parsed.hash.length > 0 ||
    !["http:", "https:"].includes(parsed.protocol) ||
    (locality === "external" && parsed.protocol !== "https:")
  ) {
    throw new AppError("AI_ADAPTER_URL_INVALID", "errors.ai.adapterUrlInvalid", 500);
  }
  const normalized = new URL(parsed.toString());
  if (!normalized.pathname.endsWith("/")) normalized.pathname += "/";
  return new URL("chat/completions", normalized);
}

function categoryForStatus(status: number): import("../contracts.js").ProviderErrorCategory {
  if (status === 401 || status === 403) return "policy";
  if (status === 408 || status === 429 || status >= 500) return "retryable";
  return "non_retryable";
}

function parseResponse(payload: unknown): import("../contracts.js").ProviderResult {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new AiProviderError("invalid_output");
  }
  const record = payload as Record<string, unknown>;
  const choices = record.choices;
  if (!Array.isArray(choices) || choices.length === 0) throw new AiProviderError("invalid_output");
  const first = choices[0];
  if (first === null || typeof first !== "object") throw new AiProviderError("invalid_output");
  const message = (first as Record<string, unknown>).message;
  if (message === null || typeof message !== "object") throw new AiProviderError("invalid_output");
  const content = (message as Record<string, unknown>).content;
  if (typeof content !== "string") throw new AiProviderError("invalid_output");
  let output: unknown;
  try {
    output = JSON.parse(content);
  } catch {
    throw new AiProviderError("invalid_output");
  }
  const usage = parseUsage(record.usage);
  return { output, ...(usage === undefined ? {} : { usage }) };
}

function parseUsage(value: unknown): import("../contracts.js").ProviderUsage | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const inputTokens = safeCount(record.prompt_tokens);
  const outputTokens = safeCount(record.completion_tokens);
  const totalTokens = safeCount(record.total_tokens);
  if (inputTokens === undefined && outputTokens === undefined && totalTokens === undefined) {
    return undefined;
  }
  return {
    ...(inputTokens === undefined ? {} : { inputTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens }),
    ...(totalTokens === undefined ? {} : { totalTokens }),
  };
}

function safeCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}
