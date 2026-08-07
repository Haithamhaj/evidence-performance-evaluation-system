/* eslint-disable no-unused-vars */
import { HandoverService } from "@evaluation/continuity";
import { Body, Controller, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ContinuityPolicyGuard, type ContinuityRequest } from "./continuity-policy.guard.js";

export class HandoverController {
  constructor(private readonly service: HandoverService) {}
  revise(request: ContinuityRequest, handoverId: string, body: unknown) {
    const actorId = request.principal!.userId;
    return this.service.revise({
      ...object(body),
      handoverId,
      actorId,
      employeeId: actorId,
      correlationId: correlation(request),
    });
  }
  confirm(request: ContinuityRequest, handoverId: string, body: unknown) {
    const actorId = request.principal!.userId;
    return this.service.confirm({
      ...object(body),
      handoverId,
      actorId,
      employeeId: actorId,
      correlationId: correlation(request),
    });
  }
}
Inject(HandoverService)(HandoverController, undefined, 0);
Controller("api/v1/continuity/handovers")(HandoverController);
UseGuards(ContinuityPolicyGuard)(HandoverController);
let descriptor = Object.getOwnPropertyDescriptor(HandoverController.prototype, "revise")!;
Req()(HandoverController.prototype, "revise", 0);
Param("handoverId")(HandoverController.prototype, "revise", 1);
Body()(HandoverController.prototype, "revise", 2);
Post(":handoverId/revisions")(HandoverController.prototype, "revise", descriptor);
descriptor = Object.getOwnPropertyDescriptor(HandoverController.prototype, "confirm")!;
Req()(HandoverController.prototype, "confirm", 0);
Param("handoverId")(HandoverController.prototype, "confirm", 1);
Body()(HandoverController.prototype, "confirm", 2);
Post(":handoverId/confirm")(HandoverController.prototype, "confirm", descriptor);
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
function correlation(request: ContinuityRequest) {
  return request.correlationId ?? crypto.randomUUID();
}
