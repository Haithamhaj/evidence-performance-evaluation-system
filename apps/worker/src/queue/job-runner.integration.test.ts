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
});

afterAll(async () => {
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
