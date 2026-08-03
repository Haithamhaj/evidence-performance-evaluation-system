import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { outputSchemaDescriptor } from "@evaluation/ai-routing";
import { databaseAuditWriter } from "@evaluation/audit";
import { AppError } from "@evaluation/contracts";
import { createDatabaseClient } from "@evaluation/database";
import {
  VOICE_TRANSCRIBE_OUTPUT_SCHEMA_VERSION,
  VOICE_TRANSCRIBE_PROMPT_VERSION,
  VOICE_TRANSCRIBE_TRUSTED_PROMPT,
  VoiceTranscriptionAiOutputSchema,
} from "@evaluation/updates-evidence";
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

const routeKey = "update.transcribe";
const modelKey = "gpt-4o-transcribe";
const promptHash = createHash("sha256").update(VOICE_TRANSCRIBE_TRUSTED_PROMPT).digest("hex");
const schema = outputSchemaDescriptor(
  routeKey,
  VOICE_TRANSCRIBE_OUTPUT_SCHEMA_VERSION,
  VoiceTranscriptionAiOutputSchema,
);

export async function registerUpdateTranscribeAiRoute(
  input: z.infer<typeof ArgumentsSchema> & { databaseUrl?: string },
) {
  const parsed = ArgumentsSchema.parse(input);
  const plan = {
    routeKey,
    modelKey,
    promptVersion: VOICE_TRANSCRIBE_PROMPT_VERSION,
    promptHash,
    outputSchemaVersion: VOICE_TRANSCRIBE_OUTPUT_SCHEMA_VERSION,
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
  if (databaseUrl === undefined || databaseUrl.length === 0) throw new Error("DATABASE_URL is required");
  const database = createDatabaseClient(databaseUrl);
  const principal = { userId: parsed.actorId, active: true } as const;
  try {
    const outputArtifact = await registerAuthorizedAiOutputSchema(database, principal, {
      routeKey,
      version: VOICE_TRANSCRIBE_OUTPUT_SCHEMA_VERSION,
      schema: VoiceTranscriptionAiOutputSchema,
      reason: parsed.reason,
      expectedBehavior:
        "Returns an accurate editable transcript with language metadata and no rating, ranking, productivity, readiness, employee-performance, or official-progress output.",
      evaluationEvidenceReferences: [`ai-eval:${schema.schemaHash}`],
      correlationId: parsed.correlationId,
    });
    const prompt = await registerPrompt(database, parsed, outputArtifact.id);
    const existingProvider = await database.aiProviderConfig.findFirst({
      where: {
        providerKey: "openai",
        adapterKey: "openai-compatible",
        modelKey,
        locality: "external",
        endpoint: "https://api.openai.com/v1/chat/completions",
      },
      orderBy: { version: "desc" },
    });
    const provider = existingProvider ?? await registerAuthorizedAiProviderConfig(database, principal, {
      providerKey: "openai",
      adapterKey: "openai-compatible",
      modelKey,
      locality: "external",
      endpoint: "https://api.openai.com/v1/chat/completions",
      reason: parsed.reason,
      correlationId: parsed.correlationId,
    });
    const existingRoute = await database.aiRoute.findUnique({
      where: { routeKey_level_scopeId: { routeKey, level: "system", scopeId: parsed.systemScopeId } },
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
          routeKey,
          level: "system",
          scopeId: parsed.systemScopeId,
          reason: parsed.reason,
          correlationId: parsed.correlationId,
          providers: [{ providerConfigId: provider.id }],
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
      where: { routeKey_version: { routeKey, version: VOICE_TRANSCRIBE_PROMPT_VERSION } },
    });
    if (
      existing !== null &&
      (existing.bodyHash !== promptHash || existing.trustedBody !== VOICE_TRANSCRIBE_TRUSTED_PROMPT)
    ) {
      throw new AppError("AI_PROMPT_VERSION_CONFLICT", "errors.ai.promptVersionConflict", 409);
    }
    if (existing !== null) return existing;
    const prompt = await transaction.analysisPromptArtifact.create({
      data: {
        routeKey,
        version: VOICE_TRANSCRIBE_PROMPT_VERSION,
        bodyHash: promptHash,
        trustedBody: VOICE_TRANSCRIBE_TRUSTED_PROMPT,
        expectedBehavior:
          "An accurate employee-editable transcript that preserves Arabic, English, and mixed technical terms without performance or progress judgments.",
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
      safeDiff: { routeKey, bodyHash: promptHash, outputArtifactId },
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

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = await registerUpdateTranscribeAiRoute(parseArguments(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
