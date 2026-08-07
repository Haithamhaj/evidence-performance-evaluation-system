/* eslint-disable no-unused-vars */
import { DelegationService, ReturnService } from "@evaluation/continuity";
import { Body, Controller, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ContinuityPolicyGuard, type ContinuityRequest } from "./continuity-policy.guard.js";

export class DelegationController {
  constructor(
    private readonly service: DelegationService,
    private readonly returns: ReturnService,
  ) {}
  approve(request: ContinuityRequest, body: unknown) {
    return this.service.approve({
      ...object(body),
      managerId: request.principal!.userId,
      correlationId: correlation(request),
    });
  }
  confirm(request: ContinuityRequest, body: unknown) {
    return this.service.confirm({
      ...object(body),
      delegateId: request.principal!.userId,
      correlationId: correlation(request),
    });
  }
  reportGap(request: ContinuityRequest, body: unknown) {
    return this.service.reportGap({
      ...object(body),
      delegateId: request.principal!.userId,
      correlationId: correlation(request),
    });
  }
  activate(request: ContinuityRequest, delegationId: string) {
    return this.service.activate({
      delegationId,
      actorId: request.principal!.userId,
      correlationId: correlation(request),
    });
  }
  expire(request: ContinuityRequest, delegationId: string) {
    return this.service.expire({
      delegationId,
      actorId: request.principal!.userId,
      correlationId: correlation(request),
    });
  }
  completeReturn(request: ContinuityRequest, delegationId: string, body: unknown) {
    return this.returns.complete({
      ...object(body),
      delegationId,
      actingOwnerId: request.principal!.userId,
      correlationId: correlation(request),
    });
  }
}
Inject(DelegationService)(DelegationController, undefined, 0);
Inject(ReturnService)(DelegationController, undefined, 1);
Controller("api/v1/continuity/delegations")(DelegationController);
UseGuards(ContinuityPolicyGuard)(DelegationController);
for (const [method, path, parameters] of [
  ["approve", "approve", [Req(), Body()]],
  ["confirm", "confirm", [Req(), Body()]],
  ["reportGap", "access-gaps", [Req(), Body()]],
  ["activate", ":delegationId/activate", [Req(), Param("delegationId")]],
  ["expire", ":delegationId/expire", [Req(), Param("delegationId")]],
  ["completeReturn", ":delegationId/return", [Req(), Param("delegationId"), Body()]],
] as const) {
  const descriptor = Object.getOwnPropertyDescriptor(DelegationController.prototype, method)!;
  parameters.forEach((parameter, index) =>
    parameter(DelegationController.prototype, method, index),
  );
  Post(path)(DelegationController.prototype, method, descriptor);
}
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
function correlation(request: ContinuityRequest) {
  return request.correlationId ?? crypto.randomUUID();
}
