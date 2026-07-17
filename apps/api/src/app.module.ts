import { Module } from "@nestjs/common";

import { AuditModule } from "./audit/audit.module.js";
import { AiRoutingModule } from "./ai-routing/ai-routing.module.js";
import { PermissionsModule } from "./permissions/permissions.module.js";
import { ProjectsModule } from "./projects/projects.module.js";
import { EvaluationEligibilityModule } from "./evaluation-eligibility/evaluation-eligibility.module.js";
import { CorrelationMiddleware } from "./platform/correlation.middleware.js";
import { DocumentsModule } from "./documents/documents.module.js";
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
    AiRoutingModule,
    AuditModule,
    DocumentsModule,
    EvaluationEligibilityModule,
    PermissionsModule,
    ProjectsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: READINESS_PROBES, useFactory: createEnvironmentReadinessProbes }],
})(AppModule);
