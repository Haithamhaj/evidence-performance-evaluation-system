import { Body, Controller, Inject, Post, Req, UseGuards } from "@nestjs/common";

import { WorkItemsPolicyGuard } from "../work-items/work-items-policy.guard.js";
import { TASK_ASSISTANT } from "./tokens.js";

type Request = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId: string;
}>;

export class TaskAssistantController {
  private readonly service: import("./task-assistant.service.js").TaskAssistantService;

  constructor(service: import("./task-assistant.service.js").TaskAssistantService) {
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

Controller("api/v1/experience-orchestration/task-assistant")(TaskAssistantController);
UseGuards(WorkItemsPolicyGuard)(TaskAssistantController);
Inject(TASK_ASSISTANT)(TaskAssistantController, undefined, 0);
const ask = Object.getOwnPropertyDescriptor(TaskAssistantController.prototype, "ask")!;
Req()(TaskAssistantController.prototype, "ask", 0);
Body()(TaskAssistantController.prototype, "ask", 1);
Post("ask")(TaskAssistantController.prototype, "ask", ask);
