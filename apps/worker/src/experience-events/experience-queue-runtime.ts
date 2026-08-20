import { Queue, QueueEvents, Worker } from "bullmq";

import { ExperienceDeliveryJobSchema } from "@evaluation/contracts";

import { redisConnection } from "../queue/queue.module.js";

type QueueJob = Readonly<{ name: string; data: unknown; discard(): void }>;

export async function processExperienceQueueJob(
  processor: Pick<
    import("./experience-delivery.processor.js").ExperienceDeliveryProcessor,
    "process" | "markError"
  >,
  job: QueueJob,
) {
  if (job.name !== "experience.deliver") {
    job.discard();
    throw new Error("EXPERIENCE_JOB_TYPE_MISMATCH");
  }
  const parsed = ExperienceDeliveryJobSchema.safeParse(job.data);
  if (!parsed.success) {
    job.discard();
    throw new Error("EXPERIENCE_JOB_INVALID");
  }
  try {
    return await processor.process(parsed.data);
  } catch (error) {
    await processor.markError(parsed.data, "delivery_failed");
    throw error;
  }
}

export function createExperienceQueueRuntime(
  input: Readonly<{
    redisUrl: string;
    processor: Pick<
      import("./experience-delivery.processor.js").ExperienceDeliveryProcessor,
      "process" | "markError"
    >;
  }>,
) {
  const connection = redisConnection(input.redisUrl);
  const physicalName = "experience--v1";
  const queue = new Queue(physicalName, { connection });
  const queueEvents = new QueueEvents(physicalName, { connection });
  const worker = new Worker(
    physicalName,
    (job) => processExperienceQueueJob(input.processor, job),
    { autorun: false, concurrency: 4, connection },
  );
  let running: Promise<void> | undefined;
  let closing = false;
  return {
    async start() {
      running ??= worker.run().then(() => {
        if (!closing) throw new Error("Experience worker loop stopped");
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
