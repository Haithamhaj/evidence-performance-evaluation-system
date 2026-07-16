import { UnrecoverableError } from "bullmq";

import { JobEnvelopeSchema } from "@evaluation/contracts";
import { createCorrelationCarrier, runWithCorrelation } from "@evaluation/observability";

import { executeJob, retainSchemaFailure } from "./operation-execution.js";

type DatabaseClient = ReturnType<typeof import("@evaluation/database").createDatabaseClient>;
type JobEnvelope = import("@evaluation/contracts").JobEnvelope;

export type { JobEffectContext, JobProcessor } from "./operation-execution.js";
type JobProcessor = import("./operation-execution.js").JobProcessor;

interface SafeLogger {
  info(fields: Readonly<Record<string, unknown>>, message?: string): void;
  error(fields: Readonly<Record<string, unknown>>, message?: string): void;
}

function workerCarrier(envelope: JobEnvelope) {
  return createCorrelationCarrier(envelope.correlationId, envelope.trace ?? {});
}

export async function runJob(
  database: DatabaseClient,
  rawEnvelope: unknown,
  processor: JobProcessor,
  inFlight: Map<string, Promise<string>> = new Map(),
  logger?: SafeLogger,
): Promise<string> {
  const parsed = JobEnvelopeSchema.safeParse(rawEnvelope);
  if (!parsed.success) {
    await retainSchemaFailure(database, rawEnvelope);
    throw new UnrecoverableError("JOB_SCHEMA_INVALID");
  }

  const existing = inFlight.get(parsed.data.operationId);
  if (existing !== undefined) return existing;

  const execution = runWithCorrelation(workerCarrier(parsed.data), () =>
    executeJob(database, logger, parsed.data, processor),
  );
  inFlight.set(parsed.data.operationId, execution);
  try {
    return await execution;
  } finally {
    inFlight.delete(parsed.data.operationId);
  }
}

export { administrativelyReplayOperation } from "./administrative-replay.js";
export {
  JobExecutionError,
  NonRetryableJobError,
  PolicyJobError,
  RetryableJobError,
} from "./job-errors.js";
export { hashJobPayload } from "./operation-execution.js";
