import { Queue } from "bullmq";

import { ExportGenerationJobSchema, jobQueueName } from "@evaluation/contracts";

type QueueAdapter = Readonly<{
  add(
    name: string,
    data: import("@evaluation/contracts").ExportGenerationJob,
    options: Readonly<Record<string, unknown>>,
  ): Promise<Readonly<{ id?: string }>>;
  close(): Promise<unknown>;
}>;

export class ExportQueueProducer {
  private readonly queue: QueueAdapter;

  constructor(queue: QueueAdapter) {
    this.queue = queue;
  }

  async enqueue(
    input: Omit<import("@evaluation/contracts").ExportGenerationJob, "schemaVersion" | "jobType">,
  ) {
    const job = ExportGenerationJobSchema.parse({
      schemaVersion: 1,
      jobType: "reporting.generate",
      ...input,
    });
    const queued = await this.queue.add(job.jobType, job, {
      jobId: job.requestId,
      attempts: 3,
      backoff: { type: "exponential", delay: 1_000 },
      removeOnComplete: false,
      removeOnFail: false,
    });
    return { jobId: queued.id ?? job.requestId };
  }

  close() {
    return this.queue.close();
  }
}

export function createExportQueueProducer(redisUrl: string) {
  return new ExportQueueProducer(
    new Queue(reportingQueuePhysicalName(), { connection: redisConnection(redisUrl) }),
  );
}

export function reportingQueuePhysicalName() {
  return jobQueueName("reporting.generate", 1).replace(":", "--");
}

function redisConnection(redisUrl: string) {
  const url = new URL(redisUrl);
  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    throw new TypeError("Redis URL must use redis or rediss");
  }
  return {
    host: url.hostname,
    port: url.port === "" ? 6379 : Number(url.port),
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
    ...(url.username === "" ? {} : { username: decodeURIComponent(url.username) }),
    ...(url.password === "" ? {} : { password: decodeURIComponent(url.password) }),
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
  };
}
