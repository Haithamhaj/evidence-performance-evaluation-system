import type { AiRouter, PersistValidatedOutput } from "@evaluation/ai-routing";
import { UpdateStructureAiOutputSchema } from "@evaluation/contracts";
import type { DatabaseTransaction } from "@evaluation/database";
import {
  UPDATE_STRUCTURE_OUTPUT_SCHEMA_VERSION,
  UPDATE_STRUCTURE_PROMPT_VERSION,
  UPDATE_STRUCTURE_INPUT_SCHEMA_VERSION,
  buildUpdateStructureRequest,
} from "@evaluation/updates-evidence";
import { z } from "zod";

const InputSchema = z
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
        componentReferences: z.array(z.string().trim().min(3).max(500)).max(100),
      })
      .strict()
      .nullable(),
    sourceReferences: z.array(z.string().trim().min(3).max(500)).min(1).max(500),
  })
  .strict();

type Router = Pick<AiRouter<DatabaseTransaction>, "run">;
type Persist = PersistValidatedOutput<
  import("@evaluation/contracts").UpdateStructureAiOutput,
  DatabaseTransaction
>;

export class UpdateStructuringProcessor {
  private readonly router: Router;
  private readonly options: Readonly<{ systemId: string; timeoutMs: number }>;

  constructor(router: Router, options: Readonly<{ systemId: string; timeoutMs: number }>) {
    this.router = router;
    this.options = options;
  }

  async process(input: unknown, persistValidatedOutput: Persist) {
    const parsed = InputSchema.parse(input);
    const governedInput = buildUpdateStructureRequest({
      prompt: parsed.prompt,
      rawText: parsed.rawText,
      answers: parsed.answers,
      previousAcceptedState: parsed.previousAcceptedState,
      activeContract: parsed.activeContract,
      sourceReferences: parsed.sourceReferences,
    });
    return this.router.run(
      {
        routeKey: "update.structure",
        projectId: parsed.projectId,
        departmentId: parsed.departmentId,
        systemId: this.options.systemId,
        input: governedInput,
        inputReference: `update-source:${parsed.updateSourceId}`,
        inputSchemaVersion: UPDATE_STRUCTURE_INPUT_SCHEMA_VERSION,
        outputSchemaVersion: UPDATE_STRUCTURE_OUTPUT_SCHEMA_VERSION,
        promptTemplateVersion: UPDATE_STRUCTURE_PROMPT_VERSION,
        outputSchema: UpdateStructureAiOutputSchema,
        sourceReferences: parsed.sourceReferences,
        classification: "confidential",
        timeoutMs: this.options.timeoutMs,
        requiresHumanApproval: true,
        correlationId: parsed.correlationId,
      },
      persistValidatedOutput,
    );
  }
}
