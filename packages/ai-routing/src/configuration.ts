import { createHash } from "node:crypto";

import { AppError } from "@evaluation/contracts";
import { z } from "zod";

import { RouteKeySchema, VersionReferenceSchema } from "./contracts.js";
import { validateAiOutputSchema } from "./output-validator.js";

export function outputSchemaDescriptor(routeKey: string, version: string, schema: z.ZodType) {
  const parsedRouteKey = RouteKeySchema.parse(routeKey);
  const parsedVersion = VersionReferenceSchema.parse(version);
  assertPortableOutputSchema(schema);
  validateAiOutputSchema(parsedRouteKey, schema);
  let artifact: Record<string, unknown>;
  try {
    artifact = z.toJSONSchema(schema) as Record<string, unknown>;
  } catch {
    throw unrepresentableSchema();
  }
  const canonical = canonicalJson(artifact);
  return {
    routeKey: parsedRouteKey,
    version: parsedVersion,
    schemaHash: createHash("sha256").update(canonical).digest("hex"),
    schemaArtifact: artifact,
  };
}

const PORTABLE_ZOD_TYPES = new Set([
  "any",
  "array",
  "boolean",
  "enum",
  "intersection",
  "literal",
  "never",
  "null",
  "nullable",
  "number",
  "object",
  "optional",
  "record",
  "string",
  "tuple",
  "union",
  "unknown",
]);

function assertPortableOutputSchema(value: unknown, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  const internal = value as { _zod?: { def?: unknown } };
  const definition = internal._zod?.def;
  if (definition !== null && typeof definition === "object") {
    const record = definition as Record<string, unknown>;
    const checkKind = typeof record.check === "string" ? record.check : undefined;
    if (checkKind === "custom" || checkKind === "overwrite") {
      throw unrepresentableSchema();
    }
    if (record.type !== undefined) {
      if (
        typeof record.type !== "string" ||
        !PORTABLE_ZOD_TYPES.has(record.type) ||
        record.coerce === true
      ) {
        throw unrepresentableSchema();
      }
    } else if (checkKind === undefined) {
      throw unrepresentableSchema();
    }
    const checks = Array.isArray(record.checks) ? record.checks : [];
    for (const check of checks) {
      const checkDefinition = (check as { _zod?: { def?: { check?: unknown } } })._zod?.def;
      if (checkDefinition?.check === "custom") throw unrepresentableSchema();
    }
    for (const child of Object.values(record)) assertPortableOutputSchema(child, seen);
    return;
  }
  if (Array.isArray(value)) {
    for (const child of value) assertPortableOutputSchema(child, seen);
    return;
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    assertPortableOutputSchema(child, seen);
  }
}

function unrepresentableSchema(): AppError {
  return new AppError(
    "AI_SCHEMA_SEMANTICS_UNREPRESENTABLE",
    "errors.ai.schemaSemanticsUnrepresentable",
    400,
  );
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}
