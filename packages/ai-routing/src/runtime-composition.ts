import { AppError } from "@evaluation/contracts";
import { createHash } from "node:crypto";

import { PromptAwareOpenAiCompatibleAdapter } from "./adapters/prompt-aware-openai-compatible.js";
import { PrismaAiRoutingRepository } from "./prisma-repository.js";
import { AiRouter } from "./router.js";

export interface AiCredentialSecretResolver {
  get(providerKey: string): Promise<string | undefined>;
}

export async function createRuntimeAiRouter(input: {
  database: import("@evaluation/database").DatabaseClient;
  secretResolver: AiCredentialSecretResolver;
  privateMediaResolver?: import("./adapters/prompt-aware-openai-compatible.js").PrivateMediaResolver;
}): Promise<AiRouter<import("@evaluation/database").DatabaseTransaction>> {
  const routes = await input.database.aiRoute.findMany({
    include: {
      configs: {
        orderBy: { version: "desc" },
        take: 1,
        include: {
          providers: {
            orderBy: { position: "asc" },
            include: { providerConfig: true },
          },
        },
      },
    },
  });
  const activeProviders = new Map<
    string,
    (typeof routes)[number]["configs"][number]["providers"][number]["providerConfig"]
  >();
  const selectedRouteKeys = new Set<string>();
  for (const route of routes) {
    const activeConfig = route.configs[0];
    if (activeConfig === undefined) continue;
    selectedRouteKeys.add(route.routeKey);
    for (const { providerConfig } of activeConfig.providers) {
      const existing = activeProviders.get(providerConfig.providerKey);
      if (existing !== undefined && existing.id !== providerConfig.id) {
        throw new AppError(
          "AI_PROVIDER_CONFIGURATION_CONFLICT",
          "errors.ai.providerConfigurationConflict",
          500,
        );
      }
      activeProviders.set(providerConfig.providerKey, providerConfig);
    }
  }
  await Promise.all(
    [...selectedRouteKeys].map((routeKey) => requireRouteArtifacts(input.database, routeKey)),
  );
  const adapters = [...activeProviders.values()].map((provider) => {
    if (provider.adapterKey !== "openai-compatible") {
      throw new AppError(
        "AI_PROVIDER_ADAPTER_UNSUPPORTED",
        "errors.ai.providerAdapterUnsupported",
        500,
      );
    }
    return new PromptAwareOpenAiCompatibleAdapter({
      database: input.database,
      providerKey: provider.providerKey,
      adapterKey: provider.adapterKey,
      locality: provider.locality,
      baseUrl: provider.endpoint,
      credentialProvider: () => input.secretResolver.get(provider.providerKey),
      ...(input.privateMediaResolver === undefined ? {} : { privateMediaResolver: input.privateMediaResolver }),
      ...(provider.localTrustPolicyId === null ||
      provider.localTrustPolicyVersion === null ||
      provider.localTrustAllowedIp === null
        ? {}
        : {
            localTrustPolicy: {
              id: provider.localTrustPolicyId,
              version: provider.localTrustPolicyVersion,
              allowedIp: provider.localTrustAllowedIp,
            },
          }),
    });
  });
  const repository = new PrismaAiRoutingRepository(input.database);
  return new AiRouter(repository, repository, adapters);
}

async function requireRouteArtifacts(
  database: import("@evaluation/database").DatabaseClient,
  routeKey: string,
): Promise<void> {
  const [prompt, schema] = await Promise.all([
    database.analysisPromptArtifact.findFirst({
      where: { routeKey },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        routeKey: true,
        version: true,
        bodyHash: true,
        trustedBody: true,
      },
    }),
    database.aiOutputSchemaArtifact.findFirst({
      where: { routeKey },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        routeKey: true,
        version: true,
        schemaHash: true,
        schemaArtifact: true,
      },
    }),
  ]);
  if (prompt === null) {
    throw new AppError("AI_PROMPT_ARTIFACT_NOT_FOUND", "errors.ai.promptArtifactNotFound", 500);
  }
  if (
    prompt.routeKey !== routeKey ||
    prompt.version.length === 0 ||
    !/^[a-f0-9]{64}$/u.test(prompt.bodyHash) ||
    sha256(prompt.trustedBody) !== prompt.bodyHash
  ) {
    throw new AppError("AI_PROMPT_ARTIFACT_MISMATCH", "errors.ai.promptArtifactMismatch", 500);
  }
  if (schema === null) {
    throw new AppError("AI_SCHEMA_ARTIFACT_NOT_FOUND", "errors.ai.schemaArtifactNotFound", 500);
  }
  if (
    schema.routeKey !== routeKey ||
    schema.version.length === 0 ||
    !/^[a-f0-9]{64}$/u.test(schema.schemaHash) ||
    sha256(canonicalJson(schema.schemaArtifact)) !== schema.schemaHash
  ) {
    throw new AppError("AI_SCHEMA_ARTIFACT_MISMATCH", "errors.ai.schemaArtifactMismatch", 500);
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
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
