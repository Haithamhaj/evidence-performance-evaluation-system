import { Body, Controller, Inject, Post, Req, UseGuards } from "@nestjs/common";

import { WorkItemsPolicyGuard } from "../work-items/work-items-policy.guard.js";
import { PROJECT_ASSISTANT } from "./tokens.js";

type Request = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId: string;
}>;

export class ProjectAssistantController {
  private readonly service: import("./project-assistant.service.js").ProjectAssistantService;

  constructor(service: import("./project-assistant.service.js").ProjectAssistantService) {
    this.service = service;
  }

  ask(request: Request, body: unknown) {
    return this.service.ask({
      actor: {
        userId: request.principal.userId,
        active: request.principal.active,
        roles: request.principal.roles,
      },
      correlationId: request.correlationId,
      input: body,
    });
  }
}

Controller("api/v1/experience-orchestration/project-assistant")(ProjectAssistantController);
UseGuards(WorkItemsPolicyGuard)(ProjectAssistantController);
Inject(PROJECT_ASSISTANT)(ProjectAssistantController, undefined, 0);
const ask = Object.getOwnPropertyDescriptor(ProjectAssistantController.prototype, "ask")!;
Req()(ProjectAssistantController.prototype, "ask", 0);
Body()(ProjectAssistantController.prototype, "ask", 1);
Post("ask")(ProjectAssistantController.prototype, "ask", ask);
