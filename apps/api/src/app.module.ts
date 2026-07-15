import { Module } from "@nestjs/common";

import { PermissionsModule } from "./permissions/permissions.module.js";
import { CorrelationMiddleware } from "./platform/correlation.middleware.js";
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
  imports: [PermissionsModule],
  controllers: [HealthController],
  providers: [{ provide: READINESS_PROBES, useFactory: createEnvironmentReadinessProbes }],
})(AppModule);
