import { Body, Controller, Inject, Post, Req, UseGuards } from "@nestjs/common";

import { WorkItemsPolicyGuard } from "../work-items/work-items-policy.guard.js";
import { CAPTURE_UNDERSTANDING } from "./tokens.js";

type Request = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId: string;
}>;

export class CaptureUnderstandingController {
  private readonly service: import("./capture-understanding.service.js").CaptureUnderstandingService;

  constructor(service: import("./capture-understanding.service.js").CaptureUnderstandingService) {
    this.service = service;
  }

  understand(request: Request, body: unknown) {
    return this.service.understand({
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

Controller("api/v1/experience-orchestration/capture")(CaptureUnderstandingController);
UseGuards(WorkItemsPolicyGuard)(CaptureUnderstandingController);
Inject(CAPTURE_UNDERSTANDING)(CaptureUnderstandingController, undefined, 0);

const understand = Object.getOwnPropertyDescriptor(
  CaptureUnderstandingController.prototype,
  "understand",
)!;
Req()(CaptureUnderstandingController.prototype, "understand", 0);
Body()(CaptureUnderstandingController.prototype, "understand", 1);
Post("understand")(CaptureUnderstandingController.prototype, "understand", understand);
