import { randomUUID } from "node:crypto";

import { AdminHealthStateSchema } from "@evaluation/contracts";
import { combineOperationalHealthStates } from "@evaluation/observability";

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
    return {
      schemaVersion: 1 as const,
      state: combineOperationalHealthStates(dependencies.map(({ state }) => state)),
      dependencies,
      checkedAt: checkedAt.toISOString(),
      nextCursor: cursor + selected.length < this.probes.length ? cursor + selected.length : null,
    };
  }
}
