import {
  AppError,
  ConcludeExperimentInputSchema,
  RecordExperimentRunInputSchema,
  ReviseExperimentMethodInputSchema,
  TransitionExperimentInputSchema,
} from "@evaluation/contracts";
import { ExperimentQueryService, ExperimentService } from "@evaluation/research-experiments";
import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { ResearchExperimentsPolicyGuard } from "./research-experiments-policy.guard.js";

type Request = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId: string;
}>;

const InterpretationInputSchema = z.object({ runId: z.string().uuid() }).strict();
const ConclusionEnvelopeSchema = z
  .object({ input: ConcludeExperimentInputSchema, aiRunId: z.string().uuid().optional() })
  .strict();

export class ExperimentsController {
  private readonly experiments: ExperimentService;
  private readonly query: ExperimentQueryService;

  constructor(experiments: ExperimentService, query: ExperimentQueryService) {
    this.experiments = experiments;
    this.query = query;
  }

  async get(request: Request, experimentId: string) {
    return this.query.read({ actor: actor(request), experimentId: parseUuid(experimentId) });
  }

  async reviseMethod(request: Request, experimentId: string, body: unknown) {
    return this.experiments.reviseMethod({
      ...command(request, experimentId),
      input: parseInput(ReviseExperimentMethodInputSchema, body),
    });
  }

  async reviewMethod(request: Request, experimentId: string) {
    return this.experiments.reviewMethod(command(request, experimentId));
  }

  async transition(request: Request, experimentId: string, body: unknown) {
    return this.experiments.transition({
      ...command(request, experimentId),
      input: parseInput(TransitionExperimentInputSchema, body),
    });
  }

  async recordRun(request: Request, experimentId: string, body: unknown) {
    return this.experiments.recordRun({
      ...command(request, experimentId),
      input: parseInput(RecordExperimentRunInputSchema, body),
    });
  }

  async interpret(request: Request, experimentId: string, body: unknown) {
    const input = parseInput(InterpretationInputSchema, body);
    return this.experiments.interpretRun({ ...command(request, experimentId), runId: input.runId });
  }

  async conclude(request: Request, experimentId: string, body: unknown) {
    const envelope = parseInput(ConclusionEnvelopeSchema, body);
    return this.experiments.conclude({
      ...command(request, experimentId),
      input: envelope.input,
      ...(envelope.aiRunId === undefined ? {} : { aiRunId: envelope.aiRunId }),
    });
  }
}

Controller("api/v1/experiments")(ExperimentsController);
UseGuards(ResearchExperimentsPolicyGuard)(ExperimentsController);
Inject(ExperimentService)(ExperimentsController, undefined, 0);
Inject(ExperimentQueryService)(ExperimentsController, undefined, 1);

decorate("get", Get(":id"), [Req(), Param("id")]);
decorate("reviseMethod", Post(":id/method-revisions"), [Req(), Param("id"), Body()]);
decorate("reviewMethod", Post(":id/method-reviews"), [Req(), Param("id")]);
decorate("transition", Post(":id/transitions"), [Req(), Param("id"), Body()]);
decorate("recordRun", Post(":id/runs"), [Req(), Param("id"), Body()]);
decorate("interpret", Post(":id/interpretations"), [Req(), Param("id"), Body()]);
decorate("conclude", Post(":id/conclusions"), [Req(), Param("id"), Body()]);

function command(request: Request, experimentId: string) {
  return {
    actor: actor(request),
    correlationId: request.correlationId,
    experimentId: parseUuid(experimentId),
  };
}

function actor(request: Request) {
  return { userId: request.principal.userId, active: request.principal.active };
}

function parseUuid(value: unknown): string {
  return parseInput(z.string().uuid(), value);
}

function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AppError("RESEARCH_INPUT_INVALID", "errors.research.inputInvalid", 400);
  }
  return parsed.data;
}

function decorate(
  methodName: keyof ExperimentsController,
  methodDecorator: MethodDecorator,
  parameters: readonly ParameterDecorator[],
) {
  const descriptor = Object.getOwnPropertyDescriptor(ExperimentsController.prototype, methodName)!;
  parameters.forEach((parameter, index) =>
    parameter(ExperimentsController.prototype, methodName, index),
  );
  methodDecorator(ExperimentsController.prototype, methodName, descriptor);
}
