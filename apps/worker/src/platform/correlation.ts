import { restoreCorrelationCarrier, runWithCorrelation } from "@evaluation/observability";

export function runWithWorkerCorrelation<T>(serializedCarrier: unknown, callback: () => T): T {
  return runWithCorrelation(restoreCorrelationCarrier(serializedCarrier), callback);
}

export function restoreWorkerCorrelation(
  serializedCarrier: unknown,
): import("@evaluation/observability").CorrelationCarrier {
  return restoreCorrelationCarrier(serializedCarrier);
}
