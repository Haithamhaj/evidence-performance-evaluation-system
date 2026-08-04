import { createHash } from "node:crypto";

import { AppError } from "@evaluation/contracts";
import { z } from "zod";

import { AiProviderError } from "../contracts.js";
import { safeEndpoint } from "./openai-compatible.js";

type FetchImplementation = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface PrivateMediaResolver {
  read(
    input: Readonly<{ reference: string; mediaType: string; maxBytes: number }>,
  ): Promise<
    Readonly<{ bytes: Uint8Array; filename: string; mediaType: string; byteSize: number }>
  >;
}

const PromptInputSchema = z
  .object({
    trustedInstruction: z
      .object({
        routeKey: z.string().min(1).max(200),
        artifactId: z.string().uuid(),
        version: z.string().min(1).max(128),
        sha256: z.string().regex(/^[a-f0-9]{64}$/u),
      })
      .strict(),
    untrustedContent: z.custom<unknown>((value) => value !== undefined),
  })
  .strict();

export type PromptAwareOpenAiCompatibleAdapterOptions = Readonly<{
  database: Pick<import("@evaluation/database").DatabaseClient, "analysisPromptArtifact">;
  providerKey: string;
  adapterKey: string;
  locality: import("../contracts.js").ProviderLocality;
  baseUrl: string;
  credentialProvider: () => Promise<string | undefined>;
  localTrustPolicy?: Readonly<{ id: string; version: number; allowedIp: string }>;
  fetchImplementation?: FetchImplementation;
  privateMediaResolver?: PrivateMediaResolver;
}>;

export class PromptAwareOpenAiCompatibleAdapter {
  readonly providerKey: string;
  readonly adapterKey: string;
  readonly locality: import("../contracts.js").ProviderLocality;
  private readonly database: PromptAwareOpenAiCompatibleAdapterOptions["database"];
  private readonly endpoint: URL;
  private readonly credentialProvider: () => Promise<string | undefined>;
  private readonly localTrustPolicy:
    Readonly<{ id: string; version: number; allowedIp: string }> | undefined;
  private readonly fetchImplementation: FetchImplementation;
  private readonly privateMediaResolver: PrivateMediaResolver | undefined;

  constructor(options: PromptAwareOpenAiCompatibleAdapterOptions) {
    this.database = options.database;
    this.providerKey = options.providerKey;
    this.adapterKey = options.adapterKey;
    this.locality = options.locality;
    this.localTrustPolicy = options.localTrustPolicy;
    this.endpoint = safeEndpoint(options.baseUrl, options.locality, options.localTrustPolicy);
    this.credentialProvider = options.credentialProvider;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.privateMediaResolver = options.privateMediaResolver;
  }

