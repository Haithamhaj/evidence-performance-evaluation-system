/* eslint-disable no-unused-vars */
import { OffboardingService } from "@evaluation/continuity";
import { Body, Controller, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ContinuityPolicyGuard, type ContinuityRequest } from "./continuity-policy.guard.js";

export class ReassignmentController {
  constructor(private readonly service: OffboardingService) {}
  deactivate(request: ContinuityRequest, userId: string, body: unknown) {
    return this.service.deactivate({
      ...object(body),
      userId,
      administratorId: request.principal!.userId,
      correlationId: correlation(request),
    });
  }
  resolve(request: ContinuityRequest, caseId: string, body: unknown) {
    return this.service.resolve({
      ...object(body),
      caseId,
      actorId: request.principal!.userId,
      correlationId: correlation(request),
    });
  }
}
Inject(OffboardingService)(ReassignmentController, undefined, 0);
Controller("api/v1/continuity")(ReassignmentController);
UseGuards(ContinuityPolicyGuard)(ReassignmentController);
let descriptor = Object.getOwnPropertyDescriptor(ReassignmentController.prototype, "deactivate")!;
Req()(ReassignmentController.prototype, "deactivate", 0);
Param("userId")(ReassignmentController.prototype, "deactivate", 1);
Body()(ReassignmentController.prototype, "deactivate", 2);
Post("users/:userId/deactivate")(ReassignmentController.prototype, "deactivate", descriptor);
descriptor = Object.getOwnPropertyDescriptor(ReassignmentController.prototype, "resolve")!;
Req()(ReassignmentController.prototype, "resolve", 0);
Param("caseId")(ReassignmentController.prototype, "resolve", 1);
Body()(ReassignmentController.prototype, "resolve", 2);
Post("reassignments/:caseId/resolve")(ReassignmentController.prototype, "resolve", descriptor);
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
function correlation(request: ContinuityRequest) {
  return request.correlationId ?? crypto.randomUUID();
}
