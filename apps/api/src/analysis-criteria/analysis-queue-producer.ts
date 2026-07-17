import { Queue } from "bullmq";

import { jobQueueName } from "@evaluation/contracts";

type JobEnvelope = import("@evaluation/contracts").JobEnvelope;
type QueueAdapter = Readonly<{
  add(
    name: string,
    data: JobEnvelope,
    options: Readonly<Record<string, unknown>>,
  ): Promise<Readonly<{ id?: string }>>;
  close(): Promise<unknown>;
}>;

export class AnalysisQueueProducer {
  private readonly queue: QueueAdapter;

  constructor(queue: QueueAdapter) {
    this.queue = queue;
  }

  async enqueue(envelope: JobEnvelope): Promise<string> {
    const job = await this.queue.add(envelope.jobType, envelope, {
      jobId: envelope.operationId,
      attempts: 3,
      backoff: { type: "bounded-exponential", delay: 25 },
      removeOnComplete: false,
      removeOnFail: false,
    });
    return job.id ?? envelope.operationId;
  }

  close(): Promise<unknown> {
    return this.queue.close();
  }
}

export function createAnalysisQueueProducer(redisUrl: string): AnalysisQueueProducer {
  return new AnalysisQueueProducer(
    new Queue(analysisQueuePhysicalName(), {
      connection: redisConnection(redisUrl),
    }),
  );
}

export function analysisQueuePhysicalName(): string {
  return jobQueueName("analysis-criteria.process", 1).replace(":", "--");
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