  async generate(
    request: import("../contracts.js").ProviderRequest,
    signal: AbortSignal,
  ): Promise<import("../contracts.js").ProviderResult> {
    const parsed = PromptInputSchema.safeParse(request.input);
    if (!parsed.success || parsed.data.trustedInstruction.routeKey !== request.routeKey) {
      throw new AppError("AI_PROMPT_INPUT_INVALID", "errors.ai.promptInputInvalid", 400);
    }
    const descriptor = parsed.data.trustedInstruction;
    const artifact = await this.database.analysisPromptArtifact.findUnique({
      where: { id: descriptor.artifactId },
      select: { id: true, routeKey: true, version: true, bodyHash: true, trustedBody: true },
    });
    if (
      artifact === null ||
      artifact.id !== descriptor.artifactId ||
      artifact.routeKey !== request.routeKey ||
      artifact.routeKey !== descriptor.routeKey ||
      artifact.version !== descriptor.version ||
      artifact.bodyHash !== descriptor.sha256 ||
      hash(artifact.trustedBody) !== descriptor.sha256
    ) {
      throw new AppError("AI_PROMPT_ARTIFACT_MISMATCH", "errors.ai.promptArtifactMismatch", 500);
    }

    const media = voiceMediaInput(request.routeKey, parsed.data.untrustedContent);
    let credential: string | undefined;
    try {
      credential = await raceWithAbort(this.credentialProvider(), signal);
    } catch (error) {
      if (signal.aborted) throw new AiProviderError("timeout");
      if (error instanceof AiProviderError) throw error;
      throw new AiProviderError("policy");
    }
    if (credential === undefined || credential.trim().length === 0) {
      throw new AiProviderError("policy");
    }

    let response: Response;
    try {
      const endpoint = media === null ? this.endpoint : transcriptionEndpoint(this.endpoint);
      const init =
        media === null
          ? {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${credential}`,
              },
              body: JSON.stringify({
                model: request.modelKey,
                messages: [
                  { role: "system", content: artifact.trustedBody },
                  {
                    role: "user",
                    content: `<untrusted-content>\n${serializeUntrusted(parsed.data.untrustedContent)}\n</untrusted-content>`,
                  },
                ],
                response_format: { type: "json_object" },
              }),
              signal,
            }
          : await this.transcriptionRequest(
              media,
              request.modelKey,
              artifact.trustedBody,
              credential,
              signal,
            );
      response = await raceWithAbort(this.fetchImplementation(endpoint, init), signal);
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      if (signal.aborted) throw new AiProviderError("timeout");
      throw new AiProviderError("retryable");
    }
    if (!response.ok) {
      throw new AiProviderError(
        response.status === 401 || response.status === 403
          ? "policy"
          : response.status === 408 || response.status === 429 || response.status >= 500
            ? "retryable"
            : "non_retryable",
      );
    }
    const payload = await raceWithAbort(response.json(), signal);
    return media === null ? parseResponse(payload) : parseTranscriptionResponse(payload);
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

  private async transcriptionRequest(
    media: Readonly<{ reference: string; mediaType: string; byteSize: number }>,
    modelKey: string,
    trustedPrompt: string,
    credential: string,
    signal: AbortSignal,
  ): Promise<RequestInit> {
    if (this.privateMediaResolver === undefined || modelKey !== "gpt-4o-transcribe") {
      throw new AiProviderError("policy");
    }
    const resolved = await raceWithAbort(
      this.privateMediaResolver.read({
        reference: media.reference,
        mediaType: media.mediaType,
        maxBytes: media.byteSize,
      }),
      signal,
    );
    if (
      resolved.byteSize < 1 ||
      resolved.byteSize > media.byteSize ||
      resolved.mediaType !== media.mediaType
    ) {
      throw new AiProviderError("policy");
    }
    const form = new FormData();
    form.set("model", modelKey);
    form.set("prompt", trustedPrompt);
    form.set(
      "file",
      new Blob(
        [
          resolved.bytes.buffer.slice(
            resolved.bytes.byteOffset,
            resolved.bytes.byteOffset + resolved.bytes.byteLength,
          ) as ArrayBuffer,
        ],
        { type: resolved.mediaType },
      ),
      resolved.filename,
    );
    return {
      method: "POST",
      headers: { authorization: `Bearer ${credential}` },
      body: form,
      signal,
    };
  }
}

function voiceMediaInput(
  routeKey: string,
  input: unknown,
): Readonly<{ reference: string; mediaType: string; byteSize: number }> | null {
  if (
    routeKey !== "update.transcribe" ||
    input === null ||
    typeof input !== "object" ||
    Array.isArray(input)
  )
    return null;
  const value = input as Record<string, unknown>;
  const reference = value.audioReference;
  const mediaType = value.mediaType;
  const byteSize = value.byteSize;
  if (
    typeof reference !== "string" ||
    typeof mediaType !== "string" ||
    typeof byteSize !== "number" ||
    !Number.isSafeInteger(byteSize) ||
    byteSize < 1 ||
    byteSize > 10 * 1024 * 1024
  ) {
    throw new AppError("AI_PROMPT_INPUT_INVALID", "errors.ai.promptInputInvalid", 400);
  }
  return { reference, mediaType, byteSize };
}

function transcriptionEndpoint(chatEndpoint: URL): URL {
  return new URL("../audio/transcriptions", chatEndpoint);
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function serializeUntrusted(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new Error("not serializable");
    return serialized;
  } catch {
    throw new AppError("AI_PROMPT_INPUT_INVALID", "errors.ai.promptInputInvalid", 400);
  }
}

function parseResponse(payload: unknown): import("../contracts.js").ProviderResult {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new AiProviderError("invalid_output");
  }
  const record = payload as Record<string, unknown>;
  const first = Array.isArray(record.choices) ? record.choices[0] : undefined;
  const message =
    first !== null && typeof first === "object"
      ? (first as Record<string, unknown>).message
      : undefined;
  const content =
    message !== null && typeof message === "object"
      ? (message as Record<string, unknown>).content
      : undefined;
  if (typeof content !== "string") throw new AiProviderError("invalid_output");
  try {
    return { output: JSON.parse(content) };
  } catch {
    throw new AiProviderError("invalid_output");
  }
}

function parseTranscriptionResponse(payload: unknown): import("../contracts.js").ProviderResult {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload))
    throw new AiProviderError("invalid_output");
  const value = payload as Record<string, unknown>;
  if (typeof value.text !== "string" || value.text.trim() === "")
    throw new AiProviderError("invalid_output");
  const language = value.language === "ar" || value.language === "en" ? value.language : "mixed";
  return {
    output: {
      transcript: value.text.trim(),
      language,
      dialect: language === "en" ? "english" : language === "ar" ? "fusha" : "mixed",
    },
  };
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
