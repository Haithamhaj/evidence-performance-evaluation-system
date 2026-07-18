import { createHash } from "node:crypto";

import {
  OpaqueReferenceSchema,
  type AiRouter,
  type PersistValidatedOutput,
} from "@evaluation/ai-routing";
import { AppError, UpdateStructureAiOutputSchema } from "@evaluation/contracts";
import type { DatabaseTransaction } from "@evaluation/database";
import { z } from "zod";

import {
  UPDATE_STRUCTURE_INPUT_SCHEMA_VERSION,
  UPDATE_STRUCTURE_OUTPUT_SCHEMA_VERSION,
  UPDATE_STRUCTURE_PROMPT_VERSION,
  UPDATE_STRUCTURE_TRUSTED_PROMPT,
  buildUpdateStructureRequest,
} from "./prompts.js";

const GovernedInputSchema = z
  .object({
    projectId: z.string().uuid(),
    departmentId: z.string().uuid(),
    correlationId: z.string().uuid(),
    updateSourceId: z.string().uuid(),
    prompt: z
      .object({
        artifactId: z.string().uuid(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/u),
      })
      .strict(),
    rawText: z.string().trim().min(1).max(50_000),
    answers: z
      .array(
        z
          .object({
            question: z.string().trim().min(1).max(1_000),
            answer: z.string().trim().min(1).max(20_000),
          })
          .strict(),
      )
      .max(50),
    previousAcceptedState: z
      .object({
        acceptedEventId: z.string().uuid(),
        summary: z.string().trim().min(1).max(2_000),
        result: z.string().trim().min(1).max(4_000),
        sourceReferences: z.array(z.string().trim().min(3).max(500)).max(500),
      })
      .strict()
      .nullable(),
    activeContract: z
      .object({
        contractId: z.string().uuid(),
        contractVersion: z.number().int().positive(),
        componentReferences: z.array(OpaqueReferenceSchema).max(100),
      })
      .strict()
      .nullable(),
    sourceReferences: z.array(OpaqueReferenceSchema).min(1).max(50),
  })
  .strict();

type Router = Pick<AiRouter<DatabaseTransaction>, "run">;
type Persist = PersistValidatedOutput<
  import("@evaluation/contracts").UpdateStructureAiOutput,
  DatabaseTransaction
>;
type PromptArtifactReader = Pick<
  import("@evaluation/database").DatabaseClient,
  "analysisPromptArtifact"
>;
type UpdateStructurer = import("./update-service.js").UpdateStructurer;
type UpdateStructureRunInput = import("./update-service.js").UpdateStructureRunInput;

export async function runGovernedUpdateStructure(
  router: Router,
  options: Readonly<{ systemId: string; timeoutMs: number }>,
  input: unknown,
  persistValidatedOutput: Persist,
) {
  const parsed = GovernedInputSchema.parse(input);
  const governedInput = buildUpdateStructureRequest({
    prompt: parsed.prompt,
    rawText: parsed.rawText,
    answers: parsed.answers,
    previousAcceptedState: parsed.previousAcceptedState,
    activeContract: parsed.activeContract,
    sourceReferences: parsed.sourceReferences,
  });
  return router.run(
    {
      routeKey: "update.structure",
      projectId: parsed.projectId,
      departmentId: parsed.departmentId,
      systemId: options.systemId,
      input: {
        trustedInstruction: governedInput.trustedInstruction,
        untrustedContent: governedInput.untrustedContent,
      },
      inputReference: `update-source:${parsed.updateSourceId}`,
      inputSchemaVersion: UPDATE_STRUCTURE_INPUT_SCHEMA_VERSION,
      outputSchemaVersion: UPDATE_STRUCTURE_OUTPUT_SCHEMA_VERSION,
      promptTemplateVersion: UPDATE_STRUCTURE_PROMPT_VERSION,
      outputSchema: UpdateStructureAiOutputSchema,
      sourceReferences: parsed.sourceReferences,
      classification: "confidential",
      timeoutMs: options.timeoutMs,
      requiresHumanApproval: true,
      correlationId: parsed.correlationId,
    },
    persistValidatedOutput,
  );
}

export class AiRouterUpdateStructurer implements UpdateStructurer {
  private readonly router: Router;
  private readonly promptReader: PromptArtifactReader;
  private readonly options: Readonly<{ systemId: string; timeoutMs: number }>;

  constructor(
    router: Router,
    promptReader: PromptArtifactReader,
    options: Readonly<{ systemId: string; timeoutMs: number }>,
  ) {
    this.router = router;
    this.promptReader = promptReader;
    this.options = options;
  }

  async structure(
    input: UpdateStructureRunInput,
    persistValidatedOutput: Persist,
  ) {
    const prompt = await this.promptReader.analysisPromptArtifact.findUnique({
      where: {
        routeKey_version: {
          routeKey: "update.structure",
          version: UPDATE_STRUCTURE_PROMPT_VERSION,
        },
      },
      select: { id: true, bodyHash: true, trustedBody: true },
    });
    const expectedHash = createHash("sha256")
      .update(UPDATE_STRUCTURE_TRUSTED_PROMPT)
      .digest("hex");
    if (
      prompt === null ||
      prompt.bodyHash !== expectedHash ||
      prompt.trustedBody !== UPDATE_STRUCTURE_TRUSTED_PROMPT
    ) {
      throw new AppError("AI_PROMPT_ARTIFACT_MISMATCH", "errors.ai.promptArtifactMismatch", 500);
    }
    const result = await runGovernedUpdateStructure(
      this.router,
      this.options,
      {
        projectId: input.projectScopeId,
        departmentId: input.departmentScopeId,
        correlationId: input.correlationId,
        updateSourceId: input.updateSourceId,
        prompt: { artifactId: prompt.id, sha256: prompt.bodyHash },
        rawText: input.rawText,
        answers: input.answers,
        previousAcceptedState: input.previousAcceptedState,
        activeContract: input.activeContract,
        sourceReferences: input.sourceReferences,
      },
      persistValidatedOutput,
    );
    return result.output;
  }
}
