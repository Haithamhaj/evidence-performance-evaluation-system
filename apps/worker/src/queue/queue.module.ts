import { Module } from "@nestjs/common";
import { Queue, QueueEvents, Worker } from "bullmq";

import { JobEnvelopeSchema, jobQueueName } from "@evaluation/contracts";
import { currentCorrelation } from "@evaluation/observability";

import {
  hashJobPayload,
  NonRetryableJobError,
  PolicyJobError,
  RetryableJobError,
  runJob,
  type JobProcessor,
} from "./job-runner.js";

type DatabaseClient = ReturnType<typeof import("@evaluation/database").createDatabaseClient>;
type BackoffStrategy = import("bullmq").BackoffStrategy;
type ConnectionOptions = import("bullmq").ConnectionOptions;
type JobEnvelope = import("@evaluation/contracts").JobEnvelope;

interface SafeLogger {
  info(fields: Readonly<Record<string, unknown>>, message?: string): void;
  error(fields: Readonly<Record<string, unknown>>, message?: string): void;
}

export interface QueueRuntime {
  readonly database: DatabaseClient;
  readonly jobType: string;
  readonly jobVersion: number;
  readonly logicalQueueName: string;
  readonly queue: Queue;
  readonly queueEvents: QueueEvents;
  readonly worker: Worker;
}

export function redisConnection(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    throw new TypeError("Redis URL must use redis or rediss");
  }
  if (url.pathname !== "" && url.pathname !== "/" && !/^\/\d+$/u.test(url.pathname)) {
    throw new TypeError("Redis URL contains an invalid database number");
  }
  const database = url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0;
  return {
    host: url.hostname,
    port: url.port === "" ? 6379 : Number(url.port),
    db: database,
    ...(url.username === "" ? {} : { username: decodeURIComponent(url.username) }),
    ...(url.password === "" ? {} : { password: decodeURIComponent(url.password) }),
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
  };
}

export function retryPolicyForJobType(_jobType: string) {
  return Object.freeze({ attempts: 3, baseDelayMs: 25, maximumDelayMs: 1_000 });
}

const boundedBackoff: BackoffStrategy = (attemptsMade, _type, _error, job) => {
  const policy = retryPolicyForJobType(job?.name ?? "system.test");
  const exponential = Math.min(
    policy.maximumDelayMs,
    policy.baseDelayMs * 2 ** Math.max(0, attemptsMade - 1),
  );
  const seed = [...(job?.id ?? "0")].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const jitter = 0.75 + (seed % 51) / 100;
  return Math.min(policy.maximumDelayMs, Math.max(1, Math.round(exponential * jitter)));
};

export function createQueueRuntime(options: {
  readonly database: DatabaseClient;
  readonly jobType: string;
  readonly jobVersion: number;
  readonly redisUrl: string;
  readonly processor: JobProcessor;
  readonly logger?: SafeLogger;
}): QueueRuntime {
  const queueName = jobQueueName(options.jobType, options.jobVersion);
  // BullMQ reserves ':' for its Redis key separator. Keep the authoritative
  // logical queue name at the boundary and encode it only inside this adapter.
  const physicalQueueName = queueName.replace(":", "--");
  const connection = redisConnection(options.redisUrl);
  const inFlight = new Map<string, Promise<string>>();
  const queue = new Queue(physicalQueueName, { connection });
  const queueEvents = new QueueEvents(physicalQueueName, { connection });
  const worker = new Worker(
    physicalQueueName,
    async (job) => {
      if (job.name !== options.jobType) throw new NonRetryableJobError("JOB_TYPE_MISMATCH");
      return runJob(options.database, job.data, options.processor, inFlight, options.logger);
    },
    {
      connection,
      concurrency: 1,
      settings: { backoffStrategy: boundedBackoff },
    },
  );

  return {
    database: options.database,
    jobType: options.jobType,
    jobVersion: options.jobVersion,
    logicalQueueName: queueName,
    queue,
    queueEvents,
    worker,
  };
}

async function durableEnvelope(runtime: QueueRuntime, rawEnvelope: unknown): Promise<JobEnvelope> {
  const envelope = JobEnvelopeSchema.parse(rawEnvelope);
  if (envelope.jobType !== runtime.jobType || envelope.jobVersion !== runtime.jobVersion) {
    throw new NonRetryableJobError("JOB_QUEUE_MISMATCH");
  }
  const carrier = currentCorrelation();
  if (carrier !== undefined && carrier.correlationId !== envelope.correlationId) {
    throw new NonRetryableJobError("JOB_CORRELATION_MISMATCH");
  }
  const payloadHash = hashJobPayload(envelope.payload);

  try {
    await runtime.database.operation.create({
      data: {
        id: envelope.operationId,
        organizationId: envelope.scope.organizationId,
        jobType: envelope.jobType,
        jobVersion: envelope.jobVersion,
        idempotencyKey: envelope.idempotencyKey,
        correlationId: envelope.correlationId,
        payloadHash,
        status: "pending",
      },
    });
    return envelope;
  } catch (error) {
    const existing = await runtime.database.operation.findUnique({
      where: { idempotencyKey: envelope.idempotencyKey },
    });
    if (existing === null) throw error;
    if (
      existing.organizationId !== envelope.scope.organizationId ||
      existing.jobType !== envelope.jobType ||
      existing.jobVersion !== envelope.jobVersion ||
      existing.payloadHash !== payloadHash
    ) {
      throw new NonRetryableJobError("JOB_IDEMPOTENCY_CONFLICT");
    }
    return {
      ...envelope,
      operationId: existing.id,
      correlationId: existing.correlationId,
    };
  }
}

export async function enqueueJob(runtime: QueueRuntime, rawEnvelope: unknown): Promise<string> {
  const envelope = await durableEnvelope(runtime, rawEnvelope);
  const policy = retryPolicyForJobType(envelope.jobType);
  await Promise.all([
    runtime.queue.waitUntilReady(),
    runtime.queueEvents.waitUntilReady(),
    runtime.worker.waitUntilReady(),
  ]);
  const job = await runtime.queue.add(envelope.jobType, envelope, {
    jobId: envelope.operationId,
    attempts: policy.attempts,
    backoff: { type: "bounded-exponential", delay: policy.baseDelayMs },
    removeOnComplete: false,
    removeOnFail: false,
  });
  return job.waitUntilFinished(runtime.queueEvents, 15_000);
}

const closures = new WeakMap<QueueRuntime, Promise<void>>();

export function closeQueueRuntime(runtime: QueueRuntime): Promise<void> {
  const existing = closures.get(runtime);
  if (existing !== undefined) return existing;
  const closure = (async () => {
    await runtime.worker.close();
    await runtime.queueEvents.close();
    await runtime.queue.close();
  })();
  closures.set(runtime, closure);
  return closure;
}

interface ShutdownSignalSource {
  once(event: "SIGTERM", listener: () => void): unknown;
  off(event: "SIGTERM", listener: () => void): unknown;
}

export function waitForQueueShutdownSignal(
  runtime: QueueRuntime,
  signalSource: ShutdownSignalSource = process,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleSignal = () => {
      signalSource.off("SIGTERM", handleSignal);
      closeQueueRuntime(runtime).then(resolve, reject);
    };
    signalSource.once("SIGTERM", handleSignal);
  });
}

export { hashJobPayload, NonRetryableJobError, PolicyJobError, RetryableJobError, runJob };
export type { JobProcessor };

export class QueueModule {}

Module({})(QueueModule);
