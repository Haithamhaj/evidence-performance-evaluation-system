import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { outputSchemaDescriptor } from "@evaluation/ai-routing";
import { databaseAuditWriter } from "@evaluation/audit";
import { AppError } from "@evaluation/contracts";
import { createDatabaseClient } from "@evaluation/database";
import { z } from "zod";

import {
  changeAuthorizedAiRoute,
  registerAuthorizedAiOutputSchema,
} from "../apps/api/src/ai-routing/ai-routing.module.js";
import { RESEARCH_AI_ROUTES } from "../packages/research-experiments/src/prompts.js";

const ArgumentsSchema = z
  .object({
    dryRun: z.boolean(),
    actorId: z.string().uuid().optional(),
    correlationId: z.string().uuid().optional(),
    systemScopeId: z.string().uuid().optional(),
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

const routeMetadata = RESEARCH_AI_ROUTES.map((route) => ({
  ...route,
  promptHash: createHash("sha256").update(route.trustedPrompt).digest("hex"),
  schema: outputSchemaDescriptor(route.routeKey, route.outputSchemaVersion, route.outputSchema),
}));

const plan = routeMetadata.map((route) => ({
  routeKey: route.routeKey,
  promptVersion: route.promptTemplateVersion,
  promptHash: route.promptHash,
  outputSchemaVersion: route.outputSchemaVersion,
  outputSchemaHash: route.schema.schemaHash,
}));

type RegistrationContext = z.infer<typeof ArgumentsSchema> & {
  actorId: string;
  correlationId: string;
  systemScopeId: string;
  reason: string;
};

export async function registerResearchExperimentsAiRoutes(
  input: z.infer<typeof ArgumentsSchema> & { databaseUrl?: string },
) {
  const parsed = ArgumentsSchema.parse({
    dryRun: input.dryRun,
    actorId: input.actorId,
    correlationId: input.correlationId,
    systemScopeId: input.systemScopeId,
    reason: input.reason,
  });
  if (parsed.dryRun) return { routes: plan };
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
    const sharedRoute = await database.aiRoute.findUnique({
      where: {
        routeKey_level_scopeId: {
          routeKey: "update.structure",
          level: "system",
          scopeId: context.systemScopeId,
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
    const providerSelections =
      sharedRoute?.configs[0]?.providers.map(({ providerConfigId }) => ({ providerConfigId })) ??
      [];
    if (providerSelections.length === 0) {
      throw new AppError("AI_ROUTE_PROVIDER_REQUIRED", "errors.ai.routeProviderRequired", 409);
    }

    const registeredRoutes = [];
    for (const route of routeMetadata) {
      const outputArtifact = await registerAuthorizedAiOutputSchema(database, principal, {
        routeKey: route.routeKey,
        version: route.outputSchemaVersion,
        schema: route.outputSchema,
        reason: context.reason,
        expectedBehavior: expectedBehavior(route.routeKey),
        evaluationEvidenceReferences: [`ai-eval:${route.schema.schemaHash}`],
        correlationId: context.correlationId,
      });
      const prompt = await registerPrompt(database, context, route, outputArtifact.id);
      const existingRoute = await database.aiRoute.findUnique({
        where: {
          routeKey_level_scopeId: {
            routeKey: route.routeKey,
            level: "system",
            scopeId: context.systemScopeId,
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
        existingRoute?.configs[0]?.providers.map(({ providerConfigId }) => providerConfigId) ?? [];
      const requestedProviderIds = providerSelections.map(
        ({ providerConfigId }) => providerConfigId,
      );
      const alreadySelected =
        currentProviderIds.length === requestedProviderIds.length &&
        currentProviderIds.every((providerId, index) => providerId === requestedProviderIds[index]);
      const registeredRoute = alreadySelected
        ? {
            routeId: existingRoute!.id,
            configId: existingRoute!.configs[0]!.id,
            configVersion: existingRoute!.configs[0]!.version,
          }
        : await changeAuthorizedAiRoute(database, principal, {
            routeKey: route.routeKey,
            level: "system",
            scopeId: context.systemScopeId,
            reason: context.reason,
            correlationId: context.correlationId,
            providers: providerSelections,
          });
      registeredRoutes.push({
        routeKey: route.routeKey,
        promptVersion: route.promptTemplateVersion,
        promptHash: route.promptHash,
        outputSchemaVersion: route.outputSchemaVersion,
        outputSchemaHash: route.schema.schemaHash,
        promptArtifactId: prompt.id,
        outputArtifactId: outputArtifact.id,
        ...registeredRoute,
      });
    }
    return { routes: registeredRoutes };
  } finally {
    await database.$disconnect();
  }
}

async function registerPrompt(
  database: ReturnType<typeof createDatabaseClient>,
  context: RegistrationContext,
  route: (typeof routeMetadata)[number],
  outputArtifactId: string,
) {
  return database.$transaction(async (transaction) => {
    const existing = await transaction.analysisPromptArtifact.findUnique({
      where: {
        routeKey_version: {
          routeKey: route.routeKey,
          version: route.promptTemplateVersion,
        },
      },
    });
    if (
      existing !== null &&
      (existing.bodyHash !== route.promptHash || existing.trustedBody !== route.trustedPrompt)
    ) {
      throw new AppError("AI_PROMPT_VERSION_CONFLICT", "errors.ai.promptVersionConflict", 409);
    }
    if (existing !== null) return existing;
    const prompt = await transaction.analysisPromptArtifact.create({
      data: {
        routeKey: route.routeKey,
        version: route.promptTemplateVersion,
        bodyHash: route.promptHash,
        trustedBody: route.trustedPrompt,
        expectedBehavior: expectedBehavior(route.routeKey),
        registeredById: context.actorId,
        registrationReason: context.reason,
      },
    });
    await databaseAuditWriter.append(transaction, {
      eventType: "ai.prompt.registered",
      actor: { kind: "human", id: context.actorId },
      effectiveSubjectId: context.actorId,
      scopeType: "system",
      scopeId: context.systemScopeId,
      targetType: "analysis_prompt_artifact",
      targetId: prompt.id,
      reason: context.reason,
      safeDiff: {
        routeKey: route.routeKey,
        bodyHash: route.promptHash,
        outputArtifactId,
      },
      correlationId: context.correlationId,
      source: "api",
    });
    return prompt;
  });
}

function expectedBehavior(routeKey: string): string {
  if (routeKey === "research.source-review.v1") {
    return "Returns an employee-reviewable, citation-bound source and Project relevance draft without claiming source benefit.";
  }
  if (routeKey === "research.frame.v1") {
    return "Returns one editable Research frame and at most one clarification question.";
  }
  if (routeKey === "research.synthesize.v1") {
    return "Separates source-supported findings from unsupported claims, missing alternatives, and uncertainty.";
  }
  if (routeKey === "experiment.method-review.v1") {
    return "Reviews method completeness without declaring scientific validity or changing Experiment state.";
  }
  return "Interprets exactly one immutable named run as a draft without confirming a hypothesis or conclusion.";
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
  const result = await registerResearchExperimentsAiRoutes(parseArguments(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
