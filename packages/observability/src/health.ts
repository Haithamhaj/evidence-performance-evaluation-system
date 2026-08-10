export type HealthCheckStatus = "up" | "down";
export type OperationalHealthState = "HEALTHY" | "DEGRADED" | "ACTION_REQUIRED";

export function combineOperationalHealthStates(
  states: readonly OperationalHealthState[],
): OperationalHealthState {
  if (states.includes("ACTION_REQUIRED")) return "ACTION_REQUIRED";
  if (states.includes("DEGRADED")) return "DEGRADED";
  return "HEALTHY";
}

export interface ReadinessProbes {
  readonly configuration: () => boolean | Promise<boolean>;
  readonly postgres: () => boolean | Promise<boolean>;
  readonly redis: () => boolean | Promise<boolean>;
}

export interface ReadinessResult {
  readonly status: "ready" | "not_ready";
  readonly checks: {
    readonly configuration: HealthCheckStatus;
    readonly postgres: HealthCheckStatus;
    readonly redis: HealthCheckStatus;
  };
}

async function runProbe(probe: () => boolean | Promise<boolean>): Promise<HealthCheckStatus> {
  try {
    return (await probe()) ? "up" : "down";
  } catch {
    return "down";
  }
}

export async function evaluateReadiness(probes: ReadinessProbes): Promise<ReadinessResult> {
  const [configuration, postgres, redis] = await Promise.all([
    runProbe(probes.configuration),
    runProbe(probes.postgres),
    runProbe(probes.redis),
  ]);
  const checks = { configuration, postgres, redis } as const;

  return {
    status: Object.values(checks).every((value) => value === "up") ? "ready" : "not_ready",
    checks,
  };
}
