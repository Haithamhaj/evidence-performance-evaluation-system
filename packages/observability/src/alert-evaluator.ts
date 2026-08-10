export interface EngineAlertPolicy {
  readonly schemaVersion: 1;
  readonly version: number;
  readonly maxBackupAgeSeconds: number;
  readonly maxFailureCount: number;
}

export function evaluateEngineAlerts(
  signals: readonly import("./engine-signals.js").EngineSignal[],
  policy: EngineAlertPolicy,
) {
  if (policy.version < 1) throw new TypeError("alert policy version must be positive");
  return signals.flatMap((signal) => {
    if (signal.kind === "BACKUP" && (signal.ageSeconds ?? 0) > policy.maxBackupAgeSeconds) {
      return [alert(signal, policy.version, "BACKUP_STALE", "admin.health.verifyBackup")];
    }
    if (signal.failureCount >= policy.maxFailureCount || signal.state === "ACTION_REQUIRED") {
      return [
        alert(signal, policy.version, "DEPENDENCY_FAILURE", "admin.health.inspectDependency"),
      ];
    }
    return [];
  });
}

function alert(
  signal: import("./engine-signals.js").EngineSignal,
  policyVersion: number,
  kind: "BACKUP_STALE" | "DEPENDENCY_FAILURE",
  nextActionKey: string,
) {
  return {
    schemaVersion: 1 as const,
    policyVersion,
    kind,
    severity: "ACTION_REQUIRED" as const,
    signalKind: signal.kind,
    correlationId: signal.correlationId,
    observedAt: signal.observedAt,
    nextActionKey,
  };
}
