import {
  OpenManagerEvaluationCycleInputSchema,
  RecordManagerEvaluationEligibilityDecisionInputSchema,
} from "@evaluation/contracts";
import {
  ManagerEvaluationCycleService,
  ManagerEvaluationParticipantReader,
} from "@evaluation/manager-evaluation";
import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";

import { ManagerEvaluationPolicyGuard } from "./manager-evaluation-policy.guard.js";
import {
  parseManagerEvaluationInput,
  parseManagerEvaluationUuid,
} from "./manager-evaluation-input.js";

export class ManagerEvaluationCyclesController {
  private readonly cycles: ManagerEvaluationCycleService;
  private readonly participants: ManagerEvaluationParticipantReader;
  constructor(
    cycles: ManagerEvaluationCycleService,
    participants: ManagerEvaluationParticipantReader,
  ) {
    this.cycles = cycles;
    this.participants = participants;
  }

  open(
    request: import("./manager-evaluation-policy.guard.js").ManagerEvaluationRequest,
    body: unknown,
  ) {
    const actorId = request.principal!.userId;
    return this.cycles.open(
      parseManagerEvaluationInput(OpenManagerEvaluationCycleInputSchema, {
        ...object(body),
        actorId,
      }),
    );
  }

  eligibility(
    request: import("./manager-evaluation-policy.guard.js").ManagerEvaluationRequest,
    cycleId: string,
    evaluatorId: string,
    body: unknown,
  ) {
    const parsed = parseManagerEvaluationInput(
      RecordManagerEvaluationEligibilityDecisionInputSchema.omit({
        cycleId: true,
        evaluatorId: true,
        actorId: true,
      }),
      body,
    );
    return this.cycles.recordEligibilityDecision({
      ...parsed,
      cycleId: parseManagerEvaluationUuid(cycleId),
      evaluatorId: parseManagerEvaluationUuid(evaluatorId),
      actorId: request.principal!.userId,
    });
  }

  readParticipant(
    request: import("./manager-evaluation-policy.guard.js").ManagerEvaluationRequest,
    cycleId: string,
  ) {
    return this.participants.read({
      cycleId: parseManagerEvaluationUuid(cycleId),
      evaluatorId: request.principal!.userId,
    });
  }
}

Controller("api/v1/manager-evaluation/cycles")(ManagerEvaluationCyclesController);
UseGuards(ManagerEvaluationPolicyGuard)(ManagerEvaluationCyclesController);
Inject(ManagerEvaluationCycleService)(ManagerEvaluationCyclesController, undefined, 0);
Inject(ManagerEvaluationParticipantReader)(ManagerEvaluationCyclesController, undefined, 1);
decorate("open", Post(), [Req(), Body()]);
decorate("readParticipant", Get(":cycleId/participant-view"), [Req(), Param("cycleId")]);
decorate("eligibility", Post(":cycleId/eligibility/:evaluatorId"), [
  Req(),
  Param("cycleId"),
  Param("evaluatorId"),
  Body(),
]);

function object(value: unknown) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function decorate(
  method: keyof ManagerEvaluationCyclesController,
  route: MethodDecorator,
  parameters: readonly ParameterDecorator[],
) {
  const descriptor = Object.getOwnPropertyDescriptor(
    ManagerEvaluationCyclesController.prototype,
    method,
  )!;
  parameters.forEach((parameter, index) =>
    parameter(ManagerEvaluationCyclesController.prototype, method, index),
  );
  route(ManagerEvaluationCyclesController.prototype, method, descriptor);
}
