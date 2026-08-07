/* eslint-disable no-unused-vars */
import { createHash } from "node:crypto";

import { AppError } from "@evaluation/contracts";
import type { ValidatedAiResult } from "@evaluation/ai-routing";

import {
  buildCoachingInsightRequest,
  COACHING_INSIGHT_PROMPT_VERSION,
  COACHING_INSIGHT_ROUTE,
  COACHING_INSIGHT_TRUSTED_PROMPT,
  CoachingInsightAiOutputSchema,
} from "./prompts.js";

export interface CoachingInsightRouter {
  run<TInput, TOutput>(
    input: import("@evaluation/ai-routing").AiRunRequest<TInput, TOutput>,
    persist: import("@evaluation/ai-routing").PersistValidatedOutput<TOutput>,
  ): Promise<ValidatedAiResult<TOutput>>;
}
export interface CoachingPromptArtifactReader {
  read(
    routeKey: string,
    version: string,
  ): Promise<Readonly<{
    id: string;
    routeKey: string;
    version: string;
    bodyHash: string;
    trustedBody: string;
  }> | null>;
}

/** The only AI entrypoint for coaching; callers retain manual creation when this route is unavailable. */
export class CoachingInsightAiService {
  constructor(
    private readonly router: CoachingInsightRouter,
    private readonly prompts: CoachingPromptArtifactReader,
    private readonly timeoutMs = 30_000,
  ) {}
  async draft(
    input: Readonly<{
      employeeId: string;
      projectId?: string;
      departmentId?: string;
      systemId: string;
      period: { startsAt: string; endsAt: string };
      facts: readonly { sourceId: string; kind: string; text: string }[];
    }>,
  ) {
    if (input.facts.length === 0) throw unavailable("COACHING_SOURCE_UNQUALIFIED", 409);
    const sourceIds = input.facts.map(({ sourceId }) => sourceId);
    const prompt = await this.prompts.read(COACHING_INSIGHT_ROUTE, COACHING_INSIGHT_PROMPT_VERSION);
    const expectedPromptHash = createHash("sha256")
      .update(COACHING_INSIGHT_TRUSTED_PROMPT)
      .digest("hex");
    if (
      prompt === null ||
      prompt.routeKey !== COACHING_INSIGHT_ROUTE ||
      prompt.version !== COACHING_INSIGHT_PROMPT_VERSION ||
      prompt.bodyHash !== expectedPromptHash ||
      createHash("sha256").update(prompt.trustedBody).digest("hex") !== expectedPromptHash
    )
      throw unavailable("COACHING_AI_PROMPT_ARTIFACT_MISMATCH", 500);
    const governed = buildCoachingInsightRequest({
      prompt: { artifactId: prompt.id, sha256: prompt.bodyHash },
      period: input.period,
      facts: input.facts,
    });
    const result = await this.router.run(
      {
        routeKey: governed.routeKey,
        ...(input.projectId ? { projectId: input.projectId } : {}),
        ...(input.departmentId ? { departmentId: input.departmentId } : {}),
        systemId: input.systemId,
        input: governed.input,
        inputReference: `coaching-employee:${input.employeeId}`,
        inputSchemaVersion: governed.inputSchemaVersion,
        outputSchemaVersion: governed.outputSchemaVersion,
        promptTemplateVersion: governed.promptTemplateVersion,
        outputSchema: CoachingInsightAiOutputSchema,
        sourceReferences: sourceIds.map((id) => `coaching-fact:${id}`),
        classification: "confidential",
        timeoutMs: this.timeoutMs,
        requiresHumanApproval: true,
        correlationId: crypto.randomUUID(),
      },
      async () => ({ outputReference: `coaching-employee:${input.employeeId}` }),
    );
    const output = CoachingInsightAiOutputSchema.parse(result.output);
    if (output.sourceIds.some((id) => !sourceIds.includes(id)))
      throw unavailable("COACHING_AI_SOURCE_NOT_AUTHORIZED", 403);
    if (
      !output.limitations.some((item) => /cannot infer performance rating/iu.test(item)) ||
      !/cannot infer performance rating/iu.test(output.cannotConclude) ||
      containsBlankSemantics(output) ||
      containsProhibitedSemantics(output)
    )
      throw unavailable("COACHING_AI_OUTPUT_UNSAFE", 409);
    return {
      ...output,
      confidence: input.facts.length === 1 ? ("LIMITED" as const) : output.confidence,
      confidenceBasis:
        input.facts.length === 1
          ? "Only one qualifying source supports this draft; employee review is required."
          : output.confidenceBasis,
      aiRunId: result.runId,
      requiresHumanApproval: result.requiresHumanApproval,
    };
  }
}
function containsBlankSemantics(output: import("zod").infer<typeof CoachingInsightAiOutputSchema>) {
  const required = [
    output.pattern,
    output.confidenceBasis,
    output.cannotConclude,
    ...output.limitations,
    ...output.conflicts,
    ...(output.actionDraft
      ? [output.actionDraft.title, output.actionDraft.objective, output.actionDraft.activity]
      : []),
  ];
  return required.some((value) => value.trim().length === 0);
}
function containsProhibitedSemantics(
  output: import("zod").infer<typeof CoachingInsightAiOutputSchema>,
) {
  const disclaimer = /cannot infer performance rating/giu;
  const content = JSON.stringify(output).replace(disclaimer, "");
  return /\b(?:rating|rank(?:ing|ed)?|score|promotion|promote|discipline|disciplinary)\b|\bleave\b.{0,40}\bpenalt|\bpenalt.{0,40}\bleave\b|\bevidence\b.{0,40}\bquota\b|\bquota\b.{0,40}\bevidence\b|تقييم\s+الأداء|ترتيب|درجة|ترقية|تأديب|عقوبة.{0,30}إجازة|حصة.{0,30}الأدلة/iu.test(
    content,
  );
}
function unavailable(code: string, status: number) {
  return new AppError(code, "errors.coaching.aiUnavailable", status);
}
