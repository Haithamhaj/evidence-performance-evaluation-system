import pino from "pino";

import { currentCorrelation } from "./correlation.js";
import { redactStructuredValue } from "./redaction.js";

const REDACTED = "[REDACTED]";
const REDACTED_MESSAGE = "[REDACTED_MESSAGE]";
const SENSITIVE_KEYS = new Set([
  "authorization",
  "proxyauthorization",
  "cookie",
  "cookies",
  "setcookie",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "password",
  "passphrase",
  "secret",
  "clientsecret",
  "apikey",
  "credentials",
  "credential",
  "prompt",
  "rawprompt",
  "systemprompt",
  "userprompt",
  "promptcontent",
  "promptinput",
  "uploadedcontent",
  "uploadcontent",
  "filecontent",
  "documentcontent",
  "rawdocument",
  "managerfeedback",
  "privatefeedback",
  "upwardfeedback",
  "privateresponse",
  "originalfeedback",
  "feedbackoriginal",
  "feedback",
  "feedbackbody",
  "feedbackcontent",
  "privateresponsebody",
]);

export const SENSITIVE_LOG_PATHS = Object.freeze([
  "authorization",
  "cookie",
  "token",
  "credentials",
  "rawPrompt",
  "uploadedContent",
  "managerFeedback",
  "req.headers.authorization",
  "req.headers.cookie",
]);

export interface CreateLoggerOptions {
  readonly name: string;
  readonly level?: string;
  readonly destination?: { write(message: string): void };
}

function normalizeKey(key: string): string {
  return key.replace(/[^a-z0-9]/giu, "").toLowerCase();
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return (
    SENSITIVE_KEYS.has(normalized) ||
    normalized.endsWith("authorization") ||
    normalized.includes("cookie") ||
    normalized.endsWith("token") ||
    normalized.endsWith("tokens") ||
    normalized.includes("credential") ||
    normalized.endsWith("password") ||
    normalized.endsWith("secret") ||
    normalized.endsWith("apikey") ||
    normalized.endsWith("prompt") ||
    normalized.endsWith("prompts") ||
    normalized.includes("uploadedcontent") ||
    normalized.includes("uploadcontent") ||
    normalized.endsWith("filecontent") ||
    normalized.endsWith("documentcontent") ||
    normalized.endsWith("feedback") ||
    normalized.endsWith("feedbackbody") ||
    normalized.endsWith("feedbackcontent") ||
    normalized.endsWith("privateresponsebody")
  );
}

function redactInternal(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return { name: value.name, message: REDACTED };
  if (seen.has(value)) return "[Circular]";

  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => redactInternal(item, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    output[key] = isSensitiveKey(key) ? REDACTED : redactInternal(child, seen);
  }
  return output;
}

export function redact(value: unknown): unknown {
  return redactStructuredValue(redactInternal(value, new WeakSet()));
}

function isLogRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeLogRecord(value: Record<string, unknown>): Record<string, unknown> {
  const sanitized = redact(value);
  return isLogRecord(sanitized) ? sanitized : { value: REDACTED };
}

export function createLogger(options: CreateLoggerOptions) {
  const loggerOptions: Parameters<typeof pino>[0] = {
    name: options.name,
    level: options.level ?? "info",
    redact: {
      paths: [...SENSITIVE_LOG_PATHS],
      censor: REDACTED,
    },
    hooks: {
      logMethod(inputArguments, method) {
        const first = inputArguments[0];
        if (isLogRecord(first)) {
          method.call(this, sanitizeLogRecord(first), REDACTED_MESSAGE);
          return;
        }
        method.call(this, REDACTED_MESSAGE);
      },
    },
    mixin() {
      const carrier = currentCorrelation();
      return carrier === undefined ? {} : serializeSafeCarrier(carrier);
    },
    formatters: {
      bindings(bindings) {
        return sanitizeLogRecord(bindings);
      },
      log(object) {
        return sanitizeLogRecord(object);
      },
    },
  };

  return pino(loggerOptions, options.destination);
}

function serializeSafeCarrier(carrier: {
  readonly correlationId: string;
  readonly traceId?: string;
  readonly spanId?: string;
}): Record<string, string> {
  return {
    correlationId: carrier.correlationId,
    ...(carrier.traceId === undefined ? {} : { traceId: carrier.traceId }),
    ...(carrier.spanId === undefined ? {} : { spanId: carrier.spanId }),
  };
}
