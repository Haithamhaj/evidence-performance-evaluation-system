/* eslint-disable no-unused-vars */
import { AppError } from "@evaluation/contracts";
import type { ValidatedAiResult } from "@evaluation/ai-routing";

import { COACHING_INSIGHT_ROUTE, CoachingInsightAiOutputSchema } from "./prompts.js";

export interface CoachingInsightRouter {
  run<TInput, TOutput>(
    input: import("@evaluation/ai-routing").AiRunRequest<TInput, TOutput>,
    persist: import("@evaluation/ai-routing").PersistValidatedOutput<TOutput>,
  ): Promise<ValidatedAiResult<TOutput>>;
}

/** The only AI entrypoint for coaching; callers retain manual creation when this route is unavailable. */
export class CoachingInsightAiService {
  constructor(
    private readonly router: CoachingInsightRouter,
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
    const result = await this.router.run(
      {
        routeKey: COACHING_INSIGHT_ROUTE,
        ...(input.projectId ? { projectId: input.projectId } : {}),
        ...(input.departmentId ? { departmentId: input.departmentId } : {}),
        systemId: input.systemId,
        input: {
          schemaVersion: "coaching-insight.v1",
          period: input.period,
          facts: input.facts.map(({ sourceId, kind, text }) => ({ sourceId, kind, text })),
        },
        inputReference: `coaching-employee:${input.employeeId}`,
        inputSchemaVersion: "coaching-insight.v1",
        outputSchemaVersion: "coaching-insight.v1",
        promptTemplateVersion: "coaching-insight.v1",
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
      !/cannot infer performance rating/iu.test(output.cannotConclude)
    )
      throw unavailable("COACHING_AI_OUTPUT_UNSAFE", 409);
    return {
      ...output,
      aiRunId: result.runId,
      requiresHumanApproval: result.requiresHumanApproval,
    };
  }
}
function unavailable(code: string, status: number) {
  return new AppError(code, "errors.coaching.aiUnavailable", status);
}
