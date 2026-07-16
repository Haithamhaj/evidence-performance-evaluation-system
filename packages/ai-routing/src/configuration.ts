import { createHash } from "node:crypto";

import { AppError } from "@evaluation/contracts";
import { z } from "zod";

import { safeEndpoint } from "./adapters/openai-compatible.js";
import { RouteKeySchema, VersionReferenceSchema } from "./contracts.js";

type DatabaseClient = ReturnType<typeof import("@evaluation/database").createDatabaseClient>;

const ProviderConfigurationSchema = z
  .object({
    providerKey: z
      .string()
      .min(1)
      .max(100)
      .refine((value) => value === value.trim()),
    adapterKey: z
      .string()
      .min(1)
      .max(100)
      .refine((value) => value === value.trim()),
    modelKey: z
      .string()
      .min(1)
      .max(200)
      .refine((value) => value === value.trim()),
    locality: z.enum(["local", "external"]),
    endpoint: z.string().min(1).max(2048),
    reason: z
      .string()
      .min(3)
      .max(500)
      .refine((value) => value === value.trim()),
    createdById: z.string().uuid(),
  })
  .strict();

export async function registerAiProviderConfig(
  client: DatabaseClient,
  input: unknown,
  trustedLocalHosts: readonly string[] = [],
): Promise<
  Readonly<{
    id: string;
    providerKey: string;
    version: number;
    adapterKey: string;
    modelKey: string;
    locality: import("./contracts.js").ProviderLocality;
    endpoint: string;
  }>
> {
  const parsed = ProviderConfigurationSchema.parse(input);
  const endpoint = safeEndpoint(parsed.endpoint, parsed.locality, trustedLocalHosts).toString();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await client.$transaction(
        async (transaction) => {
          const actor = await transaction.user.findUnique({
            where: { id: parsed.createdById },
            select: { id: true },
          });
          if (actor === null) {
            throw new AppError("AI_PROVIDER_ACTOR_INVALID", "errors.ai.providerActorInvalid", 400);
          }
          const latest = await transaction.aiProviderConfig.findFirst({
            where: { providerKey: parsed.providerKey },
            orderBy: { version: "desc" },
            select: { version: true },
          });
          return transaction.aiProviderConfig.create({
            data: {
              ...parsed,
              endpoint,
              version: (latest?.version ?? 0) + 1,
            },
          });
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (attempt < 4 && isConcurrencyConflict(error)) continue;
      throw error;
    }
  }
  throw new Error("Unreachable provider configuration retry state");
}

export function outputSchemaDescriptor(routeKey: string, version: string, schema: z.ZodType) {
  const parsedRouteKey = RouteKeySchema.parse(routeKey);
  const parsedVersion = VersionReferenceSchema.parse(version);
  const artifact = z.toJSONSchema(schema);
  const canonical = canonicalJson(artifact);
  return {
    routeKey: parsedRouteKey,
    version: parsedVersion,
    schemaHash: createHash("sha256").update(canonical).digest("hex"),
    schemaArtifact: artifact,
  };
}

export async function registerAiOutputSchemaArtifact(
  client: DatabaseClient,
  routeKey: string,
  version: string,
  schema: z.ZodType,
): Promise<Readonly<{ id: string; routeKey: string; version: string; schemaHash: string }>> {
  const descriptor = outputSchemaDescriptor(routeKey, version, schema);
  const existing = await client.aiOutputSchemaArtifact.findUnique({
    where: { routeKey_version: { routeKey: descriptor.routeKey, version: descriptor.version } },
  });
  if (existing !== null) {
    if (existing.schemaHash !== descriptor.schemaHash) {
      throw new AppError("AI_SCHEMA_VERSION_CONFLICT", "errors.ai.schemaVersionConflict", 409);
    }
    return existing;
  }
  return client.aiOutputSchemaArtifact.create({
    data: { ...descriptor, schemaArtifact: descriptor.schemaArtifact as never },
  });
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

function isConcurrencyConflict(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  return ["P2034", "P2002"].includes(String((error as { code?: unknown }).code));
}
