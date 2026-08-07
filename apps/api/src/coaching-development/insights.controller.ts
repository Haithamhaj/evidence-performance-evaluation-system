/* eslint-disable no-unused-vars */
import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { CoachingInsightService } from "@evaluation/coaching-development";

import { CoachingPolicyGuard, type CoachingRequest } from "./coaching-policy.guard.js";
import { ApiCoachingInsightDraftService } from "./api-coaching-insight-draft.service.js";
export class CoachingInsightsController {
  constructor(
    private readonly insights: CoachingInsightService,
    private readonly drafts: ApiCoachingInsightDraftService,
  ) {}
  draft(request: CoachingRequest, body: { assignmentId?: string }) {
    return this.drafts.draft({
      actorId: request.principal!.userId,
      assignmentId: String(body.assignmentId ?? ""),
    });
  }
  read(request: CoachingRequest, insightId: string) {
    return this.insights.read({ insightId, actorId: request.principal!.userId });
  }
  decide(request: CoachingRequest, body: unknown) {
    return this.insights.decide({ ...(body as object), employeeId: request.principal!.userId });
  }
}
Controller("api/v1/coaching/insights")(CoachingInsightsController);
UseGuards(CoachingPolicyGuard)(CoachingInsightsController);
let descriptor = Object.getOwnPropertyDescriptor(CoachingInsightsController.prototype, "read")!;
Req()(CoachingInsightsController.prototype, "read", 0);
Param("insightId")(CoachingInsightsController.prototype, "read", 1);
Get(":insightId")(CoachingInsightsController.prototype, "read", descriptor);
descriptor = Object.getOwnPropertyDescriptor(CoachingInsightsController.prototype, "decide")!;
Req()(CoachingInsightsController.prototype, "decide", 0);
Body()(CoachingInsightsController.prototype, "decide", 1);
Post("decide")(CoachingInsightsController.prototype, "decide", descriptor);
descriptor = Object.getOwnPropertyDescriptor(CoachingInsightsController.prototype, "draft")!;
Req()(CoachingInsightsController.prototype, "draft", 0);
Body()(CoachingInsightsController.prototype, "draft", 1);
Post("draft")(CoachingInsightsController.prototype, "draft", descriptor);
