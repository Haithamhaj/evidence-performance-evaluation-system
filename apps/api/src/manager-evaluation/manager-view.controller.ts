import {
  IdentifiedCompletionReader,
  IdentifiedProjectionPolicy,
} from "@evaluation/manager-evaluation";
import { Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";

import { ApiManagerEvaluationSummaryService } from "./api-manager-evaluation-summary.service.js";
import { ManagerEvaluationPolicyGuard } from "./manager-evaluation-policy.guard.js";
import { parseManagerEvaluationUuid } from "./manager-evaluation-input.js";

export class ManagerEvaluationManagerViewController {
  private readonly completion: IdentifiedCompletionReader;
  private readonly projection: IdentifiedProjectionPolicy;
  private readonly summaries: ApiManagerEvaluationSummaryService;
  constructor(
    completion: IdentifiedCompletionReader,
    projection: IdentifiedProjectionPolicy,
    summaries: ApiManagerEvaluationSummaryService,
  ) {
    this.completion = completion;
    this.projection = projection;
    this.summaries = summaries;
  }

  readCompletion(
    request: import("./manager-evaluation-policy.guard.js").ManagerEvaluationRequest,
    cycleId: string,
  ) {
    return this.completion.read({
      cycleId: parseManagerEvaluationUuid(cycleId),
      managerId: request.principal!.userId,
    });
  }

  readResponse(
    request: import("./manager-evaluation-policy.guard.js").ManagerEvaluationRequest,
    responseId: string,
  ) {
    return this.projection.readResponse({
      responseId: parseManagerEvaluationUuid(responseId),
      managerId: request.principal!.userId,
      reason: "Authorized manager reviewed an identified original response.",
    });
  }

  readCycle(
    request: import("./manager-evaluation-policy.guard.js").ManagerEvaluationRequest,
    cycleId: string,
  ) {
    return this.projection.readManagerCycle({
      cycleId: parseManagerEvaluationUuid(cycleId),
      managerId: request.principal!.userId,
      reason: "Authorized manager reviewed identified completion and originals.",
    });
  }

  generateSummary(
    request: import("./manager-evaluation-policy.guard.js").ManagerEvaluationRequest,
    cycleId: string,
  ) {
    return this.summaries.createSummary({
      cycleId: parseManagerEvaluationUuid(cycleId),
      managerId: request.principal!.userId,
    });
  }
}

Controller("api/v1/manager-evaluation")(ManagerEvaluationManagerViewController);
UseGuards(ManagerEvaluationPolicyGuard)(ManagerEvaluationManagerViewController);
Inject(IdentifiedCompletionReader)(ManagerEvaluationManagerViewController, undefined, 0);
Inject(IdentifiedProjectionPolicy)(ManagerEvaluationManagerViewController, undefined, 1);
Inject(ApiManagerEvaluationSummaryService)(ManagerEvaluationManagerViewController, undefined, 2);
decorate("readCompletion", Get("cycles/:cycleId/completion"), [Req(), Param("cycleId")]);
decorate("readResponse", Get("responses/:responseId"), [Req(), Param("responseId")]);
decorate("readCycle", Get("cycles/:cycleId/manager-view"), [Req(), Param("cycleId")]);
decorate("generateSummary", Post("cycles/:cycleId/summaries"), [Req(), Param("cycleId")]);

function decorate(
  method: keyof ManagerEvaluationManagerViewController,
  route: MethodDecorator,
  parameters: readonly ParameterDecorator[],
) {
  const descriptor = Object.getOwnPropertyDescriptor(
    ManagerEvaluationManagerViewController.prototype,
    method,
  )!;
  parameters.forEach((parameter, index) =>
    parameter(ManagerEvaluationManagerViewController.prototype, method, index),
  );
  route(ManagerEvaluationManagerViewController.prototype, method, descriptor);
}
