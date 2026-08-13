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
import { CheckInService } from "@evaluation/updates-evidence";
import { ActivityReader } from "@evaluation/updates-evidence";
import { WorkItemQueryService } from "@evaluation/work-items";
import { ProjectService } from "@evaluation/projects";
import { WorkItemsPolicyGuard } from "../work-items/work-items-policy.guard.js";
import { WorkItemsModule } from "../work-items/work-items.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { UpdatesEvidenceModule } from "../updates-evidence/updates-evidence.module.js";
import { ExperienceOrchestrationController } from "./experience-orchestration.controller.js";
import { CaptureUnderstandingController } from "./capture-understanding.controller.js";
import { TaskAssistantController } from "./task-assistant.controller.js";
import {
  CAPTURE_UNDERSTANDING_ROUTE,
  CaptureUnderstandingService,
} from "./capture-understanding.service.js";
import {
  EXPERIENCE_PREPARE_ROUTE,
  ExperienceOrchestratorService,
} from "./experience-orchestrator.service.js";
import { PrismaPreparedExperiencePersistence } from "./prisma-prepared-experience.persistence.js";
import { CAPTURE_UNDERSTANDING, EXPERIENCE_ORCHESTRATOR } from "./tokens.js";
import { TASK_ASSISTANT } from "./tokens.js";
import { TASK_ASSISTANT_ROUTE, TaskAssistantService } from "./task-assistant.service.js";

type Database = ReturnType<typeof createDatabaseClient>;
const EXPERIENCE_ORCHESTRATION_DATABASE = Symbol("EXPERIENCE_ORCHESTRATION_DATABASE");
const EXPERIENCE_ORCHESTRATION_LIFECYCLE = Symbol("EXPERIENCE_ORCHESTRATION_LIFECYCLE");
export { ExperienceOrchestratorService } from "./experience-orchestrator.service.js";

export class ExperienceOrchestrationModule {}

Module({
  imports: [
    AuthModule,
    ContextIntelligenceModule,
    DailyWorkModule,
    WorkItemsModule,
    ProjectsModule,
    UpdatesEvidenceModule,
  ],
  controllers: [
    ExperienceOrchestrationController,
    CaptureUnderstandingController,
    TaskAssistantController,
  ],
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
        CheckInService,
      ],
      useFactory: async (
        database: Database,
        contextReview: import("../context-intelligence/context-analysis.controller.js").ContextIntelligenceWorkflow,
        dailyWork: DailyWorkQueryService,
        checkIns: CheckInService,
      ) =>
        new ExperienceOrchestratorService({
          contextReview: contextReview as never,
          dailyWork,
          checkIns,
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
    {
      provide: CAPTURE_UNDERSTANDING,
      inject: [EXPERIENCE_ORCHESTRATION_DATABASE, DailyWorkQueryService],
      useFactory: async (database: Database, dailyWork: DailyWorkQueryService) =>
        new CaptureUnderstandingService({
          context: dailyWork,
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
          systemId: await resolveSystemAiScopeId(database, CAPTURE_UNDERSTANDING_ROUTE),
          aiEnabled: process.env.CAPTURE_UNDERSTANDING_AI_ENABLED === "true",
        }),
    },
    {
      provide: TASK_ASSISTANT,
      inject: [
        EXPERIENCE_ORCHESTRATION_DATABASE,
        WorkItemQueryService,
        ProjectService,
        ActivityReader,
      ],
      useFactory: async (
        database: Database,
        workItems: WorkItemQueryService,
        projects: ProjectService,
        activity: ActivityReader,
      ) =>
        new TaskAssistantService({
          workItems,
          projects,
          activity,
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
          systemId: await resolveSystemAiScopeId(database, TASK_ASSISTANT_ROUTE),
          aiEnabled: process.env.TASK_ASSISTANT_AI_ENABLED === "true",
        }),
    },
    WorkItemsPolicyGuard,
  ],
})(ExperienceOrchestrationModule);
