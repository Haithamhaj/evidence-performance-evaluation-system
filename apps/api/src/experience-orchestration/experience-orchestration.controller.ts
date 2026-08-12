import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";

import { WorkItemsPolicyGuard } from "../work-items/work-items-policy.guard.js";
import { EXPERIENCE_ORCHESTRATOR } from "./tokens.js";

type Request = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId: string;
}>;

export class ExperienceOrchestrationController {
  private readonly service: import("./experience-orchestrator.service.js").ExperienceOrchestratorService;

  constructor(
    service: import("./experience-orchestrator.service.js").ExperienceOrchestratorService,
  ) {
    this.service = service;
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
}

Controller("api/v1/experience-orchestration")(ExperienceOrchestrationController);
UseGuards(WorkItemsPolicyGuard)(ExperienceOrchestrationController);
Inject(EXPERIENCE_ORCHESTRATOR)(ExperienceOrchestrationController, undefined, 0);
const compose = Object.getOwnPropertyDescriptor(
  ExperienceOrchestrationController.prototype,
  "compose",
)!;
Req()(ExperienceOrchestrationController.prototype, "compose", 0);
Get("prepared")(ExperienceOrchestrationController.prototype, "compose", compose);
