import { createHash } from "node:crypto";

import { UnrecoverableError } from "bullmq";
import { z } from "zod";

import { asJobExecutionError, NonRetryableJobError } from "./job-errors.js";

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
type TransactionOperation = Parameters<typeof import("@evaluation/database").withTransaction>[1];
type TransactionClient = Parameters<TransactionOperation>[0];
type JobEnvelope = import("@evaluation/contracts").JobEnvelope;

export interface ExternalEffectReceipt {
  readonly idempotencyKey: string;
  findReceipt(): Promise<string | null>;
  recordReceipt(receiptReference: string): Promise<void>;
}

export interface JobEffectContext {
  readonly transaction: TransactionClient;
  externalEffect(effectName: string): ExternalEffectReceipt;
}

export type JobProcessor = (envelope: JobEnvelope, context: JobEffectContext) => Promise<string>;

interface SafeLogger {
  info(fields: Readonly<Record<string, unknown>>, message?: string): void;
  error(fields: Readonly<Record<string, unknown>>, message?: string): void;
}

export function hashJobPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}

const EffectNameSchema = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(/^[a-z][a-z0-9-]*$/u);

function effectContext(transaction: TransactionClient, envelope: JobEnvelope): JobEffectContext {
  return {
    transaction,
    externalEffect(rawEffectName) {
      const effectName = EffectNameSchema.parse(rawEffectName);
      const idempotencyKey = `${envelope.idempotencyKey}:${effectName}`;
      return {
        idempotencyKey,
        async findReceipt() {
          const receipt = await transaction.operationEffectReceipt.findUnique({
            where: { operationId_effectName: { operationId: envelope.operationId, effectName } },
          });
          return receipt?.receiptReference ?? null;
        },
        async recordReceipt(rawReceiptReference) {
          const receiptReference = ResultReferenceSchema.parse(rawReceiptReference);
          await transaction.operationEffectReceipt.create({
            data: {
              operationId: envelope.operationId,
              effectName,
              idempotencyKey,
              receiptReference,
            },
          });
        },
      };
    },
  };
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

  if (acquired.count > 0) {
    logger?.info(
      { event: "worker.job.started", operationId: envelope.operationId, jobType: envelope.jobType },
      "worker job started",
    );
  }

  try {
    const outcome = await database.$transaction(
      async (transaction) => {
        await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "Operation"
          WHERE "id" = ${envelope.operationId}::uuid
          FOR UPDATE
        `;
        const operation = await transaction.operation.findUnique({
          where: { id: envelope.operationId },
        });
        if (operation === null) throw new NonRetryableJobError("JOB_OPERATION_NOT_FOUND");
        if (operation.status === "succeeded" && operation.resultReference !== null) {
          return { resultReference: operation.resultReference, processed: false } as const;
        }
        if (
          operation.organizationId !== envelope.scope.organizationId ||
          operation.jobType !== envelope.jobType ||
          operation.jobVersion !== envelope.jobVersion ||
          operation.idempotencyKey !== envelope.idempotencyKey ||
          operation.correlationId !== envelope.correlationId ||
          operation.payloadHash !== hashJobPayload(envelope.payload)
        ) {
          throw new NonRetryableJobError("JOB_OPERATION_MISMATCH");
        }

        if (operation.status !== "running") {
          await transaction.operation.update({
            where: { id: envelope.operationId },
            data: {
              status: "running",
              attemptCount: { increment: 1 },
              errorCode: null,
              resultReference: null,
              startedAt,
              completedAt: null,
            },
          });
        }

        const result = ResultReferenceSchema.safeParse(
          await processor(envelope, effectContext(transaction, envelope)),
        );
        if (!result.success) throw new NonRetryableJobError("JOB_RESULT_INVALID");
        await transaction.operation.update({
          where: { id: envelope.operationId },
          data: {
            status: "succeeded",
            resultReference: result.data,
            errorCode: null,
            completedAt: new Date(),
          },
        });
        return { resultReference: result.data, processed: true } as const;
      },
      { maxWait: 5_000, timeout: 30_000 },
    );
    if (!outcome.processed) return outcome.resultReference;
    logger?.info(
      { event: "worker.job.succeeded", operationId: envelope.operationId },
      "worker job succeeded",
    );
    return outcome.resultReference;
  } catch (error) {
    const jobError = asJobExecutionError(error);
    await database.operation.updateMany({
      where: { id: envelope.operationId, status: { in: ["pending", "running", "failed"] } },
      data: {
        status: "failed",
        ...(acquired.count === 0 ? { attemptCount: { increment: 1 } } : {}),
        errorCode: jobError.code,
        resultReference: null,
        startedAt,
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
