import { AppError } from "@evaluation/contracts";
import { Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { ExperienceEventRuntime } from "./experience-event-runtime.js";
import { OperationsPolicyGuard } from "./operations-policy.guard.js";

type Request = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
}>;

const QuerySchema = z
  .object({
    afterCursor: z
      .string()
      .regex(/^[1-9]\d*$/u)
      .nullable()
      .default(null),
  })
  .passthrough();

export class ExperienceEventsController {
  private readonly runtime: ExperienceEventRuntime;

  constructor(runtime: ExperienceEventRuntime) {
    this.runtime = runtime;
  }

  list(request: Request, query: unknown) {
    assertActive(request);
    const parsed = QuerySchema.parse(query);
    return this.runtime.listWhatChanged({
      actorId: request.principal.userId,
      afterCursor: parsed.afterCursor,
    });
  }

  acknowledge(request: Request, receiptId: string) {
    assertActive(request);
    return this.runtime.acknowledge({
      actorId: request.principal.userId,
      receiptId: z.string().uuid().parse(receiptId),
    });
  }
}

function assertActive(request: Request) {
  if (!request.principal.active) {
    throw new AppError("AUTH_INACTIVE_USER", "errors.auth.inactiveUser", 403);
  }
}

Controller("api/v1/experience/what-changed")(ExperienceEventsController);
UseGuards(OperationsPolicyGuard)(ExperienceEventsController);
Inject(ExperienceEventRuntime)(ExperienceEventsController, undefined, 0);

const list = Object.getOwnPropertyDescriptor(ExperienceEventsController.prototype, "list")!;
Req()(ExperienceEventsController.prototype, "list", 0);
Query()(ExperienceEventsController.prototype, "list", 1);
Get()(ExperienceEventsController.prototype, "list", list);

const acknowledge = Object.getOwnPropertyDescriptor(
  ExperienceEventsController.prototype,
  "acknowledge",
)!;
Req()(ExperienceEventsController.prototype, "acknowledge", 0);
Param("receiptId")(ExperienceEventsController.prototype, "acknowledge", 1);
Post(":receiptId/acknowledge")(ExperienceEventsController.prototype, "acknowledge", acknowledge);
