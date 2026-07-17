import { Module } from "@nestjs/common";

import {
  AnalysisCriteriaWorkerLifecycle,
  AnalysisCriteriaWorkerModule,
} from "./analysis-criteria/analysis-criteria.module.js";
import {
  createWorkerEnvironmentReadinessProbes,
  WorkerHealthController,
  WORKER_READINESS_PROBES,
} from "./health/health.controller.js";
import { QueueModule } from "./queue/queue.module.js";

export class AppModule {}

Module({
  imports: [AnalysisCriteriaWorkerModule, QueueModule],
  controllers: [WorkerHealthController],
  providers: [
    {
      provide: WORKER_READINESS_PROBES,
      inject: [AnalysisCriteriaWorkerLifecycle],
      useFactory: createWorkerEnvironmentReadinessProbes,
    },
  ],
})(AppModule);
