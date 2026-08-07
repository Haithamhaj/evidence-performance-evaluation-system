/* eslint-disable no-unused-vars */
import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { FormalDevelopmentPlanService } from "@evaluation/coaching-development";
import { CoachingPolicyGuard, type CoachingRequest } from "./coaching-policy.guard.js";
export class CoachingFormalPlansController {
  constructor(private readonly plans: FormalDevelopmentPlanService) {}
  create(request: CoachingRequest, body: Record<string, unknown>) {
    return this.plans.create({ ...body, employeeId: request.principal!.userId });
  }
  approve(request: CoachingRequest, body: Record<string, unknown>) {
    return this.plans.approve({
      ...(body as { planId: string; expectedVersion: number; idempotencyKey: string }),
      actorId: request.principal!.userId,
    });
  }
  agree(request: CoachingRequest, body: Record<string, unknown>) {
    return this.plans.agree({
      ...(body as { planId: string; expectedVersion: number; idempotencyKey: string }),
      actorId: request.principal!.userId,
    });
  }
  activate(request: CoachingRequest, body: Record<string, unknown>) {
    return this.plans.activate({
      ...(body as { planId: string; expectedVersion: number; idempotencyKey: string }),
      actorId: request.principal!.userId,
    });
  }
  linkEvidence(request: CoachingRequest, body: Record<string, unknown>) {
    return this.plans.linkEvidence({ ...body, employeeId: request.principal!.userId });
  }
  complete(request: CoachingRequest, body: Record<string, unknown>) {
    return this.plans.complete({
      ...(body as { planId: string; expectedVersion: number; idempotencyKey: string }),
      actorId: request.principal!.userId,
    });
  }
}
Controller("api/v1/coaching/formal-plans")(CoachingFormalPlansController);
UseGuards(CoachingPolicyGuard)(CoachingFormalPlansController);
for (const [name, path] of [
  ["create", ""],
  ["approve", "approve"],
  ["agree", "agree"],
  ["activate", "activate"],
  ["linkEvidence", "evidence"],
  ["complete", "complete"],
] as const) {
  const descriptor = Object.getOwnPropertyDescriptor(
    CoachingFormalPlansController.prototype,
    name,
  )!;
  Req()(CoachingFormalPlansController.prototype, name, 0);
  Body()(CoachingFormalPlansController.prototype, name, 1);
  Post(path)(CoachingFormalPlansController.prototype, name, descriptor);
}
