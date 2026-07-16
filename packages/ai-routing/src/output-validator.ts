import { AppError } from "@evaluation/contracts";
import { z } from "zod";

const ALWAYS_FORBIDDEN = new Set([
  "rating",
  "performancerating",
  "suggestedrating",
  "predictedrating",
  "recommendedrating",
  "employeerank",
  "employeeranking",
  "productivityscore",
]);
const PERFORMANCE_INPUT_FORBIDDEN = new Set([
  "commitcount",
  "pullrequestcount",
  "checkcount",
  "activitycount",
  "projectcount",
  "taskcount",
  "documentationreadiness",
  "documentationreadinesspercentage",
  "readinesspercentage",
  "readinessscore",
]);
const PERFORMANCE_ROUTE = /(?:^|[.-])(?:evaluation|performance|rating|coaching)(?:[.-]|$)/iu;

function normalizeField(field: string): string {
  return field.replace(/[^a-z0-9]/giu, "").toLowerCase();
}

function fieldTokens(field: string): ReadonlySet<string> {
  return new Set(
    field
      .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
      .toLowerCase()
      .split(/[^a-z0-9]+/gu)
      .filter((token) => token.length > 0)
      .map(singularToken),
  );
}

function singularToken(token: string): string {
  if (token.endsWith("ies") && token.length > 3) return `${token.slice(0, -3)}y`;
  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 3) {
    return token.slice(0, -1);
  }
  return token;
}

function forbiddenField(routeKey: string, field: string): boolean {
  const normalized = normalizeField(field);
  const tokens = fieldTokens(field);
  const hasAny = (values: readonly string[]) => values.some((value) => tokens.has(value));
  const ratingOutput =
    tokens.has("rating") ||
    /(?:recommended|suggested|predicted|performance|employee|manager|final|overall|criterion)rating/iu.test(
      normalized,
    );
  const employeeRanking =
    (hasAny(["employee", "team", "member", "worker", "person"]) &&
      hasAny(["rank", "ranked", "ranking", "order", "leaderboard"])) ||
    normalized === "employeerank" ||
    normalized === "employeeranking" ||
    /(?:employee.*rank|rank.*employee)/iu.test(normalized);
  const performanceScore = tokens.has("performance") && hasAny(["score", "grade"]);
  const productivityScore = tokens.has("productivity") || normalized.includes("productivity");
  const activityNoun =
    hasAny([
      "commit",
      "update",
      "activity",
      "evidence",
      "check",
      "pr",
      "project",
      "task",
      "delivery",
      "output",
    ]) ||
    (tokens.has("changed") && tokens.has("line"));
  const rawActivityCount =
    activityNoun && hasAny(["count", "total", "number", "num", "amount", "volume", "frequency"]);
  return (
    ALWAYS_FORBIDDEN.has(normalized) ||
    ratingOutput ||
    performanceScore ||
    employeeRanking ||
    productivityScore ||
    (PERFORMANCE_ROUTE.test(routeKey) &&
      (PERFORMANCE_INPUT_FORBIDDEN.has(normalized) ||
        rawActivityCount ||
        tokens.has("readiness"))) ||
    (normalized.includes("readiness") && normalized.includes("performance"))
  );
}

function collectPropertyNames(value: unknown, properties: string[]): void {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectPropertyNames(item, properties);
    return;
  }
  const record = value as Record<string, unknown>;
  if (record.properties !== null && typeof record.properties === "object") {
    properties.push(...Object.keys(record.properties as Record<string, unknown>));
  }
  for (const child of Object.values(record)) collectPropertyNames(child, properties);
}

function collectRuntimePropertyNames(
  value: unknown,
  properties: string[],
  seen: WeakSet<object>,
): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collectRuntimePropertyNames(item, properties, seen);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    properties.push(key);
    collectRuntimePropertyNames(child, properties, seen);
  }
}

export function validateAiOutputSchema(routeKey: string, schema: z.ZodType): void {
  const fields: string[] = [];
  collectPropertyNames(z.toJSONSchema(schema), fields);
  if (fields.some((field) => forbiddenField(routeKey, field))) {
    throw new AppError("AI_OUTPUT_SCHEMA_FORBIDDEN", "errors.ai.outputSchemaForbidden", 400);
  }
}

export type OutputValidation<T> =
  Readonly<{ valid: true; output: T }> | Readonly<{ valid: false; issueCodes: readonly string[] }>;

export function validateAiOutput<T>(
  routeKey: string,
  schema: z.ZodType<T>,
  output: unknown,
): OutputValidation<T> {
  const parsed = schema.safeParse(output);
  if (!parsed.success) {
    return {
      valid: false,
      issueCodes: [...new Set(parsed.error.issues.map(({ code }) => code))].sort(),
    };
  }
  const fields: string[] = [];
  collectRuntimePropertyNames(parsed.data, fields, new WeakSet());
  if (fields.some((field) => forbiddenField(routeKey, field))) {
    return { valid: false, issueCodes: ["forbidden_performance_field"] };
  }
  return { valid: true, output: parsed.data };
}
