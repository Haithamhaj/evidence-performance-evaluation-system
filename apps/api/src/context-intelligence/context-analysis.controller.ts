import { AppError } from "@evaluation/contracts";
import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { ContextIntelligencePolicyGuard } from "./context-intelligence-policy.guard.js";

export const CONTEXT_INTELLIGENCE_WORKFLOW = Symbol("CONTEXT_INTELLIGENCE_WORKFLOW");

type Actor = Readonly<{ userId: string; active: boolean }>;
type Request = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId: string;
}>;

export interface ContextIntelligenceWorkflow {
  analyze(input: Readonly<{ actor: Actor; sourceItemId: string; correlationId: string }>): unknown;
  reviewQueue(input: Readonly<{ actor: Actor }>): unknown;
  confirmProjectSuggestion(
    input: Readonly<{
      actor: Actor;
      suggestionId: string;
      expectedRevision: number;
      reason: string;
      correlationId: string;
    }>,
  ): unknown;
  correctProjectSuggestion(
    input: Readonly<{
      actor: Actor;
      suggestionId: string;
      expectedRevision: number;
      projectId: string | null;
      reason: string;
      correlationId: string;
    }>,
  ): unknown;
  prepareTaskDraft(
    input: Readonly<{ actor: Actor; sourceItemId: string; correlationId: string }>,
  ): unknown;
  confirmTaskDraft(input: unknown): unknown;
}

const EmptyBodySchema = z.object({}).strict();
const SuggestionConfirmationSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict();
const SuggestionCorrectionSchema = SuggestionConfirmationSchema.extend({
  projectId: z.string().uuid().nullable(),
}).strict();

export class ContextAnalysisController {
  private readonly workflow: ContextIntelligenceWorkflow;

  constructor(workflow: ContextIntelligenceWorkflow) {
    this.workflow = workflow;
  }

  analyze(request: Request, sourceItemId: string, body: unknown) {
    parse(EmptyBodySchema, body);
    return this.workflow.analyze({
      actor: actor(request),
      sourceItemId: parseUuid(sourceItemId),
      correlationId: request.correlationId,
    });
  }

  reviewQueue(request: Request) {
    return this.workflow.reviewQueue({ actor: actor(request) });
  }

  confirmProjectSuggestion(request: Request, suggestionId: string, body: unknown) {
    const input = parse(SuggestionConfirmationSchema, body);
    return this.workflow.confirmProjectSuggestion({
      actor: actor(request),
      suggestionId: parseUuid(suggestionId),
      expectedRevision: input.expectedRevision,
      reason: input.reason,
      correlationId: request.correlationId,
    });
  }

  correctProjectSuggestion(request: Request, suggestionId: string, body: unknown) {
    const input = parse(SuggestionCorrectionSchema, body);
    return this.workflow.correctProjectSuggestion({
      actor: actor(request),
      suggestionId: parseUuid(suggestionId),
      expectedRevision: input.expectedRevision,
      projectId: input.projectId,
      reason: input.reason,
      correlationId: request.correlationId,
    });
  }
}

Controller("api/v1/context")(ContextAnalysisController);
UseGuards(ContextIntelligencePolicyGuard)(ContextAnalysisController);
Inject(CONTEXT_INTELLIGENCE_WORKFLOW)(ContextAnalysisController, undefined, 0);

const analyze = Object.getOwnPropertyDescriptor(ContextAnalysisController.prototype, "analyze")!;
Req()(ContextAnalysisController.prototype, "analyze", 0);
Param("id")(ContextAnalysisController.prototype, "analyze", 1);
Body()(ContextAnalysisController.prototype, "analyze", 2);
Post("items/:id/analyze")(ContextAnalysisController.prototype, "analyze", analyze);

const reviewQueue = Object.getOwnPropertyDescriptor(
  ContextAnalysisController.prototype,
  "reviewQueue",
)!;
Req()(ContextAnalysisController.prototype, "reviewQueue", 0);
Get("review-queue")(ContextAnalysisController.prototype, "reviewQueue", reviewQueue);

const confirmProjectSuggestion = Object.getOwnPropertyDescriptor(
  ContextAnalysisController.prototype,
  "confirmProjectSuggestion",
)!;
Req()(ContextAnalysisController.prototype, "confirmProjectSuggestion", 0);
Param("id")(ContextAnalysisController.prototype, "confirmProjectSuggestion", 1);
Body()(ContextAnalysisController.prototype, "confirmProjectSuggestion", 2);
Post("project-suggestions/:id/confirm")(
  ContextAnalysisController.prototype,
  "confirmProjectSuggestion",
  confirmProjectSuggestion,
);

const correctProjectSuggestion = Object.getOwnPropertyDescriptor(
  ContextAnalysisController.prototype,
  "correctProjectSuggestion",
)!;
Req()(ContextAnalysisController.prototype, "correctProjectSuggestion", 0);
Param("id")(ContextAnalysisController.prototype, "correctProjectSuggestion", 1);
Body()(ContextAnalysisController.prototype, "correctProjectSuggestion", 2);
Post("project-suggestions/:id/correct")(
  ContextAnalysisController.prototype,
  "correctProjectSuggestion",
  correctProjectSuggestion,
);

function actor(request: Request): Actor {
  return { userId: request.principal.userId, active: request.principal.active };
}

export function parseUuid(value: unknown): string {
  return parse(z.string().uuid(), value);
}

export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(
      "CONTEXT_INTELLIGENCE_INPUT_INVALID",
      "errors.contextIntelligence.inputInvalid",
      400,
    );
  }
  return result.data;
}
