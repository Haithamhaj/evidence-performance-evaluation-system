import {
  CapturePrivateInboxInputSchema,
  DismissPrivateInboxInputSchema,
  ListPrivateInboxInputSchema,
  PromotePrivateInboxInputSchema,
} from "@evaluation/contracts";
import { AppError } from "@evaluation/contracts";
import { canUsePrivateCapture } from "@evaluation/permissions";
import { PrivateInboxQueryService, PrivateInboxService } from "@evaluation/work-items";
import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { WorkItemsPolicyGuard } from "./work-items-policy.guard.js";

type Request = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId: string;
}>;

export class PrivateInboxController {
  private readonly service: PrivateInboxService;
  private readonly query: PrivateInboxQueryService;

  constructor(service: PrivateInboxService, query: PrivateInboxQueryService) {
    this.service = service;
    this.query = query;
  }

  capture(request: Request, body: unknown) {
    assertPrivateInboxAuthorized(request.principal);
    return this.service.capture({
      actor: actor(request),
      correlationId: request.correlationId,
      input: CapturePrivateInboxInputSchema.parse(body),
    });
  }

  list(request: Request, query: unknown) {
    assertPrivateInboxAuthorized(request.principal);
    return this.query.list({
      actor: actor(request),
      input: ListPrivateInboxInputSchema.parse(query),
    });
  }

  promote(request: Request, inboxItemId: string, body: unknown) {
    assertPrivateInboxAuthorized(request.principal);
    return this.service.promote({
      actor: actor(request),
      correlationId: request.correlationId,
      inboxItemId: z.string().uuid().parse(inboxItemId),
      input: PromotePrivateInboxInputSchema.parse(body),
    });
  }

  dismiss(request: Request, inboxItemId: string, body: unknown) {
    assertPrivateInboxAuthorized(request.principal);
    return this.service.dismiss({
      actor: actor(request),
      correlationId: request.correlationId,
      inboxItemId: z.string().uuid().parse(inboxItemId),
      input: DismissPrivateInboxInputSchema.parse(body),
    });
  }
}

function actor(request: Request) {
  return {
    userId: request.principal.userId,
    active: request.principal.active,
    roles: request.principal.roles,
  };
}

function assertPrivateInboxAuthorized(
  principal: import("@evaluation/auth").AuthenticatedPrincipal,
) {
  if (!canUsePrivateCapture(principal)) {
    throw new AppError("PRIVATE_INBOX_FORBIDDEN", "errors.privateInbox.forbidden", 403);
  }
}

Controller("api/v1/private-inbox")(PrivateInboxController);
UseGuards(WorkItemsPolicyGuard)(PrivateInboxController);
Inject(PrivateInboxService)(PrivateInboxController, undefined, 0);
Inject(PrivateInboxQueryService)(PrivateInboxController, undefined, 1);

const capture = Object.getOwnPropertyDescriptor(PrivateInboxController.prototype, "capture")!;
Req()(PrivateInboxController.prototype, "capture", 0);
Body()(PrivateInboxController.prototype, "capture", 1);
Post()(PrivateInboxController.prototype, "capture", capture);

const list = Object.getOwnPropertyDescriptor(PrivateInboxController.prototype, "list")!;
Req()(PrivateInboxController.prototype, "list", 0);
Query()(PrivateInboxController.prototype, "list", 1);
Get()(PrivateInboxController.prototype, "list", list);

const promote = Object.getOwnPropertyDescriptor(PrivateInboxController.prototype, "promote")!;
Req()(PrivateInboxController.prototype, "promote", 0);
Param("inboxItemId")(PrivateInboxController.prototype, "promote", 1);
Body()(PrivateInboxController.prototype, "promote", 2);
Post(":inboxItemId/promote")(PrivateInboxController.prototype, "promote", promote);

const dismiss = Object.getOwnPropertyDescriptor(PrivateInboxController.prototype, "dismiss")!;
Req()(PrivateInboxController.prototype, "dismiss", 0);
Param("inboxItemId")(PrivateInboxController.prototype, "dismiss", 1);
Body()(PrivateInboxController.prototype, "dismiss", 2);
Post(":inboxItemId/dismiss")(PrivateInboxController.prototype, "dismiss", dismiss);
