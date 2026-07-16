import { createHash } from "node:crypto";

import { UnrecoverableError } from "bullmq";
import { z } from "zod";

import { asJobExecutionError, NonRetryableJobError, RetryableJobError } from "./job-errors.js";

const ResultReferenceSchema = z
  .string()
  .trim()
  .min(3)
  .max(256)
  .refine((value) => !/(token|secret|password|credential|bearer|api[-_]?key)/iu.test(value), {
    message: "result reference contains a forbidden value",
  });

const JobIdentitySchema = z
  .object({
    jobVersion: z.number().int().min(1),
    jobType: z.string().min(3).max(100),
    operationId: z.string().uuid(),
    correlationId: z.string().uuid(),
    scope: z.object({ organizationId: z.string().uuid() }).passthrough(),
    idempotencyKey: z.string().trim().min(3).max(200),
  })
  .passthrough();

type DatabaseClient = ReturnType<typeof import("@evaluation/database").createDatabaseClient>;
type JobEnvelope = import("@evaluation/contracts").JobEnvelope;
type JobProcessor = (envelope: JobEnvelope) => Promise<string>;

interface SafeLogger {
  info(fields: Readonly<Record<string, unknown>>, message?: string): void;
  error(fields: Readonly<Record<string, unknown>>, message?: string): void;
}

export function hashJobPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}

async function existingOutcome(database: DatabaseClient, operationId: string): Promise<string> {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const operation = await database.operation.findUnique({ where: { id: operationId } });
    if (operation === null) throw new UnrecoverableError("JOB_OPERATION_NOT_FOUND");
    if (operation.status === "succeeded" && operation.resultReference !== null) {
      return operation.resultReference;
    }
    if (operation.status === "failed" && operation.errorCode !== null) {
      throw new UnrecoverableError(operation.errorCode);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new RetryableJobError("JOB_OPERATION_BUSY");
}

export async function executeJob(
  database: DatabaseClient,
  logger: SafeLogger | undefined,
  envelope: JobEnvelope,
  processor: JobProcessor,
): Promise<string> {
  const startedAt = new Date();
  const acquired = await database.operation.updateMany({
    where: {
      id: envelope.operationId,
      organizationId: envelope.scope.organizationId,
      jobType: envelope.jobType,
      jobVersion: envelope.jobVersion,
      idempotencyKey: envelope.idempotencyKey,
      correlationId: envelope.correlationId,
      payloadHash: hashJobPayload(envelope.payload),
      status: { in: ["pending", "failed"] },
    },
    data: {
      status: "running",
      attemptCount: { increment: 1 },
      errorCode: null,
      resultReference: null,
      startedAt,
      completedAt: null,
    },
  });

  if (acquired.count === 0) return existingOutcome(database, envelope.operationId);
  logger?.info(
    { event: "worker.job.started", operationId: envelope.operationId, jobType: envelope.jobType },
    "worker job started",
  );

  try {
    const result = ResultReferenceSchema.safeParse(await processor(envelope));
    if (!result.success) throw new NonRetryableJobError("JOB_RESULT_INVALID");
    await database.operation.update({
      where: { id: envelope.operationId },
      data: {
        status: "succeeded",
        resultReference: result.data,
        errorCode: null,
        completedAt: new Date(),
      },
    });
    logger?.info(
      { event: "worker.job.succeeded", operationId: envelope.operationId },
      "worker job succeeded",
    );
    return result.data;
  } catch (error) {
    const jobError = asJobExecutionError(error);
    await database.operation.update({
      where: { id: envelope.operationId },
      data: {
        status: "failed",
        errorCode: jobError.code,
        resultReference: null,
        completedAt: new Date(),
      },
    });
    logger?.error(
      { event: "worker.job.failed", operationId: envelope.operationId, errorCode: jobError.code },
      "worker job failed",
    );
    if (!jobError.retryable) throw new UnrecoverableError(jobError.code);
    throw jobError;
  }
}

export async function retainSchemaFailure(
  database: DatabaseClient,
  rawEnvelope: unknown,
): Promise<void> {
  const identity = JobIdentitySchema.safeParse(rawEnvelope);
  if (!identity.success) return;
  const timestamp = new Date();
  await database.operation.updateMany({
    where: {
      id: identity.data.operationId,
      organizationId: identity.data.scope.organizationId,
      jobType: identity.data.jobType,
      jobVersion: identity.data.jobVersion,
      idempotencyKey: identity.data.idempotencyKey,
      correlationId: identity.data.correlationId,
      status: { in: ["pending", "failed"] },
    },
    data: {
      status: "failed",
      attemptCount: { increment: 1 },
      errorCode: "JOB_SCHEMA_INVALID",
      resultReference: null,
      startedAt: timestamp,
      completedAt: timestamp,
    },
  });
}
