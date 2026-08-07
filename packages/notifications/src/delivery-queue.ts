import { Queue } from "bullmq";

import { NotificationDeliveryJobSchema, jobQueueName } from "@evaluation/contracts";

export interface NotificationDeliveryQueue {
  enqueue(
    input: Omit<
      import("@evaluation/contracts").NotificationDeliveryJob,
      "schemaVersion" | "jobType"
    >,
  ): Promise<Readonly<{ jobId: string }>>;
  close(): Promise<unknown>;
}

type QueueAdapter = Readonly<{
  add(
    name: string,
    data: import("@evaluation/contracts").NotificationDeliveryJob,
    options: Readonly<Record<string, unknown>>,
  ): Promise<Readonly<{ id?: string }>>;
  close(): Promise<unknown>;
}>;

export class BullNotificationDeliveryQueue implements NotificationDeliveryQueue {
  private readonly queue: QueueAdapter;

  constructor(queue: QueueAdapter) {
    this.queue = queue;
  }

  async enqueue(
    input: Omit<
      import("@evaluation/contracts").NotificationDeliveryJob,
      "schemaVersion" | "jobType"
    >,
  ) {
    const job = NotificationDeliveryJobSchema.parse({
      schemaVersion: 1,
      jobType: "notifications.deliver",
      ...input,
    });
    const queued = await this.queue.add(job.jobType, job, {
      jobId: job.intentId,
      attempts: 3,
      backoff: { type: "exponential", delay: 1_000 },
      removeOnComplete: false,
      removeOnFail: false,
    });
    return { jobId: queued.id ?? job.intentId };
  }

  close() {
    return this.queue.close();
  }
}

export function createNotificationDeliveryQueue(redisUrl: string) {
  return new BullNotificationDeliveryQueue(
    new Queue(notificationQueuePhysicalName(), { connection: redisConnection(redisUrl) }),
  );
}

export function notificationQueuePhysicalName() {
  return jobQueueName("notifications.deliver", 1).replace(":", "--");
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
