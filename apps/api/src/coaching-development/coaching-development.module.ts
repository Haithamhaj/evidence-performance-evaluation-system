import { createDatabaseClient } from "@evaluation/database";
import { databaseAuditWriter } from "@evaluation/audit";
import {
  CoachingDevelopmentPersistence,
  CoachingInsightService,
  DevelopmentActionService,
  FormalDevelopmentPlanService,
  ManagerSupportService,
} from "@evaluation/coaching-development";
import { Module } from "@nestjs/common";
import { EvaluationFactViewService } from "@evaluation/evaluation-preparation";

import { AuthModule } from "../auth/auth.module.js";
import { EvaluationPreparationModule } from "../evaluation-preparation/evaluation-preparation.module.js";
import { ApiCoachingInsightDraftService } from "./api-coaching-insight-draft.service.js";
import { CoachingActionsController } from "./actions.controller.js";
import { CoachingFormalPlansController } from "./formal-plans.controller.js";
import { CoachingInsightsController } from "./insights.controller.js";
import {
  COACHING_DEVELOPMENT_POLICY_DATABASE,
  CoachingPolicyGuard,
} from "./coaching-policy.guard.js";

export const COACHING_DEVELOPMENT_DATABASE = Symbol("COACHING_DEVELOPMENT_DATABASE");
type Database = ReturnType<typeof createDatabaseClient>;
export class CoachingDevelopmentModule {}
Module({
  imports: [AuthModule, EvaluationPreparationModule],
  controllers: [
    CoachingInsightsController,
    CoachingActionsController,
    CoachingFormalPlansController,
  ],
  providers: [
    {
      provide: COACHING_DEVELOPMENT_DATABASE,
      useFactory: () => createDatabaseClient(databaseUrl()),
    },
    { provide: COACHING_DEVELOPMENT_POLICY_DATABASE, useExisting: COACHING_DEVELOPMENT_DATABASE },
    {
      provide: CoachingDevelopmentPersistence,
      useFactory: (database: Database) =>
        new CoachingDevelopmentPersistence(database, databaseAuditWriter as never),
      inject: [COACHING_DEVELOPMENT_DATABASE],
    },
    {
      provide: CoachingInsightService,
      useFactory: (store: CoachingDevelopmentPersistence) => new CoachingInsightService(store),
      inject: [CoachingDevelopmentPersistence],
    },
    {
      provide: ApiCoachingInsightDraftService,
      useFactory: (
        database: Database,
        facts: EvaluationFactViewService,
        persistence: CoachingDevelopmentPersistence,
      ) => new ApiCoachingInsightDraftService(database, facts, persistence),
      inject: [
        COACHING_DEVELOPMENT_DATABASE,
        EvaluationFactViewService,
        CoachingDevelopmentPersistence,
      ],
    },
    {
      provide: DevelopmentActionService,
      useFactory: (store: CoachingDevelopmentPersistence) => new DevelopmentActionService(store),
      inject: [CoachingDevelopmentPersistence],
    },
    {
      provide: ManagerSupportService,
      useFactory: (store: CoachingDevelopmentPersistence) =>
        new ManagerSupportService({
          find: (id) => store.find(id),
          isAuthorizedManager: (employeeId, managerId) =>
            store.isAuthorizedManager(employeeId, managerId),
          append: (entry) => store.appendSupport(entry),
          auditRead: (event) => store.auditRead(event),
        }),
      inject: [CoachingDevelopmentPersistence],
    },
    {
      provide: FormalDevelopmentPlanService,
      useFactory: (store: CoachingDevelopmentPersistence) =>
        new FormalDevelopmentPlanService({
          find: (id) => store.findPlan(id),
          append: (event) => store.appendPlan(event),
          create: (event) => store.createPlan(event),
          revise: (event) => store.revisePlan(event),
          linkEvidence: (event) => store.linkPlanEvidence(event),
          auditRead: (event) => store.auditRead(event),
          findIdempotentPlan: (key) => store.findIdempotentPlan(key),
        }),
      inject: [CoachingDevelopmentPersistence],
    },
    CoachingPolicyGuard,
  ],
})(CoachingDevelopmentModule);
function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL must be configured");
  return value;
}
