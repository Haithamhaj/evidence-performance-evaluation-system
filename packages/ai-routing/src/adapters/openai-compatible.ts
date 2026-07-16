import { AppError } from "@evaluation/contracts";
import { isIP } from "node:net";

import { AiProviderError } from "../contracts.js";

type FetchImplementation = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type OpenAiCompatibleAdapterOptions = Readonly<{
  providerKey: string;
  adapterKey: string;
  locality: import("../contracts.js").ProviderLocality;
  baseUrl: string;
  credentialProvider: () => Promise<string | undefined>;
  localTrustPolicy?: Readonly<{ id: string; version: number; allowedIp: string }>;
  fetchImplementation?: FetchImplementation;
}>;

export class OpenAiCompatibleAdapter {
  readonly providerKey: string;
  readonly adapterKey: string;
  readonly locality: import("../contracts.js").ProviderLocality;
  private readonly endpoint: URL;
  private readonly localTrustPolicy:
    Readonly<{ id: string; version: number; allowedIp: string }> | undefined;
  private readonly credentialProvider: () => Promise<string | undefined>;
  private readonly fetchImplementation: FetchImplementation;

  constructor(options: OpenAiCompatibleAdapterOptions) {
    this.providerKey = options.providerKey;
    this.adapterKey = options.adapterKey;
    this.locality = options.locality;
    this.localTrustPolicy = options.localTrustPolicy;
    this.endpoint = safeEndpoint(options.baseUrl, options.locality, options.localTrustPolicy);
    this.credentialProvider = options.credentialProvider;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  async generate(
    request: import("../contracts.js").ProviderRequest,
    signal: AbortSignal,
  ): Promise<import("../contracts.js").ProviderResult> {
    let credential: string | undefined;
    try {
      credential = await raceWithAbort(this.credentialProvider(), signal);
    } catch (error) {
      if (signal.aborted) throw new AiProviderError("timeout");
      if (error instanceof AiProviderError) throw error;
      throw new AiProviderError("policy");
    }

    let body: string;
    try {
      body = JSON.stringify({
        model: request.modelKey,
        messages: [{ role: "user", content: JSON.stringify(request.input) }],
        response_format: { type: "json_object" },
      });
    } catch {
      throw new AiProviderError("non_retryable");
    }

    let response: Response;
    try {
      response = await raceWithAbort(
        this.fetchImplementation(this.endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(credential === undefined ? {} : { authorization: `Bearer ${credential}` }),
          },
          body,
          signal,
        }),
        signal,
      );
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      if (signal.aborted) throw new AiProviderError("timeout");
      throw new AiProviderError(isTransientTransportError(error) ? "retryable" : "non_retryable");
    }
    if (!response.ok) throw new AiProviderError(categoryForStatus(response.status));
    let payload: unknown;
    try {
      payload = await raceWithAbort(response.json(), signal);
    } catch (_error) {
      if (signal.aborted) throw new AiProviderError("timeout");
      throw new AiProviderError("invalid_output");
    }
    return parseResponse(payload);
  }

  matchesConfiguration(provider: import("../contracts.js").AiProviderRoute): boolean {
    return (
      provider.providerKey === this.providerKey &&
      provider.adapterKey === this.adapterKey &&
      provider.locality === this.locality &&
      provider.endpoint === this.endpoint.toString() &&
      provider.localTrustPolicyId === (this.localTrustPolicy?.id ?? null) &&
      provider.localTrustPolicyVersion === (this.localTrustPolicy?.version ?? null) &&
      provider.localTrustAllowedIp === (this.localTrustPolicy?.allowedIp ?? null)
    );
  }
}

export function safeEndpoint(
  baseUrl: string,
  locality: import("../contracts.js").ProviderLocality,
  localTrustPolicy?: Readonly<{ id: string; version: number; allowedIp: string }>,
): URL {
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
    (locality === "external" && parsed.protocol !== "https:") ||
    (locality === "external" && localTrustPolicy !== undefined)
  ) {
    throw new AppError("AI_ADAPTER_URL_INVALID", "errors.ai.adapterUrlInvalid", 500);
  }
  if (locality === "local" && !isTrustedLocalHost(parsed.hostname, localTrustPolicy)) {
    throw new AppError("AI_ADAPTER_URL_INVALID", "errors.ai.adapterUrlInvalid", 500);
  }
  if (locality === "local" && !isLoopback(parsed.hostname) && parsed.protocol !== "https:") {
    throw new AppError("AI_ADAPTER_URL_INVALID", "errors.ai.adapterUrlInvalid", 500);
  }
  const normalized = new URL(parsed.toString());
  if (!normalized.pathname.endsWith("/")) normalized.pathname += "/";
  return new URL("chat/completions", normalized);
}

function isTrustedLocalHost(
  hostname: string,
  policy: Readonly<{ allowedIp: string }> | undefined,
): boolean {
  const host = hostname.replace(/^\[|\]$/gu, "").toLowerCase();
  if (isIP(host) === 0) return false;
  if (policy === undefined) return false;
  const allowedIp = policy.allowedIp.replace(/^\[|\]$/gu, "").toLowerCase();
  return isIP(allowedIp) > 0 && allowedIp === host;
}

function isLoopback(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/gu, "").toLowerCase();
  return host === "::1" || (isIP(host) === 4 && host.split(".")[0] === "127");
}

async function raceWithAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw new AiProviderError("timeout");
  let abort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    abort = () => reject(new AiProviderError("timeout"));
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([operation, aborted]);
  } finally {
    if (abort !== undefined) signal.removeEventListener("abort", abort);
    operation.catch(() => undefined);
  }
}

function isTransientTransportError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const cause = error.cause;
  if (cause === null || typeof cause !== "object") return false;
  const code = (cause as { code?: unknown }).code;
  return ["ECONNRESET", "ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH", "ETIMEDOUT"].includes(
    String(code),
  );
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
