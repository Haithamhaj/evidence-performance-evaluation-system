import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { outputSchemaDescriptor } from "@evaluation/ai-routing";
import { databaseAuditWriter } from "@evaluation/audit";
import { AppError } from "@evaluation/contracts";
import { createDatabaseClient } from "@evaluation/database";
import {
  EVALUATION_JUSTIFICATION_OUTPUT_SCHEMA_VERSION,
  EVALUATION_JUSTIFICATION_PROMPT_VERSION,
  EVALUATION_JUSTIFICATION_ROUTE,
  EVALUATION_JUSTIFICATION_TRUSTED_PROMPT,
  EvaluationJustificationOutputSchema,
} from "@evaluation/employee-evaluation";
import { z } from "zod";

import {
  changeAuthorizedAiRoute,
  registerAuthorizedAiOutputSchema,
  registerAuthorizedAiProviderConfig,
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

const MODEL_KEY = "gpt-5.6-terra";
const PROVIDER_ENDPOINT = "https://api.openai.com/v1";
const NORMALIZED_PROVIDER_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const promptHash = createHash("sha256")
  .update(EVALUATION_JUSTIFICATION_TRUSTED_PROMPT)
  .digest("hex");
const outputDescriptor = outputSchemaDescriptor(
  EVALUATION_JUSTIFICATION_ROUTE,
  EVALUATION_JUSTIFICATION_OUTPUT_SCHEMA_VERSION,
  EvaluationJustificationOutputSchema,
);

type RegistrationInput = z.infer<typeof ArgumentsSchema> & { databaseUrl?: string };
type AuthorizedRegistration = z.infer<typeof ArgumentsSchema> & {
  actorId: string;
  correlationId: string;
  systemScopeId: string;
  reason: string;
};

export async function registerEvaluationJustificationAiRoute(input: RegistrationInput) {
  const parsed = ArgumentsSchema.parse(input);
  const plan = {
    routeKey: EVALUATION_JUSTIFICATION_ROUTE,
    modelKey: MODEL_KEY,
    providerEndpoint: PROVIDER_ENDPOINT,
    promptVersion: EVALUATION_JUSTIFICATION_PROMPT_VERSION,
    promptHash,
    outputSchemaVersion: EVALUATION_JUSTIFICATION_OUTPUT_SCHEMA_VERSION,
    outputSchemaHash: outputDescriptor.schemaHash,
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
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const database = createDatabaseClient(databaseUrl);
  const context: AuthorizedRegistration = { ...parsed, dryRun: false };
  const principal = { userId: context.actorId, active: true } as const;
  try {
    const outputArtifact = await registerAuthorizedAiOutputSchema(database, principal, {
      routeKey: EVALUATION_JUSTIFICATION_ROUTE,
      version: EVALUATION_JUSTIFICATION_OUTPUT_SCHEMA_VERSION,
      schema: EvaluationJustificationOutputSchema,
      reason: context.reason,
      expectedBehavior:
        "Drafts source-grounded wording only after the human selects a rating; never recommends a rating, rank, score, or activity-volume inference.",
      evaluationEvidenceReferences: [`ai-eval:${outputDescriptor.schemaHash}`],
      correlationId: context.correlationId,
    });
    const prompt = await registerPrompt(database, context, outputArtifact.id);
    const existingProvider = await database.aiProviderConfig.findFirst({
      where: {
        providerKey: "openai",
        adapterKey: "openai-compatible",
        modelKey: MODEL_KEY,
        locality: "external",
        endpoint: NORMALIZED_PROVIDER_ENDPOINT,
      },
      orderBy: { version: "desc" },
    });
    const provider =
      existingProvider ??
      (await registerAuthorizedAiProviderConfig(database, principal, {
        providerKey: "openai",
        adapterKey: "openai-compatible",
        modelKey: MODEL_KEY,
        locality: "external",
        endpoint: PROVIDER_ENDPOINT,
        reason: context.reason,
        correlationId: context.correlationId,
      }));
    const existingRoute = await database.aiRoute.findUnique({
      where: {
        routeKey_level_scopeId: {
          routeKey: EVALUATION_JUSTIFICATION_ROUTE,
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
    const alreadySelected =
      existingRoute?.configs[0]?.providers.length === 1 &&
      existingRoute.configs[0].providers[0]?.providerConfigId === provider.id;
    const route = alreadySelected
      ? {
          routeId: existingRoute.id,
          configId: existingRoute.configs[0]!.id,
          configVersion: existingRoute.configs[0]!.version,
        }
      : await changeAuthorizedAiRoute(database, principal, {
          routeKey: EVALUATION_JUSTIFICATION_ROUTE,
          level: "system",
          scopeId: context.systemScopeId,
          reason: context.reason,
          correlationId: context.correlationId,
          providers: [{ providerConfigId: provider.id }],
        });
    return {
      ...plan,
      promptArtifactId: prompt.id,
      outputArtifactId: outputArtifact.id,
      ...route,
    };
  } finally {
    await database.$disconnect();
  }
}

async function registerPrompt(
  database: ReturnType<typeof createDatabaseClient>,
  input: AuthorizedRegistration,
  outputArtifactId: string,
) {
  return database.$transaction(async (transaction) => {
    const existing = await transaction.analysisPromptArtifact.findUnique({
      where: {
        routeKey_version: {
          routeKey: EVALUATION_JUSTIFICATION_ROUTE,
          version: EVALUATION_JUSTIFICATION_PROMPT_VERSION,
        },
      },
    });
    if (
      existing !== null &&
      (existing.bodyHash !== promptHash ||
        existing.trustedBody !== EVALUATION_JUSTIFICATION_TRUSTED_PROMPT)
    ) {
      throw new AppError("AI_PROMPT_VERSION_CONFLICT", "errors.ai.promptVersionConflict", 409);
    }
    if (existing !== null) return existing;
    const prompt = await transaction.analysisPromptArtifact.create({
      data: {
        routeKey: EVALUATION_JUSTIFICATION_ROUTE,
        version: EVALUATION_JUSTIFICATION_PROMPT_VERSION,
        bodyHash: promptHash,
        trustedBody: EVALUATION_JUSTIFICATION_TRUSTED_PROMPT,
        expectedBehavior:
          "Editable, source-grounded wording after the employee's rating selection; no rating recommendation.",
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
      safeDiff: {
        routeKey: EVALUATION_JUSTIFICATION_ROUTE,
        bodyHash: promptHash,
        outputArtifactId,
      },
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
  const result = await registerEvaluationJustificationAiRoute(
    parseArguments(process.argv.slice(2)),
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
