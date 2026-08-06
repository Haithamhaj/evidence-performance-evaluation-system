import {
  AppError,
  OpenEmployeeEvaluationCycleInputSchema,
  RecordEvaluationEligibilityDecisionInputSchema,
  TransitionEmployeeEvaluationCycleInputSchema,
} from "@evaluation/contracts";
import { EmployeeEvaluationCycleService } from "@evaluation/employee-evaluation";
import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";

import { EmployeeEvaluationPolicyGuard } from "./employee-evaluation-policy.guard.js";
import { EmployeeEvaluationQueryService } from "./employee-evaluation-query.service.js";
import { parseEvaluationInput, parseEvaluationUuid } from "./employee-evaluation-input.js";

type EmployeeEvaluationRequest =
  import("./employee-evaluation-policy.guard.js").EmployeeEvaluationRequest;

export class EvaluationCyclesController {
  private readonly cycles: EmployeeEvaluationCycleService;
  private readonly query: EmployeeEvaluationQueryService;

  constructor(cycles: EmployeeEvaluationCycleService, query: EmployeeEvaluationQueryService) {
    this.cycles = cycles;
    this.query = query;
  }

  journey(request: EmployeeEvaluationRequest, cycleId: string): Promise<unknown> {
    const principal = request.principal;
    if (principal?.active !== true) throw forbidden();
    return this.query.readCycleJourney({
      cycleId: parseEvaluationUuid(cycleId),
      actorId: principal.userId,
    });
  }

  open(request: EmployeeEvaluationRequest, body: unknown) {
    const principal = managerOrAdministrator(request);
    const parsed = parseEvaluationInput(
      OpenEmployeeEvaluationCycleInputSchema.omit({ actorId: true }),
      body,
    );
    return this.cycles.openCycle({ ...parsed, actorId: principal.userId });
  }

  transition(request: EmployeeEvaluationRequest, cycleId: string, body: unknown) {
    const principal = managerOrAdministrator(request);
    const parsedId = parseEvaluationUuid(cycleId);
    const parsed = parseEvaluationInput(
      TransitionEmployeeEvaluationCycleInputSchema.omit({ cycleId: true, actorId: true }),
      body,
    );
    return this.cycles.transitionCycle({ ...parsed, cycleId: parsedId, actorId: principal.userId });
  }

  eligibility(request: EmployeeEvaluationRequest, assignmentId: string, body: unknown) {
    const principal = managerOrAdministrator(request);
    const parsedId = parseEvaluationUuid(assignmentId);
    const parsed = parseEvaluationInput(
      RecordEvaluationEligibilityDecisionInputSchema.omit({ assignmentId: true, actorId: true }),
      body,
    );
    return this.cycles.recordEligibilityDecision({
      ...parsed,
      assignmentId: parsedId,
      actorId: principal.userId,
    });
  }
}

Controller("api/v1/employee-evaluation/cycles")(EvaluationCyclesController);
UseGuards(EmployeeEvaluationPolicyGuard)(EvaluationCyclesController);
Inject(EmployeeEvaluationCycleService)(EvaluationCyclesController, undefined, 0);
Inject(EmployeeEvaluationQueryService)(EvaluationCyclesController, undefined, 1);
decorate("journey", Get(":cycleId/journey"), [Req(), Param("cycleId")]);
decorate("open", Post(), [Req(), Body()]);
decorate("transition", Post(":cycleId/transitions"), [Req(), Param("cycleId"), Body()]);
decorate("eligibility", Post("assignments/:assignmentId/eligibility-decisions"), [
  Req(),
  Param("assignmentId"),
  Body(),
]);

function managerOrAdministrator(request: EmployeeEvaluationRequest) {
  const principal = request.principal;
  if (
    principal?.active !== true ||
    !principal.roles.some((role) => ["manager", "system_administrator"].includes(role))
  ) {
    throw new AppError("EMPLOYEE_EVALUATION_FORBIDDEN", "errors.evaluation.forbidden", 403);
  }
  return principal;
}

function forbidden() {
  return new AppError("EMPLOYEE_EVALUATION_FORBIDDEN", "errors.evaluation.forbidden", 403);
}

function decorate(
  method: keyof EvaluationCyclesController,
  route: MethodDecorator,
  parameters: readonly ParameterDecorator[],
) {
  const descriptor = Object.getOwnPropertyDescriptor(EvaluationCyclesController.prototype, method)!;
  parameters.forEach((parameter, index) =>
    parameter(EvaluationCyclesController.prototype, method, index),
  );
  route(EvaluationCyclesController.prototype, method, descriptor);
}
