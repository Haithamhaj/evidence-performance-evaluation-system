import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { outputSchemaDescriptor } from "@evaluation/ai-routing";
import { databaseAuditWriter } from "@evaluation/audit";
import { AppError } from "@evaluation/contracts";
import { createDatabaseClient } from "@evaluation/database";
import {
  PROJECT_PROGRESS_CONTRACT_OUTPUT_SCHEMA_V1,
  PROJECT_PROGRESS_CONTRACT_OUTPUT_SCHEMA_VERSION,
  PROJECT_PROGRESS_CONTRACT_PROMPT_V1,
  PROJECT_PROGRESS_CONTRACT_PROMPT_VERSION,
  PROJECT_PROGRESS_CONTRACT_ROUTE_KEY,
} from "../packages/projects/src/progress-contract-draft-artifacts.js";
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

const modelKey = "gpt-5.5-2026-04-23";
const providerEndpoint = "https://api.openai.com/v1";
const promptHash = createHash("sha256").update(PROJECT_PROGRESS_CONTRACT_PROMPT_V1).digest("hex");
const schema = outputSchemaDescriptor(
  PROJECT_PROGRESS_CONTRACT_ROUTE_KEY,
  PROJECT_PROGRESS_CONTRACT_OUTPUT_SCHEMA_VERSION,
  PROJECT_PROGRESS_CONTRACT_OUTPUT_SCHEMA_V1,
);

export async function registerProgressContractDraftAiRoute(
  input: z.infer<typeof ArgumentsSchema> & { databaseUrl?: string },
) {
  const parsed = ArgumentsSchema.parse(input);
  const plan = {
    routeKey: PROJECT_PROGRESS_CONTRACT_ROUTE_KEY,
    modelKey,
    providerEndpoint,
    promptVersion: PROJECT_PROGRESS_CONTRACT_PROMPT_VERSION,
    promptHash,
    outputSchemaVersion: PROJECT_PROGRESS_CONTRACT_OUTPUT_SCHEMA_VERSION,
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
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error("DATABASE_URL is required");
  }

  const database = createDatabaseClient(databaseUrl);
  const registrationContext = {
    ...parsed,
    actorId: parsed.actorId,
    correlationId: parsed.correlationId,
    systemScopeId: parsed.systemScopeId,
    reason: parsed.reason,
  };
  const principal = { userId: registrationContext.actorId, active: true } as const;
  try {
    const outputArtifact = await registerAuthorizedAiOutputSchema(database, principal, {
      routeKey: PROJECT_PROGRESS_CONTRACT_ROUTE_KEY,
      version: PROJECT_PROGRESS_CONTRACT_OUTPUT_SCHEMA_VERSION,
      schema: PROJECT_PROGRESS_CONTRACT_OUTPUT_SCHEMA_V1,
      reason: registrationContext.reason,
      expectedBehavior:
        "Produces a source-cited, document-derived Project Progress Contract proposal only; it never contains a rating, rank, productivity, raw-activity inference, or direct overall progress.",
      evaluationEvidenceReferences: [`ai-eval:${schema.schemaHash}`],
      correlationId: registrationContext.correlationId,
    });
    const prompt = await registerPrompt(database, registrationContext, outputArtifact.id);
    const existingProvider = await database.aiProviderConfig.findFirst({
      where: {
        providerKey: "openai",
        adapterKey: "openai-compatible",
        modelKey,
        locality: "external",
        endpoint: providerEndpoint,
      },
      orderBy: { version: "desc" },
    });
    const provider =
      existingProvider ??
      (await registerAuthorizedAiProviderConfig(database, principal, {
        providerKey: "openai",
        adapterKey: "openai-compatible",
        modelKey,
        locality: "external",
        endpoint: providerEndpoint,
        reason: registrationContext.reason,
        correlationId: registrationContext.correlationId,
      }));
    const existingRoute = await database.aiRoute.findUnique({
      where: {
        routeKey_level_scopeId: {
          routeKey: PROJECT_PROGRESS_CONTRACT_ROUTE_KEY,
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
          routeKey: PROJECT_PROGRESS_CONTRACT_ROUTE_KEY,
          level: "system",
          scopeId: registrationContext.systemScopeId,
          reason: registrationContext.reason,
          correlationId: registrationContext.correlationId,
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
      where: {
        routeKey_version: {
          routeKey: PROJECT_PROGRESS_CONTRACT_ROUTE_KEY,
          version: PROJECT_PROGRESS_CONTRACT_PROMPT_VERSION,
        },
      },
    });
    if (
      existing !== null &&
      (existing.bodyHash !== promptHash ||
        existing.trustedBody !== PROJECT_PROGRESS_CONTRACT_PROMPT_V1)
    ) {
      throw new AppError("AI_PROMPT_VERSION_CONFLICT", "errors.ai.promptVersionConflict", 409);
    }
    if (existing !== null) return existing;
    const prompt = await transaction.analysisPromptArtifact.create({
      data: {
        routeKey: PROJECT_PROGRESS_CONTRACT_ROUTE_KEY,
        version: PROJECT_PROGRESS_CONTRACT_PROMPT_VERSION,
        bodyHash: promptHash,
        trustedBody: PROJECT_PROGRESS_CONTRACT_PROMPT_V1,
        expectedBehavior:
          "A source-cited, document-derived Project Progress Contract proposal for mandatory human review.",
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
        routeKey: PROJECT_PROGRESS_CONTRACT_ROUTE_KEY,
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
  const result = await registerProgressContractDraftAiRoute(parseArguments(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
