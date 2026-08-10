/* eslint-disable no-unused-vars */
import { LeaveService } from "@evaluation/continuity";
import { Body, Controller, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";

import { ContinuityPolicyGuard, type ContinuityRequest } from "./continuity-policy.guard.js";

export class LeaveController {
  constructor(private readonly service: LeaveService) {}
  submit(request: ContinuityRequest, body: unknown) {
    const actorId = request.principal!.userId;
    return this.service.submit({
      ...object(body),
      actorId,
      employeeId: actorId,
      correlationId: correlation(request),
    });
  }
  decide(request: ContinuityRequest, leaveId: string, body: unknown) {
    return this.service.decide({
      ...object(body),
      leaveId,
      managerId: request.principal!.userId,
      correlationId: correlation(request),
    });
  }
  activate(request: ContinuityRequest, leaveId: string, body: unknown) {
    return this.service.activate({
      ...object(body),
      leaveId,
      managerId: request.principal!.userId,
      correlationId: correlation(request),
    });
  }
  cancel(request: ContinuityRequest, leaveId: string, body: unknown) {
    return this.service.cancel({
      ...object(body),
      leaveId,
      actorId: request.principal!.userId,
      correlationId: correlation(request),
    });
  }
}
Inject(LeaveService)(LeaveController, undefined, 0);
Controller("api/v1/continuity/leaves")(LeaveController);
UseGuards(ContinuityPolicyGuard)(LeaveController);
decorate(LeaveController, "submit", Post(), [Req(), Body()]);
decorate(LeaveController, "decide", Post(":leaveId/decision"), [Req(), Param("leaveId"), Body()]);
decorate(LeaveController, "activate", Post(":leaveId/activate"), [Req(), Param("leaveId"), Body()]);
decorate(LeaveController, "cancel", Post(":leaveId/cancel"), [Req(), Param("leaveId"), Body()]);

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
function correlation(request: ContinuityRequest) {
  return request.correlationId ?? crypto.randomUUID();
}
function decorate(
  controller: typeof LeaveController,
  method: keyof LeaveController,
  route: MethodDecorator,
  parameters: ParameterDecorator[],
) {
  const descriptor = Object.getOwnPropertyDescriptor(controller.prototype, method)!;
  parameters.forEach((parameter, index) => parameter(controller.prototype, method, index));
  route(controller.prototype, method, descriptor);
}
