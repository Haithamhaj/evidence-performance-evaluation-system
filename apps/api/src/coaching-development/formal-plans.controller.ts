/* eslint-disable no-unused-vars */
import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { FormalDevelopmentPlanService } from "@evaluation/coaching-development";
import { CoachingPolicyGuard, type CoachingRequest } from "./coaching-policy.guard.js";
export class CoachingFormalPlansController {
  constructor(private readonly plans: FormalDevelopmentPlanService) {}
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
}
Controller("api/v1/coaching/formal-plans")(CoachingFormalPlansController);
UseGuards(CoachingPolicyGuard)(CoachingFormalPlansController);
for (const [name, path] of [
  ["approve", "approve"],
  ["agree", "agree"],
  ["activate", "activate"],
] as const) {
  const descriptor = Object.getOwnPropertyDescriptor(
    CoachingFormalPlansController.prototype,
    name,
  )!;
  Req()(CoachingFormalPlansController.prototype, name, 0);
  Body()(CoachingFormalPlansController.prototype, name, 1);
  Post(path)(CoachingFormalPlansController.prototype, name, descriptor);
}
