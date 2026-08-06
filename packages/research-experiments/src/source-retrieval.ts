import { createHash } from "node:crypto";
import { promises as dns } from "node:dns";
import * as http from "node:http";
import * as https from "node:https";
import { isIP } from "node:net";
import { TextDecoder } from "node:util";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";

import { AppError } from "@evaluation/contracts";

import {
  classifyExplicitResearchSource,
  interpretRetrievedResearchSource,
  type ResearchRetrievalState,
  type ResearchSourceKind,
  type ResearchSourceLabel,
  type ResearchSourceRecovery,
} from "./source-adapters.js";
import {
  loadResearchSourcePolicy,
  type ResearchSourcePolicy,
  validateResearchSourcePolicy,
} from "./source-config.js";

export type ResearchDnsAnswer = Readonly<{ address: string; family: 4 | 6 }>;

export type ResearchSourceRequest = Readonly<{
  url: URL;
  headers: Readonly<Record<string, string>>;
  timeoutMs: number;
  pinnedAddresses: readonly ResearchDnsAnswer[];
}>;

export type ResearchSourceResponse = Readonly<{
  statusCode: number;
  headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  body: AsyncIterable<Uint8Array>;
  cancel: () => void;
}>;

export interface ResearchSourceTransport {
  request(input: ResearchSourceRequest): Promise<ResearchSourceResponse>;
}

export type RetrievedResearchSource = Readonly<{
  state: ResearchRetrievalState;
  sourceKind: ResearchSourceKind;
  sourceLabel: ResearchSourceLabel;
  requestedUrl: string;
  resolvedUrl: string;
  retrievedAt: string;
  title: string | null;
  mimeType: string | null;
  byteSize: number;
  contentFingerprintSha256: string | null;
  text: string | null;
  reason: string | null;
  recoveryOptions: readonly ResearchSourceRecovery[];
  redirectCount: number;
}>;

type SourceRetrieverDependencies = Readonly<{
  policy?: ResearchSourcePolicy;
  transport?: ResearchSourceTransport;
  resolve?: (hostname: string) => Promise<readonly ResearchDnsAnswer[]>;
  now?: () => Date;
}>;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const SAFE_RESPONSE_ENCODINGS = new Set(["identity", "gzip", "deflate", "br"]);

export class SourceRetriever {
  readonly #policy: ResearchSourcePolicy;
  readonly #transport: ResearchSourceTransport;
  readonly #resolve: (hostname: string) => Promise<readonly ResearchDnsAnswer[]>;
  readonly #now: () => Date;

  constructor(dependencies: SourceRetrieverDependencies = {}) {
    this.#policy =
      dependencies.policy === undefined
        ? loadResearchSourcePolicy()
        : validateResearchSourcePolicy(dependencies.policy);
    this.#transport = dependencies.transport ?? new NodeResearchSourceTransport();
    this.#resolve = dependencies.resolve ?? resolveAllAddresses;
    this.#now = dependencies.now ?? (() => new Date());
  }

