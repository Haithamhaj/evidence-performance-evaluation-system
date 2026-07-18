import path from "node:path";
import { fileURLToPath } from "node:url";

import { databaseAuditWriter } from "@evaluation/audit";
import { AppError } from "@evaluation/contracts";
import { createDatabaseClient } from "@evaluation/database";
import { z } from "zod";

import { ANALYSIS_CRITERIA_ARTIFACTS } from "../apps/api/src/analysis-criteria/analysis-criteria-artifacts.js";
import { registerAuthorizedAiOutputSchema } from "../apps/api/src/ai-routing/ai-routing.module.js";

const ArgumentsSchema = z
  .object({
    dryRun: z.boolean(),
    actorId: z.string().uuid().optional(),
    correlationId: z.string().uuid().optional(),
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

export async function registerAnalysisCriteriaAiArtifacts(
  input: z.infer<typeof ArgumentsSchema> & { databaseUrl?: string },
): Promise<readonly Readonly<Record<string, unknown>>[]> {
  const parsed = ArgumentsSchema.parse(input);
  const plan = ANALYSIS_CRITERIA_ARTIFACTS.map((artifact) => ({
    routeKey: artifact.routeKey,
    schema: {
      version: artifact.outputSchemaVersion,
      sha256: artifact.outputSchemaDescriptor.schemaHash,
    },
    prompt: {
      version: artifact.prompt.version,
      sha256: artifact.prompt.sha256,
    },
  }));
  if (parsed.dryRun) return plan;
  if (
    parsed.actorId === undefined ||
    parsed.correlationId === undefined ||
    parsed.reason === undefined
  ) {
    throw new AppError(
      "AI_ARTIFACT_REGISTRATION_CONTEXT_REQUIRED",
      "errors.ai.artifactRegistrationContextRequired",
      400,
    );
  }
  const databaseUrl = input.databaseUrl ?? process.env.DATABASE_URL?.trim();
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error("DATABASE_URL is required");
  }
  const database = createDatabaseClient(databaseUrl);
  try {
    const principal = { userId: parsed.actorId, active: true } as const;
    for (const artifact of ANALYSIS_CRITERIA_ARTIFACTS) {
      const schema = await registerAuthorizedAiOutputSchema(database, principal, {
        routeKey: artifact.routeKey,
        version: artifact.outputSchemaVersion,
        schema: artifact.outputSchema,
        reason: parsed.reason,
        expectedBehavior: artifact.prompt.expectedBehavior,
        // Task 7B materializes this exact deterministic fixture/test reference before closure.
        evaluationEvidenceReferences: ["ai-eval:analysis-criteria-v2"],
        correlationId: parsed.correlationId,
      });
      await database.$transaction(async (transaction) => {
        const administrator = await transaction.user.findUnique({
          where: { id: parsed.actorId },
          select: { id: true, active: true },
        });
        const assignment = await transaction.roleAssignment.findFirst({
          where: { userId: parsed.actorId, role: "system_administrator" },
          select: { scopeId: true },
        });
        if (administrator?.active !== true || assignment === null) {
          throw new AppError("AUTHZ_ROLE_REQUIRED", "errors.authorization.denied", 403);
        }
        const existing = await transaction.analysisPromptArtifact.findUnique({
          where: {
            routeKey_version: {
              routeKey: artifact.routeKey,
              version: artifact.prompt.version,
            },
          },
        });
        if (
          existing !== null &&
          (existing.bodyHash !== artifact.prompt.sha256 ||
            existing.trustedBody !== artifact.prompt.trustedBody)
        ) {
          throw new AppError("AI_PROMPT_VERSION_CONFLICT", "errors.ai.promptVersionConflict", 409);
        }
        const prompt =
          existing ??
          (await transaction.analysisPromptArtifact.create({
            data: {
              routeKey: artifact.routeKey,
              version: artifact.prompt.version,
              bodyHash: artifact.prompt.sha256,
              trustedBody: artifact.prompt.trustedBody,
              expectedBehavior: artifact.prompt.expectedBehavior,
              registeredById: parsed.actorId,
              registrationReason: parsed.reason,
            },
          }));
        await databaseAuditWriter.append(transaction, {
          eventType: "ai.prompt.registered",
          actor: { kind: "human", id: parsed.actorId },
          effectiveSubjectId: parsed.actorId,
          scopeType: "system",
          scopeId: assignment.scopeId,
          targetType: "analysis_prompt_artifact",
          targetId: prompt.id,
          reason: parsed.reason,
          safeDiff: {
            routeKey: artifact.routeKey,
            promptVersion: artifact.prompt.version,
            promptHash: artifact.prompt.sha256,
            schemaArtifactId: schema.id,
            schemaHash: schema.schemaHash,
            reusedExistingArtifact: existing !== null,
          },
          correlationId: parsed.correlationId,
          source: "api",
        });
      });
    }
    return plan;
  } finally {
    await database.$disconnect();
  }
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
    else if (argument === "--reason") values.reason = next;
    else throw new Error(`Unknown argument ${argument}`);
    index += 1;
  }
  return ArgumentsSchema.parse(values);
}

async function main(): Promise<void> {
  const result = await registerAnalysisCriteriaAiArtifacts(parseArguments(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  await main();
}
