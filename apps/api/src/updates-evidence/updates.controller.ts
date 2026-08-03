import {
  ClarificationAnswerInputSchema,
  ConfirmUpdateInputSchema,
  ReviseUpdateDraftInputSchema,
  StartUpdateInputSchema,
} from "@evaluation/contracts";
import { ActivityReader, UpdateService } from "@evaluation/updates-evidence";
import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { UpdatesEvidencePolicyGuard } from "./updates-evidence-policy.guard.js";

type Request = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId: string;
}>;

const TimelineQuerySchema = z
  .object({
    projectId: z.string().uuid(),
    workstreamId: z.string().uuid().nullable().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).max(1_000).optional(),
  })
  .strict();

export class UpdatesController {
  private readonly service: UpdateService;
  private readonly query: ActivityReader;

  constructor(service: UpdateService, query: ActivityReader) {
    this.service = service;
    this.query = query;
  }

  start(request: Request, body: unknown) {
    return this.service.start({
      actor: actor(request),
      correlationId: request.correlationId,
      input: StartUpdateInputSchema.parse(body),
    });
  }

  answer(request: Request, sessionId: string, body: unknown) {
    return this.service.answer({
      actor: actor(request),
      correlationId: request.correlationId,
      sessionId: z.string().uuid().parse(sessionId),
      input: ClarificationAnswerInputSchema.parse(body),
    });
  }

  review(request: Request, sessionId: string) {
    return this.query.updateReview({
      actorId: request.principal.userId,
      sessionId: z.string().uuid().parse(sessionId),
    });
  }

  result(request: Request, acceptedEventId: string) {
    return this.query.updateResult({
      actorId: request.principal.userId,
      acceptedEventId: z.string().uuid().parse(acceptedEventId),
    });
  }

  revise(request: Request, sessionId: string, body: unknown) {
    return this.service.revise({
      actor: actor(request),
      correlationId: request.correlationId,
      sessionId: z.string().uuid().parse(sessionId),
      input: ReviseUpdateDraftInputSchema.parse(body),
    });
  }

  confirm(request: Request, sessionId: string, body: unknown) {
    return this.service.confirm({
      actor: actor(request),
      correlationId: request.correlationId,
      sessionId: z.string().uuid().parse(sessionId),
      input: ConfirmUpdateInputSchema.parse(body),
    });
  }
}

export class TimelineController {
  private readonly query: ActivityReader;

  constructor(query: ActivityReader) {
    this.query = query;
  }

  list(request: Request, query: unknown) {
    const parsed = TimelineQuerySchema.parse(query);
    return this.query.timeline({
      actorId: request.principal.userId,
      projectId: parsed.projectId,
      workstreamId: parsed.workstreamId ?? null,
      limit: parsed.limit,
      cursor: parsed.cursor ?? null,
    });
  }
}

function actor(request: Request) {
  return { userId: request.principal.userId, active: request.principal.active };
}

Controller("api/v1/updates")(UpdatesController);
UseGuards(UpdatesEvidencePolicyGuard)(UpdatesController);
Inject(UpdateService)(UpdatesController, undefined, 0);
Inject(ActivityReader)(UpdatesController, undefined, 1);

for (const [method, verb, path] of [
  ["start", "post", "text"],
  ["answer", "post", ":sessionId/answers"],
  ["review", "get", ":sessionId/draft"],
  ["result", "get", ":acceptedEventId/result"],
  ["revise", "post", ":sessionId/revisions"],
  ["confirm", "post", ":sessionId/confirm"],
] as const) {
  const descriptor = Object.getOwnPropertyDescriptor(UpdatesController.prototype, method)!;
  Req()(UpdatesController.prototype, method, 0);
  if (method !== "start") {
    Param(method === "result" ? "acceptedEventId" : "sessionId")(
      UpdatesController.prototype,
      method,
      1,
    );
  }
  if (["start", "answer", "revise", "confirm"].includes(method)) {
    Body()(UpdatesController.prototype, method, method === "start" ? 1 : 2);
  }
  (verb === "get" ? Get(path) : Post(path))(UpdatesController.prototype, method, descriptor);
}

Controller("api/v1/timeline")(TimelineController);
UseGuards(UpdatesEvidencePolicyGuard)(TimelineController);
Inject(ActivityReader)(TimelineController, undefined, 0);
const list = Object.getOwnPropertyDescriptor(TimelineController.prototype, "list")!;
Req()(TimelineController.prototype, "list", 0);
Query()(TimelineController.prototype, "list", 1);
Get()(TimelineController.prototype, "list", list);