  async retrieve(input: Readonly<{ url: string }>): Promise<RetrievedResearchSource> {
    const requested = parseAndValidateUrl(input.url);
    const initialClassification = classifyExplicitResearchSource(requested);
    if (!initialClassification.allowed) {
      return blockedSource({
        classification: initialClassification,
        requested,
        resolved: requested,
        retrievedAt: validatedNow(this.#now),
        reason: "SOURCE_FORM_NOT_SUPPORTED",
        redirectCount: 0,
      });
    }

    let current = requested;
    let redirects = 0;
    while (true) {
      validatePort(current);
      const addresses = normalizeAndValidateAnswers(await this.#resolveAddresses(current.hostname));
      const response = await this.#request(current, addresses);
      const cancelResponse = once(response.cancel);
      try {
        if (REDIRECT_STATUSES.has(response.statusCode)) {
          const location = singleHeader(response.headers, "location");
          cancelResponse();
          if (location === undefined || location.length === 0) throw responseInvalid();
          if (redirects >= this.#policy.maxRedirects) throw redirectLimit();
          current = resolveRedirect(current, location);
          redirects += 1;
          continue;
        }

        const resolvedClassification = classifyExplicitResearchSource(current);
        if (!resolvedClassification.allowed) {
          cancelResponse();
          return blockedSource({
            classification: resolvedClassification,
            requested,
            resolved: current,
            retrievedAt: validatedNow(this.#now),
            reason: "SOURCE_FORM_NOT_SUPPORTED",
            redirectCount: redirects,
          });
        }
        const classification = preserveOriginalSourceSemantics(
          initialClassification,
          resolvedClassification,
        );

        if (response.statusCode < 200 || response.statusCode >= 300) {
          cancelResponse();
          return blockedSource({
            classification,
            requested,
            resolved: current,
            retrievedAt: validatedNow(this.#now),
            reason: `HTTP_${String(response.statusCode)}`,
            redirectCount: redirects,
          });
        }

        return await this.#consume({
          response,
          cancelResponse,
          requested,
          resolved: current,
          retrievedAt: validatedNow(this.#now),
          redirects,
          classification,
        });
      } catch (error) {
        cancelResponse();
        throw error;
      }
    }
  }

  async #resolveAddresses(hostname: string): Promise<readonly ResearchDnsAnswer[]> {
    try {
      return await withTimeout(this.#resolve(hostname), this.#policy.timeoutMs);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw unavailableError();
    }
  }

  async #request(
    url: URL,
    addresses: readonly ResearchDnsAnswer[],
  ): Promise<ResearchSourceResponse> {
    try {
      return await withTimeout(
        this.#transport.request({
          url: new URL(url.toString()),
          timeoutMs: this.#policy.timeoutMs,
          pinnedAddresses: addresses.map((answer) => ({ ...answer })),
          headers: {
            accept: this.#policy.allowedMimeTypes.join(", "),
            "accept-encoding": "gzip, deflate, br",
            "user-agent": "EBPES-Research-Source-Retriever/1.0",
          },
        }),
        this.#policy.timeoutMs,
      );
    } catch (error) {
      if (isTimeoutError(error)) throw timeoutError();
      if (error instanceof AppError) throw error;
      throw unavailableError();
    }
  }

  async #consume(
    input: Readonly<{
      response: ResearchSourceResponse;
      cancelResponse: () => void;
      requested: URL;
      resolved: URL;
      retrievedAt: string;
      redirects: number;
      classification: ReturnType<typeof classifyExplicitResearchSource>;
    }>,
  ): Promise<RetrievedResearchSource> {
    assertUnambiguousFraming(input.response.headers);
    const contentLength = parseContentLength(
      singleHeader(input.response.headers, "content-length"),
    );
    if (contentLength !== null && contentLength > this.#policy.maxBytes) {
      input.cancelResponse();
      throw tooLarge();
    }
    const mimeType = parseMimeType(singleHeader(input.response.headers, "content-type"));
    if (!this.#policy.allowedMimeTypes.includes(mimeType)) {
      input.cancelResponse();
      throw mimeUnsupported();
    }
    const contentEncoding = (singleHeader(input.response.headers, "content-encoding") ?? "identity")
      .trim()
      .toLowerCase();
    if (!SAFE_RESPONSE_ENCODINGS.has(contentEncoding)) {
      input.cancelResponse();
      throw decompressionFailed();
    }

    const compressed = await withTimeout(
      readBoundedBody(input.response.body, this.#policy.maxBytes, input.cancelResponse),
      this.#policy.timeoutMs,
      input.cancelResponse,
    );
    const content = decompressBounded(compressed, contentEncoding, this.#policy.maxBytes);
    const fingerprint = createHash("sha256").update(content).digest("hex");
    const decoded = mimeType === "application/pdf" ? null : decodeUtf8(content);
    const title = mimeType === "text/html" && decoded !== null ? extractHtmlTitle(decoded) : null;
    const visibleText =
      decoded === null
        ? null
        : mimeType === "text/html"
          ? normalizeVisibleHtml(decoded)
          : normalizePlainText(decoded);
    const textTruncated = visibleText !== null && visibleText.length > this.#policy.maxTextChars;
    const boundedText =
      visibleText === null ? null : visibleText.slice(0, this.#policy.maxTextChars).trimEnd();
    const interpretation = interpretRetrievedResearchSource({
      classification: input.classification,
      mimeType,
      text: boundedText,
      status: "RETRIEVED",
      textTruncated,
    });
    return {
      state: interpretation.state,
      sourceKind: input.classification.kind,
      sourceLabel: input.classification.label,
      requestedUrl: input.requested.toString(),
      resolvedUrl: input.resolved.toString(),
      retrievedAt: input.retrievedAt,
      title,
      mimeType,
      byteSize: content.length,
      contentFingerprintSha256: fingerprint,
      text: interpretation.text,
      reason: interpretation.reason,
      recoveryOptions: interpretation.recoveryOptions,
      redirectCount: input.redirects,
    };
  }
}

export class NodeResearchSourceTransport implements ResearchSourceTransport {
  async request(input: ResearchSourceRequest): Promise<ResearchSourceResponse> {
    return await new Promise<ResearchSourceResponse>((resolve, reject) => {
      const requester = input.url.protocol === "https:" ? https.request : http.request;
      let settled = false;
      const request = requester(
        {
          protocol: input.url.protocol,
          hostname: input.url.hostname,
          port: input.url.port || undefined,
          path: `${input.url.pathname}${input.url.search}`,
          method: "GET",
          headers: input.headers,
          lookup: pinnedLookup(input.pinnedAddresses),
          agent: false,
        },
        (response) => {
          if (settled) {
            response.destroy();
            return;
          }
          let responseCancelled = false;
          const result: ResearchSourceResponse = {
            statusCode: response.statusCode ?? 0,
            headers: response.headers,
            body: response,
            cancel: () => {
              if (responseCancelled) return;
              responseCancelled = true;
              response.destroy();
            },
          };
          settled = true;
          clearTimeout(deadline);
          resolve(result);
        },
      );
      const deadline = setTimeout(() => {
        if (settled) return;
        settled = true;
        request.destroy(timeoutCause());
        reject(timeoutCause());
      }, input.timeoutMs);
      request.once("error", (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(deadline);
        reject(error);
      });
      request.end();
    });
  }
}

function preserveOriginalSourceSemantics(
  initial: ReturnType<typeof classifyExplicitResearchSource>,
  resolved: ReturnType<typeof classifyExplicitResearchSource>,
): ReturnType<typeof classifyExplicitResearchSource> {
  if (initial.kind !== "PAPER" || resolved.kind !== "GENERIC") return resolved;
  return {
    ...initial,
    recoveryOptions: [...new Set([...initial.recoveryOptions, ...resolved.recoveryOptions])],
  };
}

async function withTimeout<T>(
  operation: Promise<T>,
  milliseconds: number,
  onTimeout?: () => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      onTimeout?.();
      reject(timeoutError());
    }, milliseconds);
  });
  try {
    return await Promise.race([operation, deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function timeoutCause(): Error {
  return Object.assign(new Error("Research source request timed out."), { code: "ETIMEDOUT" });
}

async function resolveAllAddresses(hostname: string): Promise<readonly ResearchDnsAnswer[]> {
  const answers = await dns.lookup(hostname, { all: true, verbatim: true });
  return answers.map(({ address, family }) => ({ address, family: family as 4 | 6 }));
}

function pinnedLookup(addresses: readonly ResearchDnsAnswer[]): import("node:net").LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all === true) {
      callback(
        null,
        addresses.map(({ address, family }) => ({ address, family })),
      );
      return;
    }
    const requestedFamily = options.family === 4 || options.family === 6 ? options.family : 0;
    const selected = addresses.find(
      ({ family }) => requestedFamily === 0 || family === requestedFamily,
    );
    if (selected === undefined) {
      callback(
        Object.assign(new Error("No pinned address matches the requested family."), {
          code: "ENOTFOUND",
        }),
        "",
        0,
      );
      return;
    }
    callback(null, selected.address, selected.family);
  };
}

function parseAndValidateUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw blockedError();
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.hostname.length === 0
  )
    throw blockedError();
  url.hash = "";
  validatePort(url);
  return url;
}

function resolveRedirect(current: URL, location: string): URL {
  let resolved: URL;
  try {
    resolved = new URL(location, current);
  } catch {
    throw responseInvalid();
  }
  if (current.protocol === "https:" && resolved.protocol !== "https:") throw blockedError();
  return parseAndValidateUrl(resolved.toString());
}

function validatePort(url: URL): void {
  const allowed = url.protocol === "https:" ? new Set(["", "443"]) : new Set(["", "80"]);
  if (!allowed.has(url.port)) throw blockedError();
}

function normalizeAndValidateAnswers(
  answers: readonly ResearchDnsAnswer[],
): readonly ResearchDnsAnswer[] {
  if (answers.length === 0) throw blockedError();
  const normalized = answers.map(({ address, family }) => ({ address, family }));
  if (
    normalized.some(
      ({ address, family }) => isIP(address) !== family || !isGlobalAddress(address, family),
    )
  )
    throw blockedError();
  return normalized;
}

function isGlobalAddress(address: string, family: 4 | 6): boolean {
  if (family === 4) return isGlobalIpv4(address);
  const words = parseIpv6(address);
  if (words === null) return false;
  const mapped = mappedIpv4(words);
  if (mapped !== null) return isGlobalIpv4(mapped);
  const first = words[0]!;
  const second = words[1]!;
  if (first < 0x2000 || first > 0x3fff) return false;
  if (first === 0x2001 && (second & 0xfe00) === 0) return false;
  if (first === 0x2001 && second === 0x0db8) return false;
  if (first === 0x2002) return false;
  if (first === 0x3fff && (second & 0xf000) === 0) return false;
  return true;
}

