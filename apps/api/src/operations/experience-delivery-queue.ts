import { Queue } from "bullmq";

import { ExperienceDeliveryJobSchema } from "@evaluation/contracts";

type QueueAdapter = Readonly<{
  add(
    name: string,
    data: import("@evaluation/contracts").ExperienceDeliveryJob,
    options: Readonly<Record<string, unknown>>,
  ): Promise<Readonly<{ id?: string }>>;
  getJob?(id: string): Promise<
    | Readonly<{
        getState(): Promise<string>;
        remove?(): Promise<void>;
        retry?(): Promise<void>;
      }>
    | undefined
  >;
  close(): Promise<unknown>;
}>;

export class ExperienceDeliveryQueueProducer {
  private readonly queue: QueueAdapter;

  constructor(queue: QueueAdapter) {
    this.queue = queue;
  }

  async enqueue(input: Readonly<{ receiptId: string; correlationId: string }>) {
    const job = ExperienceDeliveryJobSchema.parse({
      schemaVersion: 1,
      jobType: "experience.deliver",
      ...input,
    });
    const existing = await this.queue.getJob?.(job.receiptId);
    const state = await existing?.getState();
    if (state === "failed" && existing?.retry) {
      await existing.retry();
      return;
    }
    if (state === "completed" && existing?.remove) await existing.remove();
    await this.queue.add(job.jobType, job, {
      jobId: job.receiptId,
      attempts: 3,
      backoff: { type: "exponential", delay: 250 },
      removeOnComplete: false,
      removeOnFail: false,
    });
  }

  close() {
    return this.queue.close();
  }
}

export function createExperienceDeliveryQueueProducer(redisUrl: string) {
  return new ExperienceDeliveryQueueProducer(
    new Queue("experience--v1", { connection: redisConnection(redisUrl) }),
  );
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
