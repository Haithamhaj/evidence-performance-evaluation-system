import { connect } from "node:net";

import { Controller, Get, Inject } from "@nestjs/common";

import { evaluateReadiness } from "@evaluation/observability";

type ReadinessProbes = import("@evaluation/observability").ReadinessProbes;

export const READINESS_PROBES = Symbol("READINESS_PROBES");

function probeTcpUrl(value: string | undefined, defaultPort: number): Promise<boolean> {
  if (value === undefined || value.length === 0) return Promise.resolve(false);

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const socket = connect({ host: url.hostname, port: Number(url.port || defaultPort) });
    const finish = (available: boolean) => {
      socket.destroy();
      resolve(available);
    };

    socket.setTimeout(1_000);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
}

export function createEnvironmentReadinessProbes(): ReadinessProbes {
  return {
    configuration: () => Boolean(process.env.DATABASE_URL?.length && process.env.REDIS_URL?.length),
    postgres: () => probeTcpUrl(process.env.DATABASE_URL, 5432),
    redis: () => probeTcpUrl(process.env.REDIS_URL, 6379),
  };
}

export class HealthController {
  private readonly probes: ReadinessProbes;

  constructor(probes: ReadinessProbes) {
    this.probes = probes;
  }

  live(): { readonly status: "live" } {
    return { status: "live" };
  }

  async ready() {
    return evaluateReadiness(this.probes);
  }
}

Inject(READINESS_PROBES)(HealthController, undefined, 0);
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
