import { describe, expect, it } from "vitest";

import { evaluateEngineAlerts } from "./alert-evaluator.js";

describe("engine alert evaluator", () => {
  it("uses versioned thresholds and emits bounded action events", () => {
    const alerts = evaluateEngineAlerts(
      [
        {
          schemaVersion: 1,
          kind: "BACKUP",
          state: "DEGRADED",
          observedAt: "2026-08-07T00:00:00.000Z",
          correlationId: "00000000-0000-4000-8000-000000007102",
          ageSeconds: 90_000,
          failureCount: 0,
          labels: {},
        },
      ],
      { schemaVersion: 1, version: 2, maxBackupAgeSeconds: 86_400, maxFailureCount: 3 },
    );

    expect(alerts).toEqual([
      expect.objectContaining({
        policyVersion: 2,
        kind: "BACKUP_STALE",
        severity: "ACTION_REQUIRED",
        nextActionKey: "admin.health.verifyBackup",
      }),
    ]);
    expect(JSON.stringify(alerts)).not.toMatch(/secret|rawError|private/iu);
  });
});
