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
import { CONTEXT_INTELLIGENCE_AI_ROUTES } from "../packages/context-intelligence/src/index.js";
import {
  EXPERIENCE_PREPARE_INPUT_SCHEMA_VERSION,
  EXPERIENCE_PREPARE_OUTPUT_SCHEMA_VERSION,
  EXPERIENCE_PREPARE_PROMPT_VERSION,
  EXPERIENCE_PREPARE_ROUTE,
  EXPERIENCE_PREPARE_TRUSTED_PROMPT,
  ExperiencePreparedAiOutputSchema,
} from "../apps/api/src/experience-orchestration/experience-orchestrator.service.js";
import {
  CAPTURE_UNDERSTANDING_INPUT_SCHEMA_VERSION,
  CAPTURE_UNDERSTANDING_OUTPUT_SCHEMA_VERSION,
  CAPTURE_UNDERSTANDING_PROMPT_VERSION,
  CAPTURE_UNDERSTANDING_ROUTE,
  CAPTURE_UNDERSTANDING_TRUSTED_PROMPT,
  CaptureUnderstandingAiOutputSchema,
} from "../apps/api/src/experience-orchestration/capture-understanding.service.js";
import {
  TASK_ASSISTANT_INPUT_SCHEMA_VERSION,
  TASK_ASSISTANT_OUTPUT_SCHEMA_VERSION,
  TASK_ASSISTANT_PROMPT_VERSION,
  TASK_ASSISTANT_ROUTE,
  TASK_ASSISTANT_TRUSTED_PROMPT,
  TaskAssistantAiOutputSchema,
} from "../apps/api/src/experience-orchestration/task-assistant.service.js";
import {
  PROJECT_ASSISTANT_INPUT_SCHEMA_VERSION,
  PROJECT_ASSISTANT_OUTPUT_SCHEMA_VERSION,
  PROJECT_ASSISTANT_PROMPT_VERSION,
  PROJECT_ASSISTANT_ROUTE,
  PROJECT_ASSISTANT_TRUSTED_PROMPT,
  ProjectAssistantAiOutputSchema,
} from "../apps/api/src/experience-orchestration/project-assistant.service.js";

