import { Controller, Get, HttpStatus, Inject, Res } from "@nestjs/common";
import { Client } from "pg";
import { createClient } from "redis";

import { evaluateReadiness } from "@evaluation/observability";

type ReadinessProbes = import("@evaluation/observability").ReadinessProbes;

export const READINESS_PROBES = Symbol("READINESS_PROBES");

interface PassthroughResponse {
  status(statusCode: number): unknown;
}

export interface ProtocolReadinessOptions {
  readonly databaseUrl: string | undefined;
  readonly redisUrl: string | undefined;
  readonly timeoutMs?: number;
}

function hasAllowedProtocol(value: string | undefined, protocols: ReadonlySet<string>): boolean {
  if (value === undefined || value.length === 0) return false;

  try {
    return protocols.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

async function withTimeout<Result>(operation: Promise<Result>, timeoutMs: number): Promise<Result> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("readiness probe timed out")), timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function probePostgres(connectionString: string, timeoutMs: number): Promise<boolean> {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: timeoutMs,
    query_timeout: timeoutMs,
    statement_timeout: timeoutMs,
  });

  try {
    await withTimeout(client.connect(), timeoutMs);
    const result = await withTimeout(
      client.query<{ health: number }>("SELECT 1 AS health"),
      timeoutMs,
    );
    return result.rows[0]?.health === 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function probeRedis(connectionUrl: string, timeoutMs: number): Promise<boolean> {
  const client = createClient({
    url: connectionUrl,
    socket: { connectTimeout: timeoutMs, reconnectStrategy: false },
  });
  client.on("error", () => undefined);

  try {
    await withTimeout(client.connect(), timeoutMs);
    return (await withTimeout(client.ping(), timeoutMs)) === "PONG";
  } finally {
    if (client.isOpen) client.destroy();
  }
}

export function createProtocolReadinessProbes(options: ProtocolReadinessOptions): ReadinessProbes {
  const timeoutMs = options.timeoutMs ?? 1_000;
  const postgresConfigured = hasAllowedProtocol(
    options.databaseUrl,
    new Set(["postgres:", "postgresql:"]),
  );
  const redisConfigured = hasAllowedProtocol(options.redisUrl, new Set(["redis:", "rediss:"]));

  return {
    configuration: () => postgresConfigured && redisConfigured,
    postgres: () =>
      postgresConfigured && options.databaseUrl !== undefined
        ? probePostgres(options.databaseUrl, timeoutMs)
        : false,
    redis: () =>
      redisConfigured && options.redisUrl !== undefined
        ? probeRedis(options.redisUrl, timeoutMs)
        : false,
  };
}

export function createEnvironmentReadinessProbes(): ReadinessProbes {
  return createProtocolReadinessProbes({
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
  });
}

export class HealthController {
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

Inject(READINESS_PROBES)(HealthController, undefined, 0);
Res({ passthrough: true })(HealthController.prototype, "ready", 0);
Controller("health")(HealthController);
Get("live")(
  HealthController.prototype,
  "live",
  Object.getOwnPropertyDescriptor(HealthController.prototype, "live")!,
);
Get("ready")(
  HealthController.prototype,
  "ready",
  Object.getOwnPropertyDescriptor(HealthController.prototype, "ready")!,
);
