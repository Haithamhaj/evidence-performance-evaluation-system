import {
  AppError,
  ConfirmResearchSourceDispositionInputSchema,
  CreateResearchSourceReviewInputSchema,
} from "@evaluation/contracts";
import { ResearchSourceReviewService } from "@evaluation/research-experiments";
import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { ResearchExperimentsPolicyGuard } from "./research-experiments-policy.guard.js";

type Request = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId: string;
}>;

const ReanalyzeInputSchema = z.object({ expectedVersion: z.number().int().positive() }).strict();

export class SourceReviewsController {
  private readonly reviews: ResearchSourceReviewService;

  constructor(reviews: ResearchSourceReviewService) {
    this.reviews = reviews;
  }

  async create(request: Request, body: unknown) {
    const input = parseInput(CreateResearchSourceReviewInputSchema, body);
    return this.reviews.start({
      actor: actor(request),
      correlationId: request.correlationId,
      ...input,
    });
  }

  async get(request: Request, reviewId: string) {
    return this.reviews.getPrivate({ actor: actor(request), reviewId: parseUuid(reviewId) });
  }

  async reanalyze(request: Request, reviewId: string, body: unknown) {
    const input = parseInput(ReanalyzeInputSchema, body);
    return this.reviews.reanalyze({
      actor: actor(request),
      reviewId: parseUuid(reviewId),
      expectedVersion: input.expectedVersion,
      correlationId: request.correlationId,
    });
  }

  async disposition(request: Request, reviewId: string, body: unknown) {
    const input = parseInput(ConfirmResearchSourceDispositionInputSchema, body);
    return this.reviews.confirmDisposition({
      actor: actor(request),
      reviewId: parseUuid(reviewId),
      correlationId: request.correlationId,
      input,
    });
  }
}

Controller("api/v1/research/source-reviews")(SourceReviewsController);
UseGuards(ResearchExperimentsPolicyGuard)(SourceReviewsController);
Inject(ResearchSourceReviewService)(SourceReviewsController, undefined, 0);

decorate("create", Post(), [Req(), Body()]);
decorate("get", Get(":id"), [Req(), Param("id")]);
decorate("reanalyze", Post(":id/reanalyze"), [Req(), Param("id"), Body()]);
decorate("disposition", Post(":id/disposition"), [Req(), Param("id"), Body()]);

function actor(request: Request) {
  return { userId: request.principal.userId, active: request.principal.active };
}

function parseUuid(value: unknown): string {
  return parseInput(z.string().uuid(), value);
}

function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw invalidInput();
  return parsed.data;
}

function invalidInput() {
  return new AppError("RESEARCH_INPUT_INVALID", "errors.research.inputInvalid", 400);
}

function decorate(
  methodName: keyof SourceReviewsController,
  methodDecorator: MethodDecorator,
  parameters: readonly ParameterDecorator[],
) {
  const descriptor = Object.getOwnPropertyDescriptor(
    SourceReviewsController.prototype,
    methodName,
  )!;
  parameters.forEach((parameter, index) =>
    parameter(SourceReviewsController.prototype, methodName, index),
  );
  methodDecorator(SourceReviewsController.prototype, methodName, descriptor);
}