const ArgumentsSchema = z
  .object({
    dryRun: z.boolean(),
    routeKey: z.string().trim().min(1).max(200).optional(),
    actorId: z.string().uuid().optional(),
    correlationId: z.string().uuid().optional(),
    systemScopeId: z.string().uuid().optional(),
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

const governedRoutes = [
  ...CONTEXT_INTELLIGENCE_AI_ROUTES,
  {
    routeKey: EXPERIENCE_PREPARE_ROUTE,
    inputSchemaVersion: EXPERIENCE_PREPARE_INPUT_SCHEMA_VERSION,
    outputSchemaVersion: EXPERIENCE_PREPARE_OUTPUT_SCHEMA_VERSION,
    promptTemplateVersion: EXPERIENCE_PREPARE_PROMPT_VERSION,
    trustedPrompt: EXPERIENCE_PREPARE_TRUSTED_PROMPT,
    outputSchema: ExperiencePreparedAiOutputSchema,
  },
  {
    routeKey: CAPTURE_UNDERSTANDING_ROUTE,
    inputSchemaVersion: CAPTURE_UNDERSTANDING_INPUT_SCHEMA_VERSION,
    outputSchemaVersion: CAPTURE_UNDERSTANDING_OUTPUT_SCHEMA_VERSION,
    promptTemplateVersion: CAPTURE_UNDERSTANDING_PROMPT_VERSION,
    trustedPrompt: CAPTURE_UNDERSTANDING_TRUSTED_PROMPT,
    outputSchema: CaptureUnderstandingAiOutputSchema,
  },
  {
    routeKey: TASK_ASSISTANT_ROUTE,
    inputSchemaVersion: TASK_ASSISTANT_INPUT_SCHEMA_VERSION,
    outputSchemaVersion: TASK_ASSISTANT_OUTPUT_SCHEMA_VERSION,
    promptTemplateVersion: TASK_ASSISTANT_PROMPT_VERSION,
    trustedPrompt: TASK_ASSISTANT_TRUSTED_PROMPT,
    outputSchema: TaskAssistantAiOutputSchema,
  },
  {
    routeKey: PROJECT_ASSISTANT_ROUTE,
    inputSchemaVersion: PROJECT_ASSISTANT_INPUT_SCHEMA_VERSION,
    outputSchemaVersion: PROJECT_ASSISTANT_OUTPUT_SCHEMA_VERSION,
    promptTemplateVersion: PROJECT_ASSISTANT_PROMPT_VERSION,
    trustedPrompt: PROJECT_ASSISTANT_TRUSTED_PROMPT,
    outputSchema: ProjectAssistantAiOutputSchema,
  },
] as const;

const routeMetadata = governedRoutes.map((route) => ({
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

export async function registerContextIntelligenceAiRoutes(
  input: z.input<typeof ArgumentsSchema> & { databaseUrl?: string },
) {
  const parsed = ArgumentsSchema.parse({
    dryRun: input.dryRun,
    routeKey: input.routeKey,
    actorId: input.actorId,
    correlationId: input.correlationId,
    systemScopeId: input.systemScopeId,
    reason: input.reason,
  });
  const selectedRouteMetadata =
    parsed.routeKey === undefined
      ? routeMetadata
      : routeMetadata.filter(({ routeKey }) => routeKey === parsed.routeKey);
  if (selectedRouteMetadata.length === 0) {
    throw new AppError("AI_ROUTE_NOT_GOVERNED", "errors.ai.routeNotGoverned", 400);
  }
  const selectedPlan = plan.filter(
    ({ routeKey }) => parsed.routeKey === undefined || routeKey === parsed.routeKey,
  );
  if (parsed.dryRun) return { routes: selectedPlan };
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
    for (const route of selectedRouteMetadata) {
      const existingOutputArtifact = await database.aiOutputSchemaArtifact.findUnique({
        where: {
          routeKey_version: {
            routeKey: route.routeKey,
            version: route.outputSchemaVersion,
          },
        },
        select: {
          reason: true,
          expectedBehavior: true,
          evaluationEvidenceReferences: true,
        },
      });
      const outputArtifact = await registerAuthorizedAiOutputSchema(database, principal, {
        routeKey: route.routeKey,
        version: route.outputSchemaVersion,
        schema: route.outputSchema,
        // Output schemas are immutable artifacts. A prompt-only revision must reuse the
        // artifact's original governance metadata instead of pretending to register a
        // second version of the same schema.
        reason: existingOutputArtifact?.reason ?? context.reason,
        expectedBehavior:
          existingOutputArtifact?.expectedBehavior ?? expectedOutputBehavior(route.routeKey),
        evaluationEvidenceReferences: stringArray(
          existingOutputArtifact?.evaluationEvidenceReferences,
        ) ?? [`ai-eval:${route.schema.schemaHash}`],
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
        expectedBehavior: expectedPromptBehavior(route.routeKey),
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

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value
    : undefined;
}

function expectedOutputBehavior(routeKey: string): string {
  if (routeKey === PROJECT_ASSISTANT_ROUTE) {
    return "Returns one source-grounded Project explanation for an approved question; no command, rating, readiness, or progress authority.";
  }
  if (routeKey === TASK_ASSISTANT_ROUTE) {
    return "Returns one source-grounded Task answer and at most one allowed status-change preparation; no command, rating, readiness, or progress authority.";
  }
  if (routeKey === CAPTURE_UNDERSTANDING_ROUTE) {
    return "Returns one private, source-backed Capture interpretation with at most one clarification and no command, rating, readiness, or progress authority.";
  }
  if (routeKey === EXPERIENCE_PREPARE_ROUTE) {
    return "Returns one editable source-backed action or clarification draft with no command, rating, readiness, or progress authority.";
  }
  if (routeKey === "context.summarize.v1") {
    return "Returns a source-cited AI draft interpretation of supplied private work context, with explicit uncertainties and no performance judgment.";
  }
  if (routeKey === "context.project-match.v1") {
    return "Explains the authoritative deterministic Project-link decision from governed visible anchors and sources without changing that decision.";
  }
  return "Returns an employee-reviewable Task draft grounded in supplied sources and the authoritative deterministic Project-link decision.";
}

function expectedPromptBehavior(routeKey: string): string {
  if (routeKey === PROJECT_ASSISTANT_ROUTE) {
    return "One bounded answer from the authorized Project experience for what changed, why blocked, or missing Evidence; no action is executed.";
  }
  if (routeKey === TASK_ASSISTANT_ROUTE) {
    return "One bounded answer from an authorized Task, dependencies, Updates, and Evidence; human confirmation remains mandatory for any suggested action.";
  }
  if (routeKey === CAPTURE_UNDERSTANDING_ROUTE) {
    return "One bounded private Capture interpretation from authorized candidates; employee review and confirmation remain mandatory.";
  }
  if (routeKey === EXPERIENCE_PREPARE_ROUTE) {
    return "One bounded employee-reviewable draft selected from already-authorized sources; human action remains mandatory.";
  }
  if (routeKey === "context.summarize.v1") {
    return "A source-labelled AI draft interpretation with supported claims, uncertainty, and opaque provenance for human review.";
  }
  if (routeKey === "context.project-match.v1") {
    return "A source-cited explanation of an already-computed deterministic Project-link decision for human review.";
  }
  return "A source-cited, editable Task draft that remains pending employee review and confirmation.";
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
    if (argument === "--route-key") values.routeKey = next;
    else if (argument === "--actor-id") values.actorId = next;
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
  const result = await registerContextIntelligenceAiRoutes(parseArguments(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
