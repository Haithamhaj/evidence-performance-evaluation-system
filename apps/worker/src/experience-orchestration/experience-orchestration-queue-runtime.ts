import { Queue, QueueEvents, Worker } from "bullmq";

import { redisConnection } from "../queue/queue.module.js";
import { processExperienceOrchestrationJob } from "./experience-orchestration.processor.js";

export function createExperienceOrchestrationQueueRuntime(
  input: Readonly<{
    redisUrl: string;
    processor: Pick<
      import("./experience-orchestration.processor.js").ExperienceOrchestrationProcessor,
      "process"
    >;
  }>,
) {
  const connection = redisConnection(input.redisUrl);
  const physicalName = "experience-orchestration--v1";
  const queue = new Queue(physicalName, { connection });
  const queueEvents = new QueueEvents(physicalName, { connection });
  const worker = new Worker(
    physicalName,
    (job) => processExperienceOrchestrationJob(input.processor, job),
    { autorun: false, concurrency: 1, connection },
  );
  let running: Promise<void> | undefined;
  let closing = false;
  return {
    async start() {
      running ??= worker.run().then(() => {
        if (!closing) throw new Error("Experience orchestration worker loop stopped");
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
