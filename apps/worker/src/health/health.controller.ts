import { Controller, Get, HttpStatus, Inject, Res } from "@nestjs/common";
import { Queue } from "bullmq";

import { createDatabaseClient } from "@evaluation/database";
import { evaluateReadiness } from "@evaluation/observability";

import { redisConnection } from "../queue/queue.module.js";

export const WORKER_READINESS_PROBES = Symbol("WORKER_READINESS_PROBES");
type ReadinessProbes = import("@evaluation/observability").ReadinessProbes;

interface PassthroughResponse {
  status(statusCode: number): unknown;
}

function hasAllowedProtocol(value: string | undefined, protocols: ReadonlySet<string>): boolean {
  if (value === undefined || value.length === 0) return false;
  try {
    return protocols.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function createWorkerEnvironmentReadinessProbes(
  analysisRuntime: Readonly<{ isHealthy(): boolean }> = { isHealthy: () => true },
  environment: Readonly<Record<string, string | undefined>> = process.env,
): ReadinessProbes {
  const databaseUrl = environment.DATABASE_URL;
  const redisUrl = environment.REDIS_URL;
  const postgresConfigured = hasAllowedProtocol(databaseUrl, new Set(["postgres:", "postgresql:"]));
  const redisConfigured = hasAllowedProtocol(redisUrl, new Set(["redis:", "rediss:"]));

  return {
    configuration: () => postgresConfigured && redisConfigured && analysisRuntime.isHealthy(),
    postgres: async () => {
      if (!postgresConfigured || databaseUrl === undefined) return false;
      const database = createDatabaseClient(databaseUrl);
      try {
        const rows = await database.$queryRaw<Array<{ health: number }>>`SELECT 1 AS health`;
        return rows[0]?.health === 1;
      } finally {
        await database.$disconnect();
      }
    },
    redis: async () => {
      if (!redisConfigured || redisUrl === undefined) return false;
      const queue = new Queue("worker-health", { connection: redisConnection(redisUrl) });
      try {
        await queue.waitUntilReady();
        await queue.getJobCounts();
        return true;
      } finally {
        await queue.close();
      }
    },
  };
}

export class WorkerHealthController {
  private readonly probes: ReadinessProbes;

  constructor(probes: ReadinessProbes) {
    this.probes = probes;
  }

  live(): { readonly status: "live" } {
    return { status: "live" };
  }

  async ready(response: PassthroughResponse) {
    const result = await evaluateReadiness(this.probes);
    response.status(result.status === "ready" ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}

Inject(WORKER_READINESS_PROBES)(WorkerHealthController, undefined, 0);
Res({ passthrough: true })(WorkerHealthController.prototype, "ready", 0);
Controller("health")(WorkerHealthController);
Get("live")(
  WorkerHealthController.prototype,
  "live",
  Object.getOwnPropertyDescriptor(WorkerHealthController.prototype, "live")!,
);
Get("ready")(
  WorkerHealthController.prototype,
  "ready",
  Object.getOwnPropertyDescriptor(WorkerHealthController.prototype, "ready")!,
);
