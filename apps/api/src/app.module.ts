import { Module } from "@nestjs/common";

import { AuditModule } from "./audit/audit.module.js";
import { AnalysisCriteriaModule } from "./analysis-criteria/analysis-criteria.module.js";
import { AiRoutingModule } from "./ai-routing/ai-routing.module.js";
import { ConnectedWorkContextModule } from "./connected-work-context/connected-work-context.module.js";
import { ContextIntelligenceModule } from "./context-intelligence/context-intelligence.module.js";
import { PermissionsModule } from "./permissions/permissions.module.js";
import { ProjectsModule } from "./projects/projects.module.js";
import { EvaluationEligibilityModule } from "./evaluation-eligibility/evaluation-eligibility.module.js";
import { CorrelationMiddleware } from "./platform/correlation.middleware.js";
import { DocumentsModule } from "./documents/documents.module.js";
import { DailyWorkModule } from "./daily-work/daily-work.module.js";
import { WorkItemsModule } from "./work-items/work-items.module.js";
import { UpdatesEvidenceModule } from "./updates-evidence/updates-evidence.module.js";
import {
  createEnvironmentReadinessProbes,
  HealthController,
  READINESS_PROBES,
} from "./platform/health.controller.js";

export class AppModule {
  configure(consumer: import("@nestjs/common").MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes("*");
  }
}

Module({
  imports: [
    AnalysisCriteriaModule,
    AiRoutingModule,
    AuditModule,
    ConnectedWorkContextModule,
    ContextIntelligenceModule,
    DocumentsModule,
    DailyWorkModule,
    EvaluationEligibilityModule,
    PermissionsModule,
    ProjectsModule,
    WorkItemsModule,
    UpdatesEvidenceModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: READINESS_PROBES, useFactory: createEnvironmentReadinessProbes }],
})(AppModule);
