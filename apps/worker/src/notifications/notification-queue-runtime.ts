import { Queue, QueueEvents, Worker } from "bullmq";

import { NotificationDeliveryJobSchema, jobQueueName } from "@evaluation/contracts";

import { redisConnection } from "../queue/queue.module.js";

type QueueJob = Readonly<{ name: string; data: unknown; discard(): void }>;

export async function processNotificationQueueJob(
  processor: Pick<
    import("./notification-delivery.processor.js").NotificationDeliveryProcessor,
    "process"
  >,
  job: QueueJob,
) {
  if (job.name !== "notifications.deliver") {
    job.discard();
    throw new Error("NOTIFICATION_JOB_TYPE_MISMATCH");
  }
  const parsed = NotificationDeliveryJobSchema.safeParse(job.data);
  if (!parsed.success) {
    job.discard();
    throw new Error("NOTIFICATION_JOB_INVALID");
  }
  return processor.process(parsed.data);
}

export function createNotificationQueueRuntime(
  input: Readonly<{
    redisUrl: string;
    processor: Pick<
      import("./notification-delivery.processor.js").NotificationDeliveryProcessor,
      "process"
    >;
  }>,
) {
  const physicalName = jobQueueName("notifications.deliver", 1).replace(":", "--");
  const connection = redisConnection(input.redisUrl);
  const queue = new Queue(physicalName, { connection });
  const queueEvents = new QueueEvents(physicalName, { connection });
  const worker = new Worker(
    physicalName,
    (job) => processNotificationQueueJob(input.processor, job),
    { autorun: false, concurrency: 4, connection },
  );
  let running: Promise<void> | undefined;
  let closing = false;
  return {
    async start() {
      running ??= worker.run().then(() => {
        if (!closing) throw new Error("Notification worker loop stopped");
      });
      await Promise.race([
        Promise.all([
          queue.waitUntilReady(),
          queueEvents.waitUntilReady(),
          worker.waitUntilReady(),
        ]),
        running,
      ]);
    },
    async close() {
      closing = true;
      await worker.close();
      await Promise.all([queueEvents.close(), queue.close()]);
      await running?.catch(() => undefined);
    },
  };
}
