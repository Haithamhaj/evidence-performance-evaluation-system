import { Module } from "@nestjs/common";

import { AuthModule } from "./auth/auth.module.js";
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
  imports: [AuthModule, PermissionsModule],
  controllers: [HealthController],
  providers: [{ provide: READINESS_PROBES, useFactory: createEnvironmentReadinessProbes }],
})(AppModule);
