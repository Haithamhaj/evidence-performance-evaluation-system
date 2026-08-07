import {
  OpenManagerEvaluationCycleInputSchema,
  RecordManagerEvaluationEligibilityDecisionInputSchema,
} from "@evaluation/contracts";
import { ManagerEvaluationCycleService } from "@evaluation/manager-evaluation";
import { Body, Controller, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";

import { ManagerEvaluationPolicyGuard } from "./manager-evaluation-policy.guard.js";
import {
  parseManagerEvaluationInput,
  parseManagerEvaluationUuid,
} from "./manager-evaluation-input.js";

export class ManagerEvaluationCyclesController {
  private readonly cycles: ManagerEvaluationCycleService;
  constructor(cycles: ManagerEvaluationCycleService) {
    this.cycles = cycles;
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
}

Controller("api/v1/manager-evaluation/cycles")(ManagerEvaluationCyclesController);
UseGuards(ManagerEvaluationPolicyGuard)(ManagerEvaluationCyclesController);
Inject(ManagerEvaluationCycleService)(ManagerEvaluationCyclesController, undefined, 0);
decorate("open", Post(), [Req(), Body()]);
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
