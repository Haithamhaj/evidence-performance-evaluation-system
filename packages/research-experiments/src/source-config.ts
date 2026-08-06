import { AppError } from "@evaluation/contracts";

export type ResearchSourcePolicy = Readonly<{
  timeoutMs: number;
  maxBytes: number;
  maxTextChars: number;
  maxRedirects: number;
  allowedMimeTypes: readonly string[];
}>;

export const DEFAULT_RESEARCH_SOURCE_POLICY = Object.freeze({
  timeoutMs: 10_000,
  maxBytes: 2_000_000,
  maxTextChars: 120_000,
  maxRedirects: 3,
  allowedMimeTypes: Object.freeze([
    "text/plain",
    "text/markdown",
    "text/html",
    "application/json",
    "application/pdf",
  ]),
}) satisfies ResearchSourcePolicy;

type ResearchSourceEnvironment = Readonly<Record<string, string | undefined>>;

export function loadResearchSourcePolicy(
  environment: ResearchSourceEnvironment = process.env,
): ResearchSourcePolicy {
  const timeoutMs = boundedInteger(
    environment.RESEARCH_SOURCE_TIMEOUT_MS,
    DEFAULT_RESEARCH_SOURCE_POLICY.timeoutMs,
  );
  const maxBytes = boundedInteger(
    environment.RESEARCH_SOURCE_MAX_BYTES,
    DEFAULT_RESEARCH_SOURCE_POLICY.maxBytes,
  );
  const maxTextChars = boundedInteger(
    environment.RESEARCH_SOURCE_MAX_TEXT_CHARS,
    DEFAULT_RESEARCH_SOURCE_POLICY.maxTextChars,
  );
  const maxRedirects = boundedInteger(
    environment.RESEARCH_SOURCE_MAX_REDIRECTS,
    DEFAULT_RESEARCH_SOURCE_POLICY.maxRedirects,
    true,
  );
  const allowedMimeTypes = parseMimeTypes(environment.RESEARCH_SOURCE_ALLOWED_MIME_TYPES);
  return validateResearchSourcePolicy({
    timeoutMs,
    maxBytes,
    maxTextChars,
    maxRedirects,
    allowedMimeTypes,
  });
}

export function validateResearchSourcePolicy(policy: ResearchSourcePolicy): ResearchSourcePolicy {
  if (
    !safeBoundedInteger(policy.timeoutMs, DEFAULT_RESEARCH_SOURCE_POLICY.timeoutMs, false) ||
    !safeBoundedInteger(policy.maxBytes, DEFAULT_RESEARCH_SOURCE_POLICY.maxBytes, false) ||
    !safeBoundedInteger(policy.maxTextChars, DEFAULT_RESEARCH_SOURCE_POLICY.maxTextChars, false) ||
    !safeBoundedInteger(policy.maxRedirects, DEFAULT_RESEARCH_SOURCE_POLICY.maxRedirects, true) ||
    policy.allowedMimeTypes.length === 0 ||
    new Set(policy.allowedMimeTypes).size !== policy.allowedMimeTypes.length ||
    policy.allowedMimeTypes.some(
      (mime) =>
        mime !== mime.trim().toLowerCase() ||
        !DEFAULT_RESEARCH_SOURCE_POLICY.allowedMimeTypes.includes(mime),
    )
  )
    throw configInvalid();
  return Object.freeze({
    timeoutMs: policy.timeoutMs,
    maxBytes: policy.maxBytes,
    maxTextChars: policy.maxTextChars,
    maxRedirects: policy.maxRedirects,
    allowedMimeTypes: Object.freeze([...policy.allowedMimeTypes]),
  });
}

function boundedInteger(value: string | undefined, maximum: number, allowZero = false): number {
  if (value === undefined) return maximum;
  if (!/^[0-9]+$/u.test(value)) throw configInvalid();
  const parsed = Number(value);
  const minimum = allowZero ? 0 : 1;
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw configInvalid();
  return parsed;
}

function safeBoundedInteger(value: number, maximum: number, allowZero: boolean): boolean {
  return Number.isSafeInteger(value) && value >= (allowZero ? 0 : 1) && value <= maximum;
}

function parseMimeTypes(value: string | undefined): string[] {
  if (value === undefined) return [...DEFAULT_RESEARCH_SOURCE_POLICY.allowedMimeTypes];
  const parsed = [...new Set(value.split(",").map((mime) => mime.trim().toLowerCase()))];
  if (
    parsed.length === 0 ||
    parsed.some(
      (mime) =>
        mime.length === 0 || !DEFAULT_RESEARCH_SOURCE_POLICY.allowedMimeTypes.includes(mime),
    )
  )
    throw configInvalid();
  return parsed;
}

function configInvalid(): AppError {
  return new AppError("RESEARCH_SOURCE_CONFIG_INVALID", "errors.research.sourceConfigInvalid", 500);
}
