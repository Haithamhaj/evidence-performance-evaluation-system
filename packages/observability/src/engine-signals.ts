export const ENGINE_SIGNAL_KINDS = Object.freeze([
  "API",
  "WORKER",
  "DATABASE",
  "REDIS",
  "OBJECT_STORAGE",
  "OIDC",
  "AI_ROUTE",
  "CONNECTOR",
  "NOTIFICATION",
  "EXPORT",
  "BACKUP",
  "AUTHORIZATION",
  "AUDIT",
] as const);

export type EngineSignalKind = (typeof ENGINE_SIGNAL_KINDS)[number];
export type EngineSignalState = "HEALTHY" | "DEGRADED" | "ACTION_REQUIRED";
const ALLOWED_LABELS = new Set(["route", "provider", "channel", "operation", "dependency"]);

export interface EngineSignal {
  readonly schemaVersion: 1;
  readonly kind: EngineSignalKind;
  readonly state: EngineSignalState;
  readonly observedAt: string;
  readonly correlationId: string;
  readonly latencyMs?: number;
  readonly ageSeconds?: number;
  readonly failureCount: number;
  readonly labels: Readonly<Record<string, string>>;
}

export function createEngineSignal(
  input: Omit<EngineSignal, "schemaVersion" | "labels" | "failureCount"> &
    Readonly<{
      labels?: Readonly<Record<string, string>>;
      failureCount?: number;
    }>,
): EngineSignal {
  if (!ENGINE_SIGNAL_KINDS.includes(input.kind)) throw new TypeError("unsupported engine signal");
  const labels = Object.fromEntries(
    Object.entries(input.labels ?? {})
      .filter(([key, value]) => ALLOWED_LABELS.has(key) && value.length > 0)
      .map(([key, value]) => [key, value.slice(0, 100)]),
  );
  return {
    schemaVersion: 1,
    kind: input.kind,
    state: input.state,
    observedAt: input.observedAt,
    correlationId: input.correlationId,
    ...(input.latencyMs === undefined ? {} : { latencyMs: Math.max(0, input.latencyMs) }),
    ...(input.ageSeconds === undefined ? {} : { ageSeconds: Math.max(0, input.ageSeconds) }),
    failureCount: Math.max(0, input.failureCount ?? 0),
    labels,
  };
}
