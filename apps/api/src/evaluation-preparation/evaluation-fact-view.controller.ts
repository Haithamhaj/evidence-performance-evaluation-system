import { EvaluationFactViewService } from "@evaluation/evaluation-preparation";
import { Controller, Get, Inject, Param, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { EvaluationFactViewPolicyGuard } from "./evaluation-fact-view-policy.guard.js";

export class EvaluationFactViewController {
  private readonly service: EvaluationFactViewService;

  constructor(service: EvaluationFactViewService) {
    this.service = service;
  }

  read(
    request: import("./evaluation-fact-view-policy.guard.js").EvaluationFactRequest,
    cycleId: string,
    employeeId: string,
  ) {
    const parsedCycleId = z.string().uuid().parse(cycleId);
    const parsedEmployeeId = z.string().uuid().parse(employeeId);
    const context = request.evaluationFactContext;
    if (
      context === undefined ||
      context.cycle.id !== parsedCycleId ||
      context.requester.subjectEmployeeId !== parsedEmployeeId
    ) {
      throw new Error("Evaluation Fact View authorization context is missing");
    }
    return this.service.read({
      cycle: context.cycle,
      subjectEmployeeId: parsedEmployeeId,
      requester: context.requester,
    });
  }
}

Controller("api/v1/evaluation-cycles/:cycleId/employees/:employeeId/facts")(
  EvaluationFactViewController,
);
UseGuards(EvaluationFactViewPolicyGuard)(EvaluationFactViewController);
Inject(EvaluationFactViewService)(EvaluationFactViewController, undefined, 0);

const read = Object.getOwnPropertyDescriptor(EvaluationFactViewController.prototype, "read")!;
Req()(EvaluationFactViewController.prototype, "read", 0);
Param("cycleId")(EvaluationFactViewController.prototype, "read", 1);
Param("employeeId")(EvaluationFactViewController.prototype, "read", 2);
Get()(EvaluationFactViewController.prototype, "read", read);
