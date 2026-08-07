import { AppError, ActivateEvaluationTemplateVersionInputSchema } from "@evaluation/contracts";
import { EvaluationTemplateService } from "@evaluation/employee-evaluation";
import { Body, Controller, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";

import { EmployeeEvaluationPolicyGuard } from "./employee-evaluation-policy.guard.js";
import { parseEvaluationInput, parseEvaluationUuid } from "./employee-evaluation-input.js";

type EmployeeEvaluationRequest =
  import("./employee-evaluation-policy.guard.js").EmployeeEvaluationRequest;

export class EvaluationTemplatesController {
  private readonly templates: EvaluationTemplateService;

  constructor(templates: EvaluationTemplateService) {
    this.templates = templates;
  }

  activate(request: EmployeeEvaluationRequest, versionId: string, body: unknown) {
    const principal = administrator(request);
    const parsedId = parseEvaluationUuid(versionId);
    const parsed = parseEvaluationInput(
      ActivateEvaluationTemplateVersionInputSchema.omit({ versionId: true, actorId: true }),
      body,
    );
    return this.templates.activateVersion({
      ...parsed,
      versionId: parsedId,
      actorId: principal.userId,
    });
  }
}

Controller("api/v1/employee-evaluation/templates/versions/:versionId")(
  EvaluationTemplatesController,
);
UseGuards(EmployeeEvaluationPolicyGuard)(EvaluationTemplatesController);
Inject(EvaluationTemplateService)(EvaluationTemplatesController, undefined, 0);
decorate("activate", Post("activation"), [Req(), Param("versionId"), Body()]);

function administrator(request: EmployeeEvaluationRequest) {
  const principal = request.principal;
  if (principal?.active !== true || !principal.roles.includes("system_administrator")) {
    throw new AppError("EMPLOYEE_EVALUATION_FORBIDDEN", "errors.evaluation.forbidden", 403);
  }
  return principal;
}

function decorate(
  method: keyof EvaluationTemplatesController,
  route: MethodDecorator,
  parameters: readonly ParameterDecorator[],
) {
  const descriptor = Object.getOwnPropertyDescriptor(
    EvaluationTemplatesController.prototype,
    method,
  )!;
  parameters.forEach((parameter, index) =>
    parameter(EvaluationTemplatesController.prototype, method, index),
  );
  route(EvaluationTemplatesController.prototype, method, descriptor);
}
