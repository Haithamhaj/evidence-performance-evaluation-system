import { AppError } from "@evaluation/contracts";

import { PromptAwareOpenAiCompatibleAdapter } from "./adapters/prompt-aware-openai-compatible.js";
import { PrismaAiRoutingRepository } from "./prisma-repository.js";
import { AiRouter } from "./router.js";

export interface AiCredentialSecretResolver {
  get(providerKey: string): Promise<string | undefined>;
}

export async function createRuntimeAiRouter(input: {
  database: import("@evaluation/database").DatabaseClient;
  secretResolver: AiCredentialSecretResolver;
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
  for (const route of routes) {
    const activeConfig = route.configs[0];
    if (activeConfig === undefined) continue;
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