function isGlobalIpv4(address: string): boolean {
  const octets = parseIpv4(address);
  if (octets === null) return false;
  const [a, b, c] = octets;
  if (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  )
    return false;
  return true;
}

function parseIpv4(address: string): [number, number, number, number] | null {
  const parts = address.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^(?:0|[1-9][0-9]{0,2})$/u.test(part)))
    return null;
  const octets = parts.map(Number);
  if (octets.some((octet) => octet > 255)) return null;
  return octets as [number, number, number, number];
}

function parseIpv6(address: string): number[] | null {
  if (address.includes("%")) return null;
  let normalized = address.toLowerCase();
  const ipv4Tail = normalized.match(/(?:^|:)([0-9]+(?:\.[0-9]+){3})$/u)?.[1];
  if (ipv4Tail !== undefined) {
    const octets = parseIpv4(ipv4Tail);
    if (octets === null) return null;
    normalized =
      normalized.slice(0, -ipv4Tail.length) +
      `${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }
  if ((normalized.match(/::/gu) ?? []).length > 1) return null;
  const [leftText, rightText] = normalized.split("::");
  const left = leftText === "" ? [] : leftText!.split(":");
  const right = rightText === undefined || rightText === "" ? [] : rightText.split(":");
  if ([...left, ...right].some((part) => !/^[a-f0-9]{1,4}$/u.test(part))) return null;
  const missing = 8 - left.length - right.length;
  if (rightText === undefined ? missing !== 0 : missing < 1) return null;
  return [...left.map(hex), ...Array.from({ length: missing }, () => 0), ...right.map(hex)];
}

function mappedIpv4(words: readonly number[]): string | null {
  if (words.length !== 8 || words.slice(0, 5).some((word) => word !== 0) || words[5] !== 0xffff)
    return null;
  return `${words[6]! >> 8}.${words[6]! & 0xff}.${words[7]! >> 8}.${words[7]! & 0xff}`;
}

function hex(value: string): number {
  return Number.parseInt(value, 16);
}

function assertUnambiguousFraming(
  headers: Readonly<Record<string, string | readonly string[] | undefined>>,
): void {
  const contentLength = singleHeader(headers, "content-length");
  const transferEncoding = singleHeader(headers, "transfer-encoding");
  if (contentLength !== undefined && transferEncoding !== undefined) throw responseInvalid();
}

function singleHeader(
  headers: Readonly<Record<string, string | readonly string[] | undefined>>,
  name: string,
): string | undefined {
  const matches = Object.entries(headers).filter(([key]) => key.toLowerCase() === name);
  if (matches.length > 1) throw responseInvalid();
  const value = matches[0]?.[1];
  if (Array.isArray(value)) throw responseInvalid();
  return value as string | undefined;
}

function parseContentLength(value: string | undefined): number | null {
  if (value === undefined) return null;
  if (!/^(?:0|[1-9][0-9]*)$/u.test(value)) throw responseInvalid();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw responseInvalid();
  return parsed;
}

function parseMimeType(value: string | undefined): string {
  if (value === undefined || value.includes(",")) throw mimeUnsupported();
  const mimeType = value.split(";", 1)[0]?.trim().toLowerCase();
  if (mimeType === undefined || mimeType.length === 0) throw mimeUnsupported();
  return mimeType;
}

async function readBoundedBody(
  body: AsyncIterable<Uint8Array>,
  maximum: number,
  cancel: () => void,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of body) {
    total += chunk.byteLength;
    if (total > maximum) {
      cancel();
      throw tooLarge();
    }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks, total);
}

function once(action: () => void): () => void {
  let called = false;
  return () => {
    if (called) return;
    called = true;
    try {
      action();
    } catch {
      // Cleanup must not replace the retrieval error that caused it.
    }
  };
}

function decompressBounded(input: Buffer, encoding: string, maximum: number): Buffer {
  if (encoding === "identity") return input;
  try {
    const options = { maxOutputLength: maximum };
    if (encoding === "gzip") return gunzipSync(input, options);
    if (encoding === "deflate") return inflateSync(input, options);
    return brotliDecompressSync(input, options);
  } catch (error) {
    if (
      error instanceof RangeError ||
      (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ERR_BUFFER_TOO_LARGE")
    )
      throw tooLarge();
    throw decompressionFailed();
  }
}

function decodeUtf8(input: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(input);
  } catch {
    throw mimeUnsupported();
  }
}

function extractHtmlTitle(html: string): string | null {
  const match = html.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title\s*>/iu)?.[1];
  if (match === undefined) return null;
  const title = normalizePlainText(decodeHtmlEntities(match.replace(/<[^>]*>/gu, " ")));
  return title.length === 0 ? null : title.slice(0, 500);
}

function normalizeVisibleHtml(html: string): string {
  return normalizePlainText(
    decodeHtmlEntities(
      html
        .replace(/<!--[\s\S]*?-->/gu, " ")
        .replace(
          /<(?:script|style|noscript|template|svg)(?:\s[^>]*)?>[\s\S]*?<\/(?:script|style|noscript|template|svg)\s*>/giu,
          " ",
        )
        .replace(/<[^>]*>/gu, " "),
    ),
  );
}

function decodeHtmlEntities(value: string): string {
  const named: Readonly<Record<string, string>> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(
    /&(?:#([0-9]{1,7})|#x([a-f0-9]{1,6})|([a-z]+));/giu,
    (entity, decimal, hexValue, name) => {
      if (typeof decimal === "string") return safeCodePoint(Number.parseInt(decimal, 10), entity);
      if (typeof hexValue === "string") return safeCodePoint(Number.parseInt(hexValue, 16), entity);
      return named[String(name).toLowerCase()] ?? entity;
    },
  );
}

function safeCodePoint(value: number, fallback: string): string {
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > 0x10ffff ||
    (value >= 0xd800 && value <= 0xdfff)
  )
    return fallback;
  return String.fromCodePoint(value);
}

function normalizePlainText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function blockedSource(
  input: Readonly<{
    classification: ReturnType<typeof classifyExplicitResearchSource>;
    requested: URL;
    resolved: URL;
    retrievedAt: string;
    reason: string;
    redirectCount: number;
  }>,
): RetrievedResearchSource {
  const interpretation = interpretRetrievedResearchSource({
    classification: input.classification,
    mimeType: "",
    text: null,
    status: "BLOCKED",
    reason: input.reason,
  });
  return {
    state: "BLOCKED",
    sourceKind: input.classification.kind,
    sourceLabel: input.classification.label,
    requestedUrl: input.requested.toString(),
    resolvedUrl: input.resolved.toString(),
    retrievedAt: input.retrievedAt,
    title: null,
    mimeType: null,
    byteSize: 0,
    contentFingerprintSha256: null,
    text: null,
    reason: interpretation.reason,
    recoveryOptions:
      interpretation.recoveryOptions.length === 0
        ? ["TRY_AGAIN", "ADD_MANUAL_CITATION"]
        : interpretation.recoveryOptions,
    redirectCount: input.redirectCount,
  };
}

function validatedNow(now: () => Date): string {
  const value = now();
  if (!Number.isFinite(value.getTime())) throw unavailableError();
  return value.toISOString();
}

function isTimeoutError(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "code" in error && error.code === "ETIMEDOUT"
  );
}

function blockedError(): AppError {
  return new AppError("RESEARCH_SOURCE_BLOCKED", "errors.research.sourceBlocked", 400);
}

function redirectLimit(): AppError {
  return new AppError("RESEARCH_SOURCE_REDIRECT_LIMIT", "errors.research.sourceRedirectLimit", 400);
}

function tooLarge(): AppError {
  return new AppError("RESEARCH_SOURCE_TOO_LARGE", "errors.research.sourceTooLarge", 413);
}

function mimeUnsupported(): AppError {
  return new AppError(
    "RESEARCH_SOURCE_MIME_UNSUPPORTED",
    "errors.research.sourceMimeUnsupported",
    415,
  );
}

function timeoutError(): AppError {
  return new AppError("RESEARCH_SOURCE_TIMEOUT", "errors.research.sourceTimeout", 504);
}

function responseInvalid(): AppError {
  return new AppError(
    "RESEARCH_SOURCE_RESPONSE_INVALID",
    "errors.research.sourceResponseInvalid",
    502,
  );
}

function decompressionFailed(): AppError {
  return new AppError(
    "RESEARCH_SOURCE_DECOMPRESSION_FAILED",
    "errors.research.sourceDecompressionFailed",
    502,
  );
}

function unavailableError(): AppError {
  return new AppError("RESEARCH_SOURCE_UNAVAILABLE", "errors.research.sourceUnavailable", 502);
}
