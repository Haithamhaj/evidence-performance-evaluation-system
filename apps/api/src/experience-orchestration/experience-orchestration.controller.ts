import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { SuggestionFeedbackInputSchema } from "@evaluation/contracts";

import { WorkItemsPolicyGuard } from "../work-items/work-items-policy.guard.js";
import { EXPERIENCE_ORCHESTRATOR, PREPARED_EXPERIENCE_FEEDBACK } from "./tokens.js";

type Request = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId: string;
}>;

export class ExperienceOrchestrationController {
  private readonly service: import("./experience-orchestrator.service.js").ExperienceOrchestratorService;
  private readonly feedback: import("./prepared-experience-feedback.service.js").PreparedExperienceFeedbackService;

  constructor(
    service: import("./experience-orchestrator.service.js").ExperienceOrchestratorService,
    feedback: import("./prepared-experience-feedback.service.js").PreparedExperienceFeedbackService,
  ) {
    this.service = service;
    this.feedback = feedback;
  }

  compose(request: Request) {
    return this.service.compose({
      actor: {
        userId: request.principal.userId,
        active: request.principal.active,
        roles: request.principal.roles,
      },
      correlationId: request.correlationId,
    });
  }

  recordFeedback(request: Request, preparedItemId: string, body: unknown) {
    return this.feedback.record({
      actor: { userId: request.principal.userId, active: request.principal.active },
      preparedItemId,
      input: SuggestionFeedbackInputSchema.parse(body),
    });
  }
}

Controller("api/v1/experience-orchestration")(ExperienceOrchestrationController);
UseGuards(WorkItemsPolicyGuard)(ExperienceOrchestrationController);
Inject(EXPERIENCE_ORCHESTRATOR)(ExperienceOrchestrationController, undefined, 0);
Inject(PREPARED_EXPERIENCE_FEEDBACK)(ExperienceOrchestrationController, undefined, 1);
const compose = Object.getOwnPropertyDescriptor(
  ExperienceOrchestrationController.prototype,
  "compose",
)!;
Req()(ExperienceOrchestrationController.prototype, "compose", 0);
Get("prepared")(ExperienceOrchestrationController.prototype, "compose", compose);
const recordFeedback = Object.getOwnPropertyDescriptor(
  ExperienceOrchestrationController.prototype,
  "recordFeedback",
)!;
Req()(ExperienceOrchestrationController.prototype, "recordFeedback", 0);
Param("preparedItemId")(ExperienceOrchestrationController.prototype, "recordFeedback", 1);
Body()(ExperienceOrchestrationController.prototype, "recordFeedback", 2);
Post("prepared/:preparedItemId/feedback")(
  ExperienceOrchestrationController.prototype,
  "recordFeedback",
  recordFeedback,
);
