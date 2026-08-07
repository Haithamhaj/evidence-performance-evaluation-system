import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { outputSchemaDescriptor } from "@evaluation/ai-routing";
import { databaseAuditWriter } from "@evaluation/audit";
import {
  COACHING_INSIGHT_OUTPUT_SCHEMA_VERSION,
  COACHING_INSIGHT_PROMPT_VERSION,
  COACHING_INSIGHT_ROUTE,
  COACHING_INSIGHT_TRUSTED_PROMPT,
  CoachingInsightAiOutputSchema,
} from "@evaluation/coaching-development";
import { AppError } from "@evaluation/contracts";
import { createDatabaseClient } from "@evaluation/database";
import { z } from "zod";

import {
  changeAuthorizedAiRoute,
  registerAuthorizedAiOutputSchema,
} from "../apps/api/src/ai-routing/ai-routing.module.js";

const ArgumentsSchema = z
  .object({
    dryRun: z.boolean(),
    actorId: z.string().uuid().optional(),
    correlationId: z.string().uuid().optional(),
    systemScopeId: z.string().uuid().optional(),
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

const promptHash = createHash("sha256").update(COACHING_INSIGHT_TRUSTED_PROMPT).digest("hex");
const schema = outputSchemaDescriptor(
  COACHING_INSIGHT_ROUTE,
  COACHING_INSIGHT_OUTPUT_SCHEMA_VERSION,
  CoachingInsightAiOutputSchema,
);
const expectedBehavior =
  "Returns a neutral source-cited coaching draft for employee review, without a rating, rank, score, promotion, discipline, leave penalty, evidence quota, or unsupported conclusion.";

export async function registerCoachingInsightAiRoute(
  input: z.infer<typeof ArgumentsSchema> & { databaseUrl?: string },
) {
  const parsed = ArgumentsSchema.parse(input);
  const plan = {
    routeKey: COACHING_INSIGHT_ROUTE,
    promptVersion: COACHING_INSIGHT_PROMPT_VERSION,
    promptHash,
    outputSchemaVersion: COACHING_INSIGHT_OUTPUT_SCHEMA_VERSION,
    outputSchemaHash: schema.schemaHash,
  };
  if (parsed.dryRun) return plan;
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
  if (databaseUrl === undefined || databaseUrl.length === 0)
    throw new Error("DATABASE_URL is required");
  const database = createDatabaseClient(databaseUrl);
  const principal = { userId: parsed.actorId, active: true } as const;
  try {
    const outputArtifact = await registerAuthorizedAiOutputSchema(database, principal, {
      routeKey: COACHING_INSIGHT_ROUTE,
      version: COACHING_INSIGHT_OUTPUT_SCHEMA_VERSION,
      schema: CoachingInsightAiOutputSchema,
      reason: parsed.reason,
      expectedBehavior,
      evaluationEvidenceReferences: [`ai-eval:${schema.schemaHash}`],
      correlationId: parsed.correlationId,
    });
    const prompt = await registerPrompt(database, parsed, outputArtifact.id);
    const sharedRoute = await database.aiRoute.findUnique({
      where: {
        routeKey_level_scopeId: {
          routeKey: "update.structure",
          level: "system",
          scopeId: parsed.systemScopeId,
        },
      },
      include: {
        configs: {
          orderBy: { version: "desc" },
          take: 1,
          include: { providers: { orderBy: { position: "asc" } } },
        },
      },
    });
    const providers =
      sharedRoute?.configs[0]?.providers.map(({ providerConfigId }) => ({ providerConfigId })) ??
      [];
    if (providers.length === 0)
      throw new AppError("AI_ROUTE_PROVIDER_REQUIRED", "errors.ai.routeProviderRequired", 409);
    const current = await database.aiRoute.findUnique({
      where: {
        routeKey_level_scopeId: {
          routeKey: COACHING_INSIGHT_ROUTE,
          level: "system",
          scopeId: parsed.systemScopeId,
        },
      },
      include: {
        configs: {
          orderBy: { version: "desc" },
          take: 1,
          include: { providers: { orderBy: { position: "asc" } } },
        },
      },
    });
    const currentProviderIds =
      current?.configs[0]?.providers.map(({ providerConfigId }) => providerConfigId) ?? [];
    const requestedProviderIds = providers.map(({ providerConfigId }) => providerConfigId);
    const alreadySelected =
      currentProviderIds.length === requestedProviderIds.length &&
      currentProviderIds.every((providerId, index) => providerId === requestedProviderIds[index]);
    const route = alreadySelected
      ? {
          routeId: current!.id,
          configId: current!.configs[0]!.id,
          configVersion: current!.configs[0]!.version,
        }
      : await changeAuthorizedAiRoute(database, principal, {
          routeKey: COACHING_INSIGHT_ROUTE,
          level: "system",
          scopeId: parsed.systemScopeId,
          reason: parsed.reason,
          correlationId: parsed.correlationId,
          providers,
        });
    return { ...plan, promptArtifactId: prompt.id, outputArtifactId: outputArtifact.id, ...route };
  } finally {
    await database.$disconnect();
  }
}

async function registerPrompt(
  database: ReturnType<typeof createDatabaseClient>,
  input: z.infer<typeof ArgumentsSchema> & {
    actorId: string;
    correlationId: string;
    systemScopeId: string;
    reason: string;
  },
  outputArtifactId: string,
) {
  return database.$transaction(async (transaction) => {
    const existing = await transaction.analysisPromptArtifact.findUnique({
      where: {
        routeKey_version: {
          routeKey: COACHING_INSIGHT_ROUTE,
          version: COACHING_INSIGHT_PROMPT_VERSION,
        },
      },
    });
    if (
      existing !== null &&
      (existing.bodyHash !== promptHash || existing.trustedBody !== COACHING_INSIGHT_TRUSTED_PROMPT)
    )
      throw new AppError("AI_PROMPT_VERSION_CONFLICT", "errors.ai.promptVersionConflict", 409);
    if (existing !== null) return existing;
    const prompt = await transaction.analysisPromptArtifact.create({
      data: {
        routeKey: COACHING_INSIGHT_ROUTE,
        version: COACHING_INSIGHT_PROMPT_VERSION,
        bodyHash: promptHash,
        trustedBody: COACHING_INSIGHT_TRUSTED_PROMPT,
        expectedBehavior,
        registeredById: input.actorId,
        registrationReason: input.reason,
      },
    });
    await databaseAuditWriter.append(transaction, {
      eventType: "ai.prompt.registered",
      actor: { kind: "human", id: input.actorId },
      effectiveSubjectId: input.actorId,
      scopeType: "system",
      scopeId: input.systemScopeId,
      targetType: "analysis_prompt_artifact",
      targetId: prompt.id,
      reason: input.reason,
      safeDiff: { routeKey: COACHING_INSIGHT_ROUTE, bodyHash: promptHash, outputArtifactId },
      correlationId: input.correlationId,
      source: "api",
    });
    return prompt;
  });
}

function parseArguments(argv: readonly string[]) {
  const values: Record<string, unknown> = { dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
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
  const result = await registerCoachingInsightAiRoute(parseArguments(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
