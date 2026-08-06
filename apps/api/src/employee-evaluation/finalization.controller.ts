import {
  CloseEmployeeEvaluationCycleInputSchema,
  EvaluationAcknowledgmentInputSchema,
  FinalizeEmployeeEvaluationInputSchema,
} from "@evaluation/contracts";
import { EvaluationReportReader, FinalizationService } from "@evaluation/employee-evaluation";
import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";

import { EmployeeEvaluationPolicyGuard } from "./employee-evaluation-policy.guard.js";
import { parseEvaluationInput, parseEvaluationUuid } from "./employee-evaluation-input.js";

type EmployeeEvaluationRequest =
  import("./employee-evaluation-policy.guard.js").EmployeeEvaluationRequest;

export class FinalizationController {
  private readonly finalization: FinalizationService;
  private readonly reports: EvaluationReportReader;

  constructor(finalization: FinalizationService, reports: EvaluationReportReader) {
    this.finalization = finalization;
    this.reports = reports;
  }

  finalize(request: EmployeeEvaluationRequest, assignmentId: string, body: unknown) {
    const authorized = scope(request, assignmentId);
    const parsed = parseEvaluationInput(
      FinalizeEmployeeEvaluationInputSchema.omit({ assignmentId: true, managerId: true }),
      body,
    );
    return this.finalization.finalize({
      ...parsed,
      assignmentId: authorized.assignmentId,
      managerId: authorized.actorId,
    });
  }

  acknowledge(request: EmployeeEvaluationRequest, assignmentId: string, body: unknown) {
    const authorized = scope(request, assignmentId);
    const parsed = parseEvaluationInput(
      EvaluationAcknowledgmentInputSchema.omit({ assignmentId: true, actorId: true }),
      body,
    );
    return this.finalization.acknowledge({
      ...parsed,
      assignmentId: authorized.assignmentId,
      actorId: authorized.actorId,
    });
  }

  close(request: EmployeeEvaluationRequest, assignmentId: string, body: unknown) {
    const authorized = scope(request, assignmentId);
    const parsed = parseEvaluationInput(
      CloseEmployeeEvaluationCycleInputSchema.omit({ cycleId: true, actorId: true }),
      body,
    );
    return this.finalization.close({
      ...parsed,
      cycleId: authorized.cycleId,
      actorId: authorized.actorId,
    });
  }

  readEmployeeReport(request: EmployeeEvaluationRequest, assignmentId: string) {
    const authorized = scope(request, assignmentId);
    return this.reports.readEmployee({
      assignmentId: authorized.assignmentId,
      requester: { actorId: authorized.actorId, access: "self", active: true },
    });
  }

  readDepartmentReport(request: EmployeeEvaluationRequest, assignmentId: string) {
    const authorized = scope(request, assignmentId);
    return this.reports.readDepartment({
      cycleId: authorized.cycleId,
      requester: {
        actorId: authorized.actorId,
        departmentId: authorized.departmentId,
        access: "assigned_manager",
        active: true,
      },
    });
  }
}

Controller("api/v1/employee-evaluation/assignments/:assignmentId")(FinalizationController);
UseGuards(EmployeeEvaluationPolicyGuard)(FinalizationController);
Inject(FinalizationService)(FinalizationController, undefined, 0);
Inject(EvaluationReportReader)(FinalizationController, undefined, 1);

decorate("finalize", Post("finalization"), [Req(), Param("assignmentId"), Body()]);
decorate("acknowledge", Post("acknowledgment"), [Req(), Param("assignmentId"), Body()]);
decorate("close", Post("closure"), [Req(), Param("assignmentId"), Body()]);
decorate("readEmployeeReport", Get("report"), [Req(), Param("assignmentId")]);
decorate("readDepartmentReport", Get("department-report"), [Req(), Param("assignmentId")]);

function scope(request: EmployeeEvaluationRequest, assignmentId: string) {
  const parsedId = parseEvaluationUuid(assignmentId);
  const authorization = request.evaluationScope;
  const principal = request.principal;
  if (
    authorization === undefined ||
    authorization.assignmentId !== parsedId ||
    principal?.active !== true
  ) {
    throw new Error("Employee Evaluation authorization context is missing");
  }
  return { ...authorization, actorId: principal.userId };
}

function decorate(
  method: keyof FinalizationController,
  route: MethodDecorator,
  parameters: readonly ParameterDecorator[],
) {
  const descriptor = Object.getOwnPropertyDescriptor(FinalizationController.prototype, method)!;
  parameters.forEach((parameter, index) =>
    parameter(FinalizationController.prototype, method, index),
  );
  route(FinalizationController.prototype, method, descriptor);
}
