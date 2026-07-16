import { EventEmitter } from "node:events";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createDatabaseClient } from "../../packages/database/src/index.js";
import {
  NonRetryableJobError,
  RetryableJobError,
  closeQueueRuntime,
  createQueueRuntime,
  enqueueJob,
  hashJobPayload,
  waitForQueueShutdownSignal,
} from "../../apps/worker/src/queue/queue.module.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const organizationId = crypto.randomUUID();

function envelope(jobType: string) {
  return {
    jobVersion: 1,
    jobType,
    operationId: crypto.randomUUID(),
    correlationId: crypto.randomUUID(),
    scope: { organizationId },
    idempotencyKey: `${jobType}:${crypto.randomUUID()}`,
    payload: { value: "safe" },
  };
}

beforeAll(async () => {
  await database.organization.create({
    data: { id: organizationId, key: `queue-${organizationId}`, name: "Queue Test" },
  });
});

afterAll(async () => {
  await database.operation.deleteMany({ where: { organizationId } });
  await database.organization.delete({ where: { id: organizationId } });
  await database.$disconnect();
});

describe("durable BullMQ reliability", () => {
  it("retries a retryable job and succeeds on attempt three", async () => {
    const input = envelope("reliability.retryable");
    let calls = 0;
    const runtime = createQueueRuntime({
      database,
      jobType: input.jobType,
      jobVersion: 1,
      redisUrl,
      processor: vi.fn(async () => {
        calls += 1;
        if (calls < 3) throw new RetryableJobError("UPSTREAM_TEMPORARY");
        return "result:third-attempt";
      }),
    });

    try {
      await expect(enqueueJob(runtime, input)).resolves.toBe("result:third-attempt");
      await expect(
        database.operation.findUnique({ where: { id: input.operationId } }),
      ).resolves.toMatchObject({ attemptCount: 3, errorCode: null, status: "succeeded" });
    } finally {
      await closeQueueRuntime(runtime);
    }
  });

  it("stops a non-retryable job after one attempt and retains failure", async () => {
    const input = envelope("reliability.nonretryable");
    const processor = vi.fn().mockRejectedValue(new NonRetryableJobError("POLICY_DENIED"));
    const runtime = createQueueRuntime({
      database,
      jobType: input.jobType,
      jobVersion: 1,
      processor,
      redisUrl,
    });

    try {
      await expect(enqueueJob(runtime, input)).rejects.toThrow("POLICY_DENIED");
      expect(processor).toHaveBeenCalledTimes(1);
      await expect(
        database.operation.findUnique({ where: { id: input.operationId } }),
      ).resolves.toMatchObject({ attemptCount: 1, errorCode: "POLICY_DENIED", status: "failed" });
    } finally {
      await closeQueueRuntime(runtime);
    }
  });

  it("retains a corrupted queued envelope as JOB_SCHEMA_INVALID", async () => {
    const input = envelope("reliability.schema");
    const runtime = createQueueRuntime({
      database,
      jobType: input.jobType,
      jobVersion: 1,
      processor: vi.fn(),
      redisUrl,
    });
    await database.operation.create({
      data: {
        id: input.operationId,
        organizationId,
        jobType: input.jobType,
        jobVersion: input.jobVersion,
        idempotencyKey: input.idempotencyKey,
        correlationId: input.correlationId,
        payloadHash: hashJobPayload(input.payload),
        status: "pending",
      },
    });

    try {
      await Promise.all([runtime.worker.waitUntilReady(), runtime.queueEvents.waitUntilReady()]);
      const job = await runtime.queue.add(
        input.jobType,
        { ...input, payload: { value: "x".repeat(65_537) } },
        { jobId: input.operationId, attempts: 3, removeOnFail: false },
      );
      await expect(job.waitUntilFinished(runtime.queueEvents, 5_000)).rejects.toThrow(
        "JOB_SCHEMA_INVALID",
      );
      await expect(
        database.operation.findUnique({ where: { id: input.operationId } }),
      ).resolves.toMatchObject({
        attemptCount: 1,
        errorCode: "JOB_SCHEMA_INVALID",
        status: "failed",
      });
    } finally {
      await closeQueueRuntime(runtime);
    }
  });

  it("deduplicates enqueue by durable idempotency key and protected effect", async () => {
    const input = envelope("reliability.duplicate");
    const processor = vi.fn().mockResolvedValue("result:once");
    const runtime = createQueueRuntime({
      database,
      jobType: input.jobType,
      jobVersion: 1,
      processor,
      redisUrl,
    });

    try {
      const duplicate = { ...input, operationId: crypto.randomUUID() };
      await expect(
        Promise.all([enqueueJob(runtime, input), enqueueJob(runtime, duplicate)]),
      ).resolves.toEqual(["result:once", "result:once"]);
      expect(processor).toHaveBeenCalledTimes(1);
      await expect(
        database.operation.count({ where: { idempotencyKey: input.idempotencyKey } }),
      ).resolves.toBe(1);
    } finally {
      await closeQueueRuntime(runtime);
    }
  });

  it("rejects a conflicting payload under an existing idempotency key", async () => {
    const input = envelope("reliability.conflict");
    const processor = vi.fn().mockResolvedValue("result:original");
    const runtime = createQueueRuntime({
      database,
      jobType: input.jobType,
      jobVersion: 1,
      processor,
      redisUrl,
    });

    try {
      await expect(enqueueJob(runtime, input)).resolves.toBe("result:original");
      await expect(
        enqueueJob(runtime, {
          ...input,
          operationId: crypto.randomUUID(),
          payload: { value: "changed" },
        }),
      ).rejects.toThrow("JOB_IDEMPOTENCY_CONFLICT");
      expect(processor).toHaveBeenCalledTimes(1);
    } finally {
      await closeQueueRuntime(runtime);
    }
  });

  it("closes gracefully without losing the active durable operation", async () => {
    const input = envelope("reliability.shutdown");
    let release!: () => void;
    const active = new Promise<void>((resolve) => {
      release = resolve;
    });
    const runtime = createQueueRuntime({
      database,
      jobType: input.jobType,
      jobVersion: 1,
      redisUrl,
      processor: async () => (await active, "result:shutdown"),
    });
    const completion = enqueueJob(runtime, input);
    const signals = new EventEmitter();

    try {
      await vi.waitFor(async () => {
        await expect(
          database.operation.findUnique({ where: { id: input.operationId } }),
        ).resolves.toMatchObject({ status: "running" });
      });
      const closing = waitForQueueShutdownSignal(runtime, signals);
      signals.emit("SIGTERM");
      await expect(
        database.operation.findUnique({ where: { id: input.operationId } }),
      ).resolves.toMatchObject({ status: "running" });
      release();
      await expect(completion).resolves.toBe("result:shutdown");
      await closing;
    } finally {
      release();
      await closeQueueRuntime(runtime);
    }
  });
});
