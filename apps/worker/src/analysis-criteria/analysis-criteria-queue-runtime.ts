import { Queue, QueueEvents, Worker } from "bullmq";

import { JobEnvelopeSchema, jobQueueName } from "@evaluation/contracts";
import { createCorrelationCarrier, runWithCorrelation } from "@evaluation/observability";

import { redisConnection, retryPolicyForJobType } from "../queue/queue.module.js";

type QueueJob = Readonly<{
  name: string;
  data: unknown;
  discard(): void;
}>;

export async function processAnalysisCriteriaQueueJob(
  processor: Pick<import("./analysis-criteria.processor.js").AnalysisCriteriaProcessor, "process">,
  job: QueueJob,
): Promise<string> {
  if (job.name !== "analysis-criteria.process") {
    job.discard();
    throw nonRetryable("ANALYSIS_JOB_TYPE_MISMATCH");
  }
  const parsed = JobEnvelopeSchema.safeParse(job.data);
  if (!parsed.success) {
    job.discard();
    throw nonRetryable("ANALYSIS_JOB_ENVELOPE_INVALID");
  }
  try {
    return await runWithCorrelation(
      createCorrelationCarrier(parsed.data.correlationId, parsed.data.trace ?? {}),
      () => processor.process(parsed.data),
    );
  } catch (error) {
    if (isNonRetryable(error)) job.discard();
    throw error;
  }
}

export type AnalysisCriteriaQueueRuntime = Readonly<{
  start(): Promise<void>;
  close(): Promise<void>;
  isHealthy(): boolean;
}>;

export function createAnalysisCriteriaQueueRuntime(
  input: Readonly<{
    redisUrl: string;
    processor: Pick<
      import("./analysis-criteria.processor.js").AnalysisCriteriaProcessor,
      "process"
    >;
  }>,
): AnalysisCriteriaQueueRuntime {
  const logicalName = jobQueueName("analysis-criteria.process", 1);
  const physicalName = logicalName.replace(":", "--");
  const connection = redisConnection(input.redisUrl);
  const queue = new Queue(physicalName, { connection });
  const queueEvents = new QueueEvents(physicalName, { connection });
  const worker = new Worker(
    physicalName,
    (job) => processAnalysisCriteriaQueueJob(input.processor, job),
    {
      autorun: false,
      concurrency: 1,
      connection,
      settings: {
        backoffStrategy: (attemptsMade) => {
          const policy = retryPolicyForJobType("analysis-criteria.process");
          return Math.min(
            policy.maximumDelayMs,
            policy.baseDelayMs * 2 ** Math.max(0, attemptsMade - 1),
          );
        },
      },
    },
  );
  return createAnalysisCriteriaQueueLifecycle({ queue, queueEvents, worker });
}

export function createAnalysisCriteriaQueueLifecycle(
  components: Readonly<{
    queue: { waitUntilReady(): Promise<unknown>; close(): Promise<unknown> };
    queueEvents: { waitUntilReady(): Promise<unknown>; close(): Promise<unknown> };
    worker: {
      run(): Promise<void>;
      waitUntilReady(): Promise<unknown>;
      close(): Promise<unknown>;
    };
  }>,
): AnalysisCriteriaQueueRuntime {
  let runPromise: Promise<void> | undefined;
  let closePromise: Promise<void> | undefined;
  let runFailure: unknown;
  let closing = false;
  return {
    async start() {
      runPromise ??= components.worker
        .run()
        .then(() => {
          if (!closing) throw new Error("Analysis criteria worker loop stopped");
        })
        .catch((error: unknown) => {
          runFailure = error;
          throw error;
        });
      const ready = Promise.all([
        components.queue.waitUntilReady(),
        components.queueEvents.waitUntilReady(),
        components.worker.waitUntilReady(),
      ]);
      await Promise.race([ready, runPromise]);
    },
    isHealthy() {
      return runFailure === undefined;
    },
    close() {
      closePromise ??= (async () => {
        closing = true;
        await components.worker.close();
        await Promise.all([components.queueEvents.close(), components.queue.close()]);
        await runPromise?.catch(() => undefined);
      })();
      return closePromise;
    },
  };
}

function isNonRetryable(error: unknown): error is Readonly<{ retryable?: false; code?: string }> {
  const explicitlyNonRetryable =
    typeof error === "object" &&
    error !== null &&
    "retryable" in error &&
    error.retryable === false;
  if (explicitlyNonRetryable) return true;
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    typeof error.code !== "string"
  )
    return false;
  return new Set([
    "AI_OUTPUT_QUARANTINED",
    "AI_SOURCE_REFERENCE_INVALID",
    "CRITERIA_COUNT_INVALID",
    "DOCUMENT_EXTRACTION_INCOMPLETE",
    "RESOURCE_NOT_FOUND",
    "ANALYSIS_REQUEST_FAILED",
    "ANALYSIS_RETRIES_EXHAUSTED",
  ]).has(error.code);
}

function nonRetryable(code: string): Error & { retryable: false } {
  return Object.assign(new Error(code), { retryable: false as const });
}
