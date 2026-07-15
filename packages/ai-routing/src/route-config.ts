import { AppError } from "@evaluation/contracts";
import { z } from "zod";

const ProviderRouteSchema = z
  .object({
    providerKey: z
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
  })
  .strict();

export const AiRouteChangeSchema = z
  .object({
    routeKey: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[a-z0-9]+(?:[.-][a-z0-9-]+)*$/u)
      .refine((value) => value === value.trim()),
    level: z.enum(["project", "department", "system"]),
    scopeId: z.string().uuid(),
    reason: z
      .string()
      .min(3)
      .max(500)
      .refine((value) => value === value.trim()),
    actor: z.object({ kind: z.literal("human"), id: z.string().uuid() }).strict(),
    effectiveSubjectId: z.string().uuid(),
    correlationId: z.string().uuid(),
    source: z.enum(["api", "admin_replay"]),
    providers: z.array(ProviderRouteSchema).min(1).max(10),
  })
  .strict();

export type AiRouteChange = z.infer<typeof AiRouteChangeSchema>;

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
  writer: AuditWriter,
  authorize?: AiRouteChangeAuthorizer,
): Promise<Readonly<{ routeId: string; configId: string; configVersion: number }>> {
  const parsed = AiRouteChangeSchema.parse(input);
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
  if (scope === null) {
    throw new AppError("AI_ROUTE_SCOPE_INVALID", "errors.ai.routeScopeInvalid", 400);
  }
  const actor = await transaction.user.findUnique({
    where: { id: input.actor.id },
    select: { id: true },
  });
  if (actor === null) {
    throw new AppError("AI_ROUTE_ACTOR_INVALID", "errors.ai.routeActorInvalid", 400);
  }

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
  const latest = await transaction.aiRouteConfig.findFirst({
    where: { routeId: route.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (latest?.version ?? 0) + 1;
  const providerChain = input.providers.map((provider) => ({ ...provider }));
  const config = await transaction.aiRouteConfig.create({
    data: {
      routeId: route.id,
      version,
      providerChain,
      reason: input.reason,
      createdById: input.actor.id,
    },
    select: { id: true },
  });

  await writer.append(transaction, {
    eventType: "ai.route.changed",
    actor: input.actor,
    effectiveSubjectId: input.effectiveSubjectId,
    scopeType: input.level,
    scopeId: input.scopeId,
    targetType: "ai_route_config",
    targetId: config.id,
    reason: input.reason,
    safeDiff: {
      routeKey: input.routeKey,
      routeLevel: input.level,
      configVersion: version,
      providerChain,
    },
    correlationId: input.correlationId,
    source: input.source,
  });
  return { routeId: route.id, configId: config.id, configVersion: version };
}

function isConcurrencyConflict(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === "P2034" || code === "P2002";
}

export function parseProviderChain(
  value: unknown,
): readonly import("./contracts.js").AiProviderRoute[] {
  return z.array(ProviderRouteSchema).min(1).max(10).parse(value);
}
