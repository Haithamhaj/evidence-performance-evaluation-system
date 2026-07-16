import { Module } from "@nestjs/common";

import {
  createWorkerEnvironmentReadinessProbes,
  WorkerHealthController,
  WORKER_READINESS_PROBES,
} from "./health/health.controller.js";
import { QueueModule } from "./queue/queue.module.js";

export class AppModule {}

Module({
  imports: [QueueModule],
  controllers: [WorkerHealthController],
  providers: [
    { provide: WORKER_READINESS_PROBES, useFactory: createWorkerEnvironmentReadinessProbes },
  ],
})(AppModule);
