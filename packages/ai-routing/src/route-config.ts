import { AppError } from "@evaluation/contracts";
import { z } from "zod";

export const AiRouteChangeSchema = z
  .object({
    routeKey: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[a-z0-9]+(?:[.-][a-z0-9-]+)*$/u),
    level: z.enum(["project", "department", "system"]),
    scopeId: z.string().uuid(),
    reason: z
      .string()
      .min(3)
      .max(500)
      .refine((value) => value === value.trim()),
    correlationId: z.string().uuid(),
    providers: z
      .array(z.object({ providerConfigId: z.string().uuid() }).strict())
      .min(1)
      .max(10)
      .refine(
        (providers) =>
          new Set(providers.map(({ providerConfigId }) => providerConfigId)).size ===
          providers.length,
      ),
  })
  .strict();

const AiRouteChangeContextSchema = z
  .object({
    actorId: z.string().uuid(),
    effectiveSubjectId: z.string().uuid(),
    source: z.enum(["api", "admin_replay"]),
  })
  .strict();

export type AiRouteChangeRequest = z.infer<typeof AiRouteChangeSchema>;
export type AiRouteChangeContext = z.infer<typeof AiRouteChangeContextSchema>;
export type AiRouteChange = AiRouteChangeRequest & AiRouteChangeContext;

type DatabaseClient = ReturnType<typeof import("@evaluation/database").createDatabaseClient>;
type DatabaseTransaction = Parameters<Parameters<DatabaseClient["$transaction"]>[0]>[0];
type AuditWriter = import("@evaluation/contracts").AuditWriter<DatabaseTransaction>;
export type AiRouteChangeAuthorizer = (
  transaction: DatabaseTransaction,
  input: AiRouteChange,
) => Promise<void>;

export async function changeAiRouteWithAudit(
  client: DatabaseClient,
  input: unknown,
  context: AiRouteChangeContext,
  writer: AuditWriter,
  authorize?: AiRouteChangeAuthorizer,
): Promise<Readonly<{ routeId: string; configId: string; configVersion: number }>> {
  const parsed = {
    ...AiRouteChangeSchema.parse(input),
    ...AiRouteChangeContextSchema.parse(context),
  };
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await client.$transaction(
        async (transaction) => changeInTransaction(transaction, parsed, writer, authorize),
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (attempt < 4 && isConcurrencyConflict(error)) continue;
      throw error;
    }
  }
  throw new Error("Unreachable AI route change retry state");
}

async function changeInTransaction(
  transaction: DatabaseTransaction,
  input: AiRouteChange,
  writer: AuditWriter,
  authorize: AiRouteChangeAuthorizer | undefined,
) {
  await authorize?.(transaction, input);
  const scope = await transaction.authorizationScope.findUnique({
    where: { id_scopeType: { id: input.scopeId, scopeType: input.level } },
    select: { id: true },
  });
  const actor = await transaction.user.findUnique({
    where: { id: input.actorId },
    select: { id: true },
  });
  const providerConfigs = await transaction.aiProviderConfig.findMany({
    where: { id: { in: input.providers.map(({ providerConfigId }) => providerConfigId) } },
  });
  if (scope === null)
    throw new AppError("AI_ROUTE_SCOPE_INVALID", "errors.ai.routeScopeInvalid", 400);
  if (actor === null)
    throw new AppError("AI_ROUTE_ACTOR_INVALID", "errors.ai.routeActorInvalid", 400);
  const providersById = new Map(providerConfigs.map((provider) => [provider.id, provider]));
  const orderedProviders = input.providers.map(({ providerConfigId }) => {
    const provider = providersById.get(providerConfigId);
    if (provider === undefined) {
      throw new AppError("AI_PROVIDER_CONFIG_INVALID", "errors.ai.providerConfigInvalid", 400);
    }
    return provider;
  });

  let route = await transaction.aiRoute.findUnique({
    where: {
      routeKey_level_scopeId: {
        routeKey: input.routeKey,
        level: input.level,
        scopeId: input.scopeId,
      },
    },
    select: { id: true },
  });
  route ??= await transaction.aiRoute.create({
    data: { routeKey: input.routeKey, level: input.level, scopeId: input.scopeId },
    select: { id: true },
  });
  const previous = await transaction.aiRouteConfig.findFirst({
    where: { routeId: route.id },
    orderBy: { version: "desc" },
    include: { providers: { orderBy: { position: "asc" }, include: { providerConfig: true } } },
  });
  const version = (previous?.version ?? 0) + 1;
  const config = await transaction.aiRouteConfig.create({
    data: {
      routeId: route.id,
      version,
      reason: input.reason,
      createdById: input.actorId,
      providers: {
        create: orderedProviders.map((provider, position) => ({
          position,
          providerConfigId: provider.id,
          providerConfigVersion: provider.version,
        })),
      },
    },
    include: { providers: { orderBy: { position: "asc" }, include: { providerConfig: true } } },
  });

  const snapshot = (value: typeof config | typeof previous) =>
    value === null
      ? null
      : {
          configId: value.id,
          version: value.version,
          providers: value.providers.map(({ providerConfig }) => ({
            providerConfigId: providerConfig.id,
            providerConfigVersion: providerConfig.version,
            providerKey: providerConfig.providerKey,
            modelKey: providerConfig.modelKey,
            locality: providerConfig.locality,
          })),
        };
  const effectiveAt = config.createdAt.toISOString();
  await writer.append(transaction, {
    eventType: "ai.route.changed",
    actor: { kind: "human", id: input.actorId },
    effectiveSubjectId: input.effectiveSubjectId,
    scopeType: input.level,
    scopeId: input.scopeId,
    targetType: "ai_route_config",
    targetId: config.id,
    reason: input.reason,
    safeDiff: {
      routeKey: input.routeKey,
      routeLevel: input.level,
      affectedDataType: input.routeKey.split(".")[0] ?? input.routeKey,
      administratorId: input.actorId,
      effectiveAt,
      previous: snapshot(previous),
      next: snapshot(config),
    },
    correlationId: input.correlationId,
    source: input.source,
  });
  return { routeId: route.id, configId: config.id, configVersion: version };
}

function isConcurrencyConflict(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  return ["P2034", "P2002"].includes(String((error as { code?: unknown }).code));
}
