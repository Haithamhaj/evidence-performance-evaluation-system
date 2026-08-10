import { randomUUID } from "node:crypto";

import { AdminHealthStateSchema } from "@evaluation/contracts";
import {
  combineOperationalHealthStates,
  createEngineSignal,
  evaluateEngineAlerts,
} from "@evaluation/observability";

const SIGNAL_KIND_BY_DEPENDENCY: Readonly<
  Record<string, import("@evaluation/observability").EngineSignalKind>
> = {
  API: "API",
  WORKER: "WORKER",
  DATABASE: "DATABASE",
  QUEUE: "REDIS",
  OBJECT_STORAGE: "OBJECT_STORAGE",
  OIDC: "OIDC",
  AI_ROUTE: "AI_ROUTE",
  CONNECTOR: "CONNECTOR",
  EMAIL: "NOTIFICATION",
  BACKUP: "BACKUP",
};

const DEFAULT_ALERT_POLICY = {
  schemaVersion: 1 as const,
  version: 1,
  maxBackupAgeSeconds: 86_400,
  maxFailureCount: 1,
};

export class AdminHealthComposition {
  private readonly probes: readonly import("./ports.js").AdminHealthProbe[];
  private readonly now: () => Date;

  constructor(
    probes: readonly import("./ports.js").AdminHealthProbe[],
    now: () => Date = () => new Date(),
  ) {
    this.probes = probes;
    this.now = now;
  }

  async read(options: Readonly<{ cursor?: number; limit?: number }> = {}) {
    const cursor = Math.max(options.cursor ?? 0, 0);
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const selected = this.probes.slice(cursor, cursor + limit);
    const checkedAt = this.now();
    const dependencies = await Promise.all(
      selected.map(async (probe) => {
        let state: "HEALTHY" | "DEGRADED" | "ACTION_REQUIRED" = "ACTION_REQUIRED";
        let nextActionKey: string | null = "admin.health.inspectDependency";
        try {
          const result = await probe.check();
          state = AdminHealthStateSchema.parse(result.state);
          nextActionKey =
            typeof result.nextActionKey === "string" && result.nextActionKey.length > 0
              ? result.nextActionKey.slice(0, 100)
              : null;
        } catch {
          // The bounded result intentionally excludes provider errors and raw logs.
        }
        return {
          dependency: probe.dependency,
          state,
          checkedAt: checkedAt.toISOString(),
          nextActionKey,
          correlationId: randomUUID(),
        };
      }),
    );
    const signals = dependencies.map((dependency) =>
      createEngineSignal({
        kind: SIGNAL_KIND_BY_DEPENDENCY[dependency.dependency]!,
        state: dependency.state,
        observedAt: dependency.checkedAt,
        correlationId: dependency.correlationId,
        failureCount: dependency.state === "ACTION_REQUIRED" ? 1 : 0,
        labels: { dependency: dependency.dependency },
      }),
    );
    return {
      schemaVersion: 1 as const,
      state: combineOperationalHealthStates(dependencies.map(({ state }) => state)),
      dependencies,
      alerts: evaluateEngineAlerts(signals, DEFAULT_ALERT_POLICY),
      checkedAt: checkedAt.toISOString(),
      nextCursor: cursor + selected.length < this.probes.length ? cursor + selected.length : null,
    };
  }
}
