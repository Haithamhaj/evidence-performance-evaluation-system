import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createDatabaseClient } from "@evaluation/database";

import { hashJobPayload, NonRetryableJobError, RetryableJobError, runJob } from "./job-runner.js";

const database = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");
const organizationId = crypto.randomUUID();
type JobProcessor = import("./job-runner.js").JobProcessor;

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    jobVersion: 1,
    jobType: "system.test",
    operationId: crypto.randomUUID(),
    correlationId: crypto.randomUUID(),
    scope: { organizationId },
    idempotencyKey: `system.test:${crypto.randomUUID()}`,
    payload: { value: "safe" },
    ...overrides,
  };
}

async function persistPending(input: ReturnType<typeof envelope>) {
  await database.operation.create({
    data: {
      id: input.operationId as string,
      organizationId,
      jobType: input.jobType as string,
      jobVersion: input.jobVersion as number,
      idempotencyKey: input.idempotencyKey as string,
      correlationId: input.correlationId as string,
      payloadHash: hashJobPayload(input.payload),
      status: "pending",
    },
  });
}

beforeAll(async () => {
  await database.organization.create({
    data: { id: organizationId, key: `worker-${organizationId}`, name: "Worker Test" },
  });
  await database.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "T013ProtectedEffectFixture" (
      "operationId" UUID PRIMARY KEY,
      "effectCount" INTEGER NOT NULL
    )
  `);
});

afterAll(async () => {
  await database.$executeRawUnsafe('DROP TABLE IF EXISTS "T013ProtectedEffectFixture"');
  await database.operationEffectReceipt.deleteMany({
    where: { operation: { organizationId } },
  });
  await database.operation.deleteMany({ where: { organizationId } });
  await database.organization.delete({ where: { id: organizationId } });
  await database.$disconnect();
});

describe("JobRunner", () => {
  it("persists a successful result and returns it without a duplicate effect", async () => {
    const input = envelope();
    await persistPending(input);
    const processor: JobProcessor = vi.fn().mockResolvedValue("result:fixture-1");
    const inFlight = new Map<string, Promise<string>>();

    await expect(runJob(database, input, processor, inFlight)).resolves.toBe("result:fixture-1");
    await expect(runJob(database, input, processor, inFlight)).resolves.toBe("result:fixture-1");

    expect(processor).toHaveBeenCalledTimes(1);
    await expect(
      database.operation.findUnique({ where: { id: input.operationId } }),
    ).resolves.toMatchObject({
      attemptCount: 1,
      errorCode: null,
      resultReference: "result:fixture-1",
      status: "succeeded",
    });
  });

  it("rolls back a protected database effect with a retryable crash and commits it once on retry", async () => {
    const input = envelope();
    await persistPending(input);
    let crashAfterEffect = true;
    const processor: JobProcessor = vi.fn(async (_envelope, context) => {
      await context.transaction.$executeRawUnsafe(
        'INSERT INTO "T013ProtectedEffectFixture" ("operationId", "effectCount") VALUES ($1::uuid, 1)',
        input.operationId,
      );
      if (crashAfterEffect) {
        crashAfterEffect = false;
        throw new RetryableJobError("CRASH_AFTER_EFFECT");
      }
      return "result:transactional-effect";
    });

    await expect(runJob(database, input, processor)).rejects.toThrow("CRASH_AFTER_EFFECT");
    await expect(
      database.$queryRawUnsafe<Array<{ count: bigint }>>(
        'SELECT COUNT(*)::bigint AS count FROM "T013ProtectedEffectFixture" WHERE "operationId" = $1::uuid',
        input.operationId,
      ),
    ).resolves.toEqual([{ count: 0n }]);
    await expect(
      database.operation.findUnique({ where: { id: input.operationId } }),
    ).resolves.toMatchObject({ status: "failed", errorCode: "CRASH_AFTER_EFFECT" });

    await expect(runJob(database, input, processor)).resolves.toBe("result:transactional-effect");
    await expect(
      database.$queryRawUnsafe<Array<{ count: bigint }>>(
        'SELECT COUNT(*)::bigint AS count FROM "T013ProtectedEffectFixture" WHERE "operationId" = $1::uuid',
        input.operationId,
      ),
    ).resolves.toEqual([{ count: 1n }]);
    expect(processor).toHaveBeenCalledTimes(2);
  });

  it("recovers an operation left running by a terminated worker", async () => {
    const input = envelope();
    await persistPending(input);
    await database.operation.update({
      where: { id: input.operationId },
      data: { status: "running", attemptCount: 1, startedAt: new Date() },
    });
    const processor: JobProcessor = vi.fn(async (_envelope, context) => {
      await context.transaction.$executeRawUnsafe(
        'INSERT INTO "T013ProtectedEffectFixture" ("operationId", "effectCount") VALUES ($1::uuid, 1)',
        input.operationId,
      );
      return "result:recovered-running";
    });

    await expect(runJob(database, input, processor)).resolves.toBe("result:recovered-running");
    await expect(runJob(database, input, processor)).resolves.toBe("result:recovered-running");
    expect(processor).toHaveBeenCalledTimes(1);
    await expect(
      database.$queryRawUnsafe<Array<{ count: bigint }>>(
        'SELECT COUNT(*)::bigint AS count FROM "T013ProtectedEffectFixture" WHERE "operationId" = $1::uuid',
        input.operationId,
      ),
    ).resolves.toEqual([{ count: 1n }]);
    await expect(
      database.operation.findUnique({ where: { id: input.operationId } }),
    ).resolves.toMatchObject({ status: "succeeded", resultReference: "result:recovered-running" });
  });

  it("gives external effects a stable idempotency key and durable receipt", async () => {
    const input = envelope();
    await persistPending(input);
    const processor: JobProcessor = vi.fn(async (_envelope, context) => {
      const effect = context.externalEffect("provider-delivery");
      expect(effect.idempotencyKey).toBe(`${input.idempotencyKey}:provider-delivery`);
      await expect(effect.findReceipt()).resolves.toBeNull();
      await effect.recordReceipt("receipt:provider-delivery");
      await expect(effect.findReceipt()).resolves.toBe("receipt:provider-delivery");
      return "result:external-effect";
    });

    await expect(runJob(database, input, processor)).resolves.toBe("result:external-effect");
    await expect(
      database.$queryRawUnsafe<Array<{ count: bigint }>>(
        'SELECT COUNT(*)::bigint AS count FROM "OperationEffectReceipt" WHERE "operationId" = $1::uuid',
        input.operationId,
      ),
    ).resolves.toEqual([{ count: 1n }]);
  });

  it("retains an invalid queued payload as JOB_SCHEMA_INVALID", async () => {
    const input = envelope();
    await persistPending(input);
    const processor: JobProcessor = vi.fn();

    await expect(runJob(database, { ...input, payload: { value: 1n } }, processor)).rejects.toThrow(
      "JOB_SCHEMA_INVALID",
    );
    expect(processor).not.toHaveBeenCalled();
    await expect(
      database.operation.findUnique({ where: { id: input.operationId } }),
    ).resolves.toMatchObject({
      attemptCount: 1,
      errorCode: "JOB_SCHEMA_INVALID",
      status: "failed",
    });
  });

  it("retains sanitized retryable and non-retryable failure codes", async () => {
    for (const error of [
      new RetryableJobError("UPSTREAM_TEMPORARY"),
      new NonRetryableJobError("POLICY_DENIED"),
    ]) {
      const input = envelope();
      await persistPending(input);
      const processor: JobProcessor = vi.fn().mockRejectedValue(error);

      await expect(runJob(database, input, processor)).rejects.toThrow(error.code);
      await expect(
        database.operation.findUnique({ where: { id: input.operationId } }),
      ).resolves.toMatchObject({ attemptCount: 1, errorCode: error.code, status: "failed" });
    }
  });

  it("fails an invalid result reference immediately as a schema error", async () => {
    const input = envelope();
    await persistPending(input);
    const processor: JobProcessor = vi.fn().mockResolvedValue("x");

    await expect(runJob(database, input, processor)).rejects.toThrow("JOB_RESULT_INVALID");
    await expect(
      database.operation.findUnique({ where: { id: input.operationId } }),
    ).resolves.toMatchObject({
      attemptCount: 1,
      errorCode: "JOB_RESULT_INVALID",
      status: "failed",
    });
  });
});
