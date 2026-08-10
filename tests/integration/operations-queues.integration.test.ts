import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { createExportQueueProducer } from "../../apps/api/src/operations/export-queue-producer.js";
import { createNotificationQueueRuntime } from "../../apps/worker/src/notifications/notification-queue-runtime.js";
import { createReportingQueueRuntime } from "../../apps/worker/src/reporting/reporting-queue-runtime.js";
import { createNotificationDeliveryQueue } from "@evaluation/notifications";

const closeables: Array<{ close(): Promise<unknown> }> = [];

afterEach(async () => {
  await Promise.all(closeables.splice(0).map((item) => item.close()));
});

describe.sequential("operations BullMQ runtimes", () => {
  it("moves a request-only report job from the API producer to the reporting worker", async () => {
    const received = deferred<unknown>();
    const runtime = createReportingQueueRuntime({
      redisUrl: required("REDIS_URL"),
      processor: { process: async (job) => (received.resolve(job), { artifactId: randomUUID() }) },
    });
    const producer = createExportQueueProducer(required("REDIS_URL"));
    closeables.push(runtime, producer);
    await runtime.start();
    const job = { requestId: randomUUID(), requesterId: randomUUID(), correlationId: randomUUID() };
    await producer.enqueue(job);
    await expect(withTimeout(received.promise)).resolves.toMatchObject(job);
  });

  it("moves an intent-only notification job to the delivery worker", async () => {
    const received = deferred<unknown>();
    const runtime = createNotificationQueueRuntime({
      redisUrl: required("REDIS_URL"),
      processor: {
        process: async (job) => {
          received.resolve(job);
          return { inAppState: "READY", emailState: "SENT" };
        },
      },
    });
    const producer = createNotificationDeliveryQueue(required("REDIS_URL"));
    closeables.push(runtime, producer);
    await runtime.start();
    const job = { intentId: randomUUID(), correlationId: randomUUID() };
    await producer.enqueue(job);
    await expect(withTimeout(received.promise)).resolves.toMatchObject(job);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function withTimeout<T>(promise: Promise<T>) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Operations queue timed out")), 5_000),
    ),
  ]);
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
