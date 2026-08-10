const REDACTED = "[REDACTED]";
const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
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
  "signedurl",
  "rawerror",
  "rawprompt",
  "uploadedcontent",
  "documentcontent",
  "managerfeedback",
  "privatefeedback",
  "originalfeedback",
  "privatecontent",
  "emailbody",
  "body",
  "payload",
  "msg",
]);
const ALLOWED_OPERATIONAL_KEYS = new Set([
  "level",
  "time",
  "pid",
  "hostname",
  "name",
  "event",
  "status",
  "state",
  "kind",
  "code",
  "messagekey",
  "correlationid",
  "traceid",
  "spanid",
  "operationid",
  "jobtype",
  "jobversion",
  "errorcode",
  "route",
  "provider",
  "channel",
  "operation",
  "dependency",
  "latencyms",
  "ageseconds",
  "failurecount",
  "attemptcount",
  "durationms",
  "observedat",
  "occurredat",
  "checkedat",
  "schemaversion",
  "policyversion",
  "nextactionkey",
  "severity",
  "signalkind",
  "method",
  "statuscode",
  "environment",
  "source",
  "operational",
  "labels",
  "dependencies",
  "checks",
  "failure",
  "error",
]);
const SENSITIVE_VALUE =
  /(?:\bBearer\s+\S+|\bsk-(?:proj(?:ect)?-)?[A-Za-z0-9_-]{6,}|refresh_token\s*[=:]\s*\S+|X-Amz-(?:Signature|Credential)=|private email body)/iu;

function normalizeKey(key: string): string {
  return key.replace(/[^a-z0-9]/giu, "").toLowerCase();
}

function sensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return (
    SENSITIVE_KEYS.has(normalized) ||
    normalized.endsWith("token") ||
    normalized.endsWith("tokens") ||
    normalized.endsWith("secret") ||
    normalized.endsWith("password") ||
    normalized.includes("credential") ||
    normalized.endsWith("signedurl") ||
    normalized.endsWith("rawerror") ||
    normalized.endsWith("feedbackbody") ||
    normalized.endsWith("feedbackcontent")
  );
}

function redactInternal(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return SENSITIVE_VALUE.test(value) ? REDACTED : value;
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return { name: value.name, message: REDACTED };
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redactInternal(item, seen));

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      sensitiveKey(key) || !ALLOWED_OPERATIONAL_KEYS.has(normalizeKey(key))
        ? REDACTED
        : redactInternal(child, seen),
    ]),
  );
}

export function redactStructuredValue(value: unknown): unknown {
  return redactInternal(value, new WeakSet());
}
