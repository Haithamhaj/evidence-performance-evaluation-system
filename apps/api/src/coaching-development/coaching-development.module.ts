/* eslint-disable no-unused-vars */
import { createDatabaseClient } from "@evaluation/database";
import {
  CoachingInsightService,
  DevelopmentActionService,
  FormalDevelopmentPlanService,
  ManagerSupportService,
} from "@evaluation/coaching-development";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { CoachingActionsController } from "./actions.controller.js";
import { CoachingFormalPlansController } from "./formal-plans.controller.js";
import { CoachingInsightsController } from "./insights.controller.js";
import {
  COACHING_DEVELOPMENT_POLICY_DATABASE,
  CoachingPolicyGuard,
} from "./coaching-policy.guard.js";

export const COACHING_DEVELOPMENT_DATABASE = Symbol("COACHING_DEVELOPMENT_DATABASE");
type Database = ReturnType<typeof createDatabaseClient>;
class ApiCoachingStore {
  constructor(private readonly database: Database) {}
  async createInsight(input: Record<string, unknown>) {
    return input;
  }
  async findInsight(id: string) {
    const value = await this.database.coachingInsight.findUnique({ where: { id } });
    return value as unknown as Record<string, unknown> | null;
  }
  async appendInsightDecision(input: Record<string, unknown>) {
    await this.database.$transaction(async (transaction) => {
      const insight = await transaction.coachingInsight.findUnique({
        where: { id: String(input.insightId) },
      });
      if (!insight || insight.version !== Number(input.expectedVersion))
        throw new Error("VERSION_CONFLICT");
      await transaction.coachingInsightDecision.create({
        data: {
          idempotencyKey: String(input.idempotencyKey),
          insightId: insight.id,
          employeeId: String(input.employeeId),
          decision: input.decision as never,
          privateReason: (input.privateReason as string | null | undefined) ?? null,
          personalNote: (input.personalNote as string | null | undefined) ?? null,
          resultingVersion: insight.version + 1,
        },
      });
      await transaction.coachingInsight.update({
        where: { id: insight.id },
        data: { state: "DECIDED", version: { increment: 1 } },
      });
    });
  }
  async find(actionId: string) {
    const value = await this.database.developmentAction.findUnique({ where: { id: actionId } });
    return value as unknown as {
      id: string;
      employeeId: string;
      privacy: "PRIVATE" | "SHARED";
      state: string;
      version: number;
    } | null;
  }
  async append(event: Record<string, unknown>) {
    const action = await this.database.developmentAction.findUnique({
      where: { id: String(event.actionId) },
    });
    if (!action) return;
    if ("toState" in event)
      await this.database.developmentAction.update({
        where: { id: action.id },
        data: { state: event.toState as never, version: { increment: 1 } },
      });
  }
  async findPlan(planId: string) {
    const value = await this.database.formalDevelopmentPlan.findUnique({
      where: { id: planId },
      include: { evidenceLinks: true },
    });
    return value as unknown as {
      id: string;
      employeeId: string;
      managerId: string;
      state: string;
      version: number;
      evidenceLinks: readonly { confirmed: boolean }[];
    } | null;
  }
  async appendPlan(event: Record<string, unknown>) {
    const plan = await this.database.formalDevelopmentPlan.findUnique({
      where: { id: String(event.planId) },
    });
    if (plan && "toState" in event)
      await this.database.formalDevelopmentPlan.update({
        where: { id: plan.id },
        data: { state: event.toState as never, version: { increment: 1 } },
      });
  }
}
export class CoachingDevelopmentModule {}
Module({
  imports: [AuthModule],
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
      provide: ApiCoachingStore,
      useFactory: (database: Database) => new ApiCoachingStore(database),
      inject: [COACHING_DEVELOPMENT_DATABASE],
    },
    {
      provide: CoachingInsightService,
      useFactory: (store: ApiCoachingStore) => new CoachingInsightService(store),
      inject: [ApiCoachingStore],
    },
    {
      provide: DevelopmentActionService,
      useFactory: (store: ApiCoachingStore) => new DevelopmentActionService(store),
      inject: [ApiCoachingStore],
    },
    {
      provide: ManagerSupportService,
      useFactory: (store: ApiCoachingStore) => new ManagerSupportService(store),
      inject: [ApiCoachingStore],
    },
    {
      provide: FormalDevelopmentPlanService,
      useFactory: (store: ApiCoachingStore) =>
        new FormalDevelopmentPlanService({
          find: (id) => store.findPlan(id),
          append: (event) => store.appendPlan(event),
        }),
      inject: [ApiCoachingStore],
    },
    CoachingPolicyGuard,
  ],
})(CoachingDevelopmentModule);
function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL must be configured");
  return value;
}
