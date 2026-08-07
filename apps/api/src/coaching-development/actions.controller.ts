/* eslint-disable no-unused-vars */
import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { DevelopmentActionService, ManagerSupportService } from "@evaluation/coaching-development";

import { CoachingPolicyGuard, type CoachingRequest } from "./coaching-policy.guard.js";
export class CoachingActionsController {
  constructor(
    private readonly actions: DevelopmentActionService,
    private readonly support: ManagerSupportService,
  ) {}
  read(request: CoachingRequest, actionId: string) {
    return this.actions.read({
      actionId,
      actorId: request.principal!.userId,
      managerId: request.principal!.userId,
    });
  }
  create(request: CoachingRequest, body: unknown) {
    return this.actions.create({ ...(body as object), employeeId: request.principal!.userId });
  }
  revise(request: CoachingRequest, body: unknown) {
    return this.actions.revise({ ...(body as object), employeeId: request.principal!.userId });
  }
  changePrivacy(request: CoachingRequest, body: unknown) {
    return this.actions.changePrivacy({
      ...(body as object),
      employeeId: request.principal!.userId,
    });
  }
  transition(request: CoachingRequest, body: unknown) {
    return this.actions.transition({ ...(body as object), employeeId: request.principal!.userId });
  }
  addSupport(request: CoachingRequest, body: unknown) {
    return this.support.append({ ...(body as object), managerId: request.principal!.userId });
  }
}
Controller("api/v1/coaching/actions")(CoachingActionsController);
UseGuards(CoachingPolicyGuard)(CoachingActionsController);
let descriptor = Object.getOwnPropertyDescriptor(CoachingActionsController.prototype, "read")!;
Req()(CoachingActionsController.prototype, "read", 0);
Param("actionId")(CoachingActionsController.prototype, "read", 1);
Get(":actionId")(CoachingActionsController.prototype, "read", descriptor);
descriptor = Object.getOwnPropertyDescriptor(CoachingActionsController.prototype, "transition")!;
Req()(CoachingActionsController.prototype, "transition", 0);
Body()(CoachingActionsController.prototype, "transition", 1);
Post("transition")(CoachingActionsController.prototype, "transition", descriptor);
descriptor = Object.getOwnPropertyDescriptor(CoachingActionsController.prototype, "create")!;
Req()(CoachingActionsController.prototype, "create", 0);
Body()(CoachingActionsController.prototype, "create", 1);
Post()(CoachingActionsController.prototype, "create", descriptor);
descriptor = Object.getOwnPropertyDescriptor(CoachingActionsController.prototype, "revise")!;
Req()(CoachingActionsController.prototype, "revise", 0);
Body()(CoachingActionsController.prototype, "revise", 1);
Post("revise")(CoachingActionsController.prototype, "revise", descriptor);
descriptor = Object.getOwnPropertyDescriptor(CoachingActionsController.prototype, "changePrivacy")!;
Req()(CoachingActionsController.prototype, "changePrivacy", 0);
Body()(CoachingActionsController.prototype, "changePrivacy", 1);
Post("privacy")(CoachingActionsController.prototype, "changePrivacy", descriptor);
descriptor = Object.getOwnPropertyDescriptor(CoachingActionsController.prototype, "addSupport")!;
Req()(CoachingActionsController.prototype, "addSupport", 0);
Body()(CoachingActionsController.prototype, "addSupport", 1);
Post("support")(CoachingActionsController.prototype, "addSupport", descriptor);
