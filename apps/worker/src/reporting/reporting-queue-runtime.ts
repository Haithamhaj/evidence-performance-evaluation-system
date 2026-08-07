import { Queue, QueueEvents, Worker } from "bullmq";

import { ExportGenerationJobSchema, jobQueueName } from "@evaluation/contracts";

import { redisConnection } from "../queue/queue.module.js";

type QueueJob = Readonly<{ name: string; data: unknown; discard(): void }>;

export async function processReportingQueueJob(
  processor: Pick<import("./export.processor.js").ExportProcessor, "process">,
  job: QueueJob,
) {
  if (job.name !== "reporting.generate") {
    job.discard();
    throw nonRetryable("REPORT_JOB_TYPE_MISMATCH");
  }
  const parsed = ExportGenerationJobSchema.safeParse(job.data);
  if (!parsed.success) {
    job.discard();
    throw nonRetryable("REPORT_JOB_INVALID");
  }
  try {
    return await processor.process(parsed.data);
  } catch (error) {
    if (isNonRetryable(error)) job.discard();
    throw error;
  }
}

export function createReportingQueueRuntime(
  input: Readonly<{
    redisUrl: string;
    processor: Pick<import("./export.processor.js").ExportProcessor, "process">;
  }>,
) {
  const physicalName = jobQueueName("reporting.generate", 1).replace(":", "--");
  const connection = redisConnection(input.redisUrl);
  const queue = new Queue(physicalName, { connection });
  const queueEvents = new QueueEvents(physicalName, { connection });
  const worker = new Worker(physicalName, (job) => processReportingQueueJob(input.processor, job), {
    autorun: false,
    concurrency: 1,
    connection,
  });
  return lifecycle({ queue, queueEvents, worker });
}

function lifecycle(components: {
  queue: { waitUntilReady(): Promise<unknown>; close(): Promise<unknown> };
  queueEvents: { waitUntilReady(): Promise<unknown>; close(): Promise<unknown> };
  worker: { run(): Promise<void>; waitUntilReady(): Promise<unknown>; close(): Promise<unknown> };
}) {
  let running: Promise<void> | undefined;
  let closing = false;
  return {
    async start() {
      running ??= components.worker.run().then(() => {
        if (!closing) throw new Error("Reporting worker loop stopped");
      });
      await Promise.race([
        Promise.all([
          components.queue.waitUntilReady(),
          components.queueEvents.waitUntilReady(),
          components.worker.waitUntilReady(),
        ]),
        running,
      ]);
    },
    async close() {
      closing = true;
      await components.worker.close();
      await Promise.all([components.queueEvents.close(), components.queue.close()]);
      await running?.catch(() => undefined);
    },
  };
}

function isNonRetryable(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    new Set(["ARABIC_EVALUATION_NOT_APPROVED", "EXPORT_FORBIDDEN"]).has(String(error.code))
  );
}

function nonRetryable(code: string) {
  return Object.assign(new Error(code), { retryable: false as const });
}
