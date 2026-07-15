import { Module } from "@nestjs/common";

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
  controllers: [HealthController],
  providers: [{ provide: READINESS_PROBES, useFactory: createEnvironmentReadinessProbes }],
})(AppModule);
