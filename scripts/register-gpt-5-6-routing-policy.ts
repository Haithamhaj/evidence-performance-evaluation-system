import path from "node:path";
import { fileURLToPath } from "node:url";

import { AppError } from "@evaluation/contracts";
import { createDatabaseClient } from "@evaluation/database";
import { z } from "zod";

import {
  changeAuthorizedAiRoute,
  registerAuthorizedAiProviderConfig,
} from "../apps/api/src/ai-routing/ai-routing.module.js";
import {
  GPT_5_6_MODELS,
  gpt56ProviderOrder,
  gpt56RoutingPlan,
  gpt56TierForRoute,
} from "./gpt-5-6-routing-policy.js";

const ArgumentsSchema = z
  .object({
    dryRun: z.boolean(),
    actorId: z.string().uuid().optional(),
    correlationId: z.string().uuid().optional(),
    systemScopeId: z.string().uuid().optional(),
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

type RegistrationInput = z.infer<typeof ArgumentsSchema> & { databaseUrl?: string };
type RegistrationContext = z.infer<typeof ArgumentsSchema> & {
  actorId: string;
  correlationId: string;
  systemScopeId: string;
  reason: string;
};

const PROVIDER_ENDPOINT = "https://api.openai.com/v1";
const NORMALIZED_PROVIDER_ENDPOINT = "https://api.openai.com/v1/chat/completions";

export async function registerGpt56RoutingPolicy(input: RegistrationInput) {
  const parsed = ArgumentsSchema.parse(input);
  const routes = gpt56RoutingPlan();
  if (parsed.dryRun) {
    return {
      policyVersion: "gpt-5.6-cost-quality.v1",
      routes,
      specializedRoutesUntouched: ["update.transcribe"],
    };
  }
  if (
    parsed.actorId === undefined ||
    parsed.correlationId === undefined ||
    parsed.systemScopeId === undefined ||
    parsed.reason === undefined
  ) {
    throw new AppError(
      "AI_ROUTE_REGISTRATION_CONTEXT_REQUIRED",
      "errors.ai.routeRegistrationContextRequired",
      400,
    );
  }

  const databaseUrl = input.databaseUrl ?? process.env.DATABASE_URL?.trim();
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error("DATABASE_URL is required");
  }

  const database = createDatabaseClient(databaseUrl);
  const context: RegistrationContext = { ...parsed, dryRun: false };
  const principal = { userId: context.actorId, active: true } as const;
  try {
    const providerByModel = new Map<string, { id: string }>();
    for (const modelKey of Object.values(GPT_5_6_MODELS)) {
      const existing = await database.aiProviderConfig.findFirst({
        where: {
          providerKey: "openai",
          adapterKey: "openai-compatible",
          modelKey,
          locality: "external",
          endpoint: NORMALIZED_PROVIDER_ENDPOINT,
        },
        orderBy: { version: "desc" },
        select: { id: true },
      });
      const provider =
        existing ??
        (await registerAuthorizedAiProviderConfig(database, principal, {
          providerKey: "openai",
          adapterKey: "openai-compatible",
          modelKey,
          locality: "external",
          endpoint: PROVIDER_ENDPOINT,
          reason: context.reason,
          correlationId: context.correlationId,
        }));
      providerByModel.set(modelKey, provider);
    }

    const existingRoutes = await database.aiRoute.findMany({
      where: {
        level: "system",
        scopeId: context.systemScopeId,
        routeKey: { in: routes.map(({ routeKey }) => routeKey) },
      },
      include: {
        configs: {
          orderBy: { version: "desc" },
          take: 1,
          include: { providers: { orderBy: { position: "asc" } } },
        },
      },
      orderBy: { routeKey: "asc" },
    });

    const changedRoutes = [];
    for (const route of existingRoutes) {
      const tier = gpt56TierForRoute(route.routeKey);
      const modelOrder = gpt56ProviderOrder(route.routeKey);
      if (tier === null || modelOrder.length === 0) continue;
      const providers = modelOrder.map((modelKey) => {
        const provider = providerByModel.get(modelKey);
        if (provider === undefined) throw new Error(`Missing provider for ${modelKey}`);
        return { providerConfigId: provider.id };
      });
      const currentProviderIds =
        route.configs[0]?.providers.map(({ providerConfigId }) => providerConfigId) ?? [];
      const alreadySelected =
        currentProviderIds.length === providers.length &&
        currentProviderIds.every(
          (providerId, index) => providerId === providers[index]?.providerConfigId,
        );
      const result = alreadySelected
        ? {
            routeId: route.id,
            configId: route.configs[0]!.id,
            configVersion: route.configs[0]!.version,
          }
        : await changeAuthorizedAiRoute(database, principal, {
            routeKey: route.routeKey,
            level: "system",
            scopeId: context.systemScopeId,
            reason: context.reason,
            correlationId: context.correlationId,
            providers,
          });
      changedRoutes.push({
        routeKey: route.routeKey,
        tier,
        models: [...modelOrder],
        reusedExistingConfig: alreadySelected,
        ...result,
      });
    }

    return {
      policyVersion: "gpt-5.6-cost-quality.v1",
      providers: Object.values(GPT_5_6_MODELS),
      routes: changedRoutes,
      deferredRoutes: routes
        .filter(({ routeKey }) => !existingRoutes.some((route) => route.routeKey === routeKey))
        .map(({ routeKey, tier, models }) => ({ routeKey, tier, models })),
      specializedRoutesUntouched: ["update.transcribe"],
    };
  } finally {
    await database.$disconnect();
  }
}

function parseArguments(argv: readonly string[]) {
  const values: Record<string, unknown> = { dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (argument === "--") continue;
    if (argument === "--dry-run") {
      values.dryRun = true;
      continue;
    }
    const next = argv[index + 1];
    if (next === undefined) throw new Error(`Missing value for ${argument}`);
    if (argument === "--actor-id") values.actorId = next;
    else if (argument === "--correlation-id") values.correlationId = next;
    else if (argument === "--system-scope-id") values.systemScopeId = next;
    else if (argument === "--reason") values.reason = next;
    else throw new Error(`Unknown argument ${argument}`);
    index += 1;
  }
  return ArgumentsSchema.parse(values);
}

if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  const result = await registerGpt56RoutingPolicy(parseArguments(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
