/* eslint-disable no-unused-vars */
import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";

import { CoachingPolicyGuard, type CoachingRequest } from "./coaching-policy.guard.js";
import { ManagerCoachingQueryService } from "./manager-coaching-query.service.js";

export class ManagerCoachingController {
  constructor(private readonly query: ManagerCoachingQueryService) {}

  view(request: CoachingRequest) {
    return this.query.load(request.principal!.userId);
  }
}

Inject(ManagerCoachingQueryService)(ManagerCoachingController, undefined, 0);
Controller("api/v1/coaching/manager-view")(ManagerCoachingController);
UseGuards(CoachingPolicyGuard)(ManagerCoachingController);
const descriptor = Object.getOwnPropertyDescriptor(ManagerCoachingController.prototype, "view")!;
Req()(ManagerCoachingController.prototype, "view", 0);
Get()(ManagerCoachingController.prototype, "view", descriptor);
