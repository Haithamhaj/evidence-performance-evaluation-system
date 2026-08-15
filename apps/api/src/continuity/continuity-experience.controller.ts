/* eslint-disable no-unused-vars */
import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";

import { ContinuityExperienceQueryService } from "./continuity-experience-query.service.js";
import { ContinuityPolicyGuard, type ContinuityRequest } from "./continuity-policy.guard.js";

export class ContinuityExperienceController {
  constructor(private readonly query: ContinuityExperienceQueryService) {}

  view(request: ContinuityRequest) {
    return this.query.load(request.principal!.userId);
  }
}

Inject(ContinuityExperienceQueryService)(ContinuityExperienceController, undefined, 0);
Controller("api/v1/continuity/experience")(ContinuityExperienceController);
UseGuards(ContinuityPolicyGuard)(ContinuityExperienceController);
const descriptor = Object.getOwnPropertyDescriptor(
  ContinuityExperienceController.prototype,
  "view",
)!;
Req()(ContinuityExperienceController.prototype, "view", 0);
Get()(ContinuityExperienceController.prototype, "view", descriptor);
