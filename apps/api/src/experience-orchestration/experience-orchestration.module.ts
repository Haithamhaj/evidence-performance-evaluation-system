import {
  createRuntimeAiRouter,
  EnvironmentAiCredentialSecretResolver,
} from "@evaluation/ai-routing";
import { createDatabaseClient } from "@evaluation/database";
import { Module } from "@nestjs/common";

import { createDeferredRuntimeAiRouter } from "../ai-routing/deferred-runtime-ai-router.js";
import { resolveSystemAiScopeId } from "../ai-routing/system-ai-scope.js";
import { AuthModule } from "../auth/auth.module.js";
import { CONTEXT_INTELLIGENCE_WORKFLOW } from "../context-intelligence/context-analysis.controller.js";
import { ContextIntelligenceModule } from "../context-intelligence/context-intelligence.module.js";
import { DailyWorkQueryService } from "../daily-work/daily-work-query.service.js";
import { DailyWorkModule } from "../daily-work/daily-work.module.js";
import { WorkItemsPolicyGuard } from "../work-items/work-items-policy.guard.js";
import { ExperienceOrchestrationController } from "./experience-orchestration.controller.js";
import {
  EXPERIENCE_PREPARE_ROUTE,
  ExperienceOrchestratorService,
} from "./experience-orchestrator.service.js";
import { PrismaPreparedExperiencePersistence } from "./prisma-prepared-experience.persistence.js";
import { EXPERIENCE_ORCHESTRATOR } from "./tokens.js";

type Database = ReturnType<typeof createDatabaseClient>;
const EXPERIENCE_ORCHESTRATION_DATABASE = Symbol("EXPERIENCE_ORCHESTRATION_DATABASE");
const EXPERIENCE_ORCHESTRATION_LIFECYCLE = Symbol("EXPERIENCE_ORCHESTRATION_LIFECYCLE");
export { ExperienceOrchestratorService } from "./experience-orchestrator.service.js";

export class ExperienceOrchestrationModule {}

Module({
  imports: [AuthModule, ContextIntelligenceModule, DailyWorkModule],
  controllers: [ExperienceOrchestrationController],
  providers: [
    {
      provide: EXPERIENCE_ORCHESTRATION_DATABASE,
      useFactory: () => {
        const url = process.env.DATABASE_URL?.trim();
        if (!url) throw new Error("DATABASE_URL must be configured");
        return createDatabaseClient(url);
      },
    },
    {
      provide: EXPERIENCE_ORCHESTRATION_LIFECYCLE,
      inject: [EXPERIENCE_ORCHESTRATION_DATABASE],
      useFactory: (database: Database) => ({ onModuleDestroy: () => database.$disconnect() }),
    },
    {
      provide: EXPERIENCE_ORCHESTRATOR,
      inject: [
        EXPERIENCE_ORCHESTRATION_DATABASE,
        CONTEXT_INTELLIGENCE_WORKFLOW,
        DailyWorkQueryService,
      ],
      useFactory: async (
        database: Database,
        contextReview: import("../context-intelligence/context-analysis.controller.js").ContextIntelligenceWorkflow,
        dailyWork: DailyWorkQueryService,
      ) =>
        new ExperienceOrchestratorService({
          contextReview: contextReview as never,
          dailyWork,
          persistence: new PrismaPreparedExperiencePersistence(database),
          router: createDeferredRuntimeAiRouter(() =>
            createRuntimeAiRouter({
              database,
              secretResolver: new EnvironmentAiCredentialSecretResolver(),
            }),
          ),
          promptArtifacts: {
            read: (routeKey, version) =>
              database.analysisPromptArtifact.findUnique({
                where: { routeKey_version: { routeKey, version } },
                select: {
                  id: true,
                  routeKey: true,
                  version: true,
                  bodyHash: true,
                  trustedBody: true,
                },
              }),
          },
          systemId: await resolveSystemAiScopeId(database, EXPERIENCE_PREPARE_ROUTE),
          aiEnabled: process.env.EXPERIENCE_ORCHESTRATOR_AI_ENABLED === "true",
        }),
    },
    WorkItemsPolicyGuard,
  ],
})(ExperienceOrchestrationModule);
