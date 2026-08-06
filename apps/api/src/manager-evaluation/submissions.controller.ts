import { SubmitManagerEvaluationInputSchema } from "@evaluation/contracts";
import { ManagerEvaluationSubmissionService } from "@evaluation/manager-evaluation";
import { Body, Controller, Inject, Post, Req, UseGuards } from "@nestjs/common";

import { ManagerEvaluationPolicyGuard } from "./manager-evaluation-policy.guard.js";
import { parseManagerEvaluationInput } from "./manager-evaluation-input.js";

export class ManagerEvaluationSubmissionsController {
  private readonly submissions: ManagerEvaluationSubmissionService;
  constructor(submissions: ManagerEvaluationSubmissionService) {
    this.submissions = submissions;
  }

  submit(
    request: import("./manager-evaluation-policy.guard.js").ManagerEvaluationRequest,
    body: unknown,
  ) {
    return this.submissions.submit(
      parseManagerEvaluationInput(SubmitManagerEvaluationInputSchema, {
        ...(body !== null && typeof body === "object" && !Array.isArray(body) ? body : {}),
        evaluatorId: request.principal!.userId,
      }),
    );
  }
}

Controller("api/v1/manager-evaluation/submissions")(ManagerEvaluationSubmissionsController);
UseGuards(ManagerEvaluationPolicyGuard)(ManagerEvaluationSubmissionsController);
Inject(ManagerEvaluationSubmissionService)(ManagerEvaluationSubmissionsController, undefined, 0);
const descriptor = Object.getOwnPropertyDescriptor(
  ManagerEvaluationSubmissionsController.prototype,
  "submit",
)!;
Req()(ManagerEvaluationSubmissionsController.prototype, "submit", 0);
Body()(ManagerEvaluationSubmissionsController.prototype, "submit", 1);
Post()(ManagerEvaluationSubmissionsController.prototype, "submit", descriptor);
