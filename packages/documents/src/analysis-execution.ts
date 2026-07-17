import { AppError } from "@evaluation/contracts";

type DocumentDatabase = import("./model.js").DocumentDatabase;

export type AnalysisExecutionOptions = Readonly<{
  heartbeatMs: number;
  leaseMs: number;
  maxAttempts: number;
}>;

export type AnalysisRequestSnapshot = Readonly<{
  id: string;
  kind: "readiness" | "comparison" | "criteria_project" | "criteria_workstream";
  state: "queued" | "running" | "succeeded" | "failed" | "superseded";
  operationId: string;
  resultReference: string | null;
  documentId: string;
  currentDocumentVersionId: string | null;
  beforeVersionId: string | null;
  afterVersionId: string | null;
  expectedAggregateVersion: number;
  promptArtifactId: string;
  promptVersion: string;
  promptHash: string;
  attemptCount: number;
}>;

const REQUEST_SELECT = {
  id: true,
  kind: true,
  state: true,
  operationId: true,
  resultReference: true,
  documentId: true,
  currentDocumentVersionId: true,
  beforeVersionId: true,
  afterVersionId: true,
  expectedAggregateVersion: true,
  promptArtifactId: true,
  promptVersion: true,
  promptHash: true,
} as const;

export async function claimAnalysisRequest(
  database: DocumentDatabase,
  input: Readonly<{
    requestId: string;
    kind: "readiness" | "comparison";
    now: Date;
    execution: AnalysisExecutionOptions;
  }>,
): Promise<AnalysisRequestSnapshot> {
  validateExecutionOptions(input.execution);
  return database.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM "DocumentAnalysisRequest" WHERE id = ${input.requestId}::uuid FOR UPDATE`;
    const request = await transaction.documentAnalysisRequest.findUnique({
      where: { id: input.requestId },
      select: REQUEST_SELECT,
    });
    if (request === null || request.kind !== input.kind) throw requestNotFound();

    const operation = await transaction.operation.findUnique({
      where: { id: request.operationId },
      select: { status: true, attemptCount: true, startedAt: true },
    });
    if (operation === null) throw requestNotFound();

    if (request.state === "succeeded" || request.state === "superseded") {
      return { ...request, attemptCount: operation.attemptCount };
    }
    if (request.state === "failed") throw requestFailed();

    const leaseCutoff = new Date(input.now.getTime() - input.execution.leaseMs);
    const acquired = await transaction.operation.updateMany({
      where: {
        id: request.operationId,
        attemptCount: { lt: input.execution.maxAttempts },
        OR: [
          { status: { in: ["pending", "failed"] } },
          { status: "running", startedAt: { lte: leaseCutoff } },
        ],
      },
      data: {
        status: "running",
        attemptCount: { increment: 1 },
        errorCode: null,
        resultReference: null,
        startedAt: input.now,
        completedAt: null,
      },
    });
    if (acquired.count === 0) {
      const runningLeaseExpired =
        operation.status === "running" &&
        (operation.startedAt === null || operation.startedAt <= leaseCutoff);
      if (operation.status === "running" && !runningLeaseExpired) throw requestRunning();
      if (operation.attemptCount >= input.execution.maxAttempts) {
        const terminalized = await terminalizeExhaustedRequest(
          transaction,
          request.id,
          request.operationId,
          operation.attemptCount,
          leaseCutoff,
          input.now,
        );
        if (!terminalized) throw requestRunning();
        throw retriesExhausted();
      }
      throw requestRunning();
    }

    if (request.state === "queued") {
      await transaction.documentAnalysisRequest.update({
        where: { id: request.id },
        data: { state: "running", startedAt: input.now, errorCode: null },
      });
    }
    return { ...request, state: "running", attemptCount: operation.attemptCount + 1 };
  });
}

export async function recordAnalysisFailure(
  database: DocumentDatabase,
  request: AnalysisRequestSnapshot,
  error: unknown,
  now: Date,
  execution: AnalysisExecutionOptions,
): Promise<void> {
  const retryable = isRetryableAnalysisFailure(error);
  const exhausted = request.attemptCount >= execution.maxAttempts;
  const operationErrorCode = retryable ? "ANALYSIS_RETRYABLE_FAILED" : "ANALYSIS_TERMINAL_FAILED";

  await database.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM "DocumentAnalysisRequest" WHERE id = ${request.id}::uuid FOR UPDATE`;
    const current = await transaction.documentAnalysisRequest.findUnique({
      where: { id: request.id },
      select: { state: true },
    });
    if (current?.state === "succeeded" || current?.state === "superseded") return;

    const fenced = await transaction.operation.updateMany({
      where: {
        id: request.operationId,
        status: "running",
        attemptCount: request.attemptCount,
      },
      data: {
        status: "failed",
        errorCode: operationErrorCode,
        resultReference: null,
        completedAt: now,
      },
    });
    if (fenced.count === 0) return;
    if ((!retryable || exhausted) && current?.state === "running") {
      await transaction.documentAnalysisRequest.update({
        where: { id: request.id },
        data: {
          state: "failed",
          errorCode: exhausted ? "ANALYSIS_RETRIES_EXHAUSTED" : operationErrorCode,
          completedAt: now,
        },
      });
    }
  });
}

export async function completeAnalysisOperation(
  database: DocumentDatabase,
  request: AnalysisRequestSnapshot,
  resultReference: string,
  now: Date,
): Promise<void> {
  await database.operation.updateMany({
    where: {
      id: request.operationId,
      status: "running",
      attemptCount: request.attemptCount,
    },
    data: {
      status: "succeeded",
      errorCode: null,
      resultReference,
      completedAt: now,
    },
  });
}

export async function withAnalysisHeartbeat<T>(
  database: DocumentDatabase,
  request: AnalysisRequestSnapshot,
  execution: AnalysisExecutionOptions,
  now: () => Date,
  work: () => Promise<T>,
): Promise<T> {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingHeartbeat: Promise<void> = Promise.resolve();
  let heartbeatFailure: unknown;

  const schedule = () => {
    if (stopped) return;
    timer = setTimeout(() => {
      pendingHeartbeat = heartbeatAnalysisOperation(database, request, now())
        .catch((error: unknown) => {
          heartbeatFailure = error;
        })
        .finally(schedule);
    }, execution.heartbeatMs);
    timer.unref?.();
  };

  schedule();
  try {
    const result = await work();
    return result;
  } finally {
    stopped = true;
    if (timer !== undefined) clearTimeout(timer);
    await pendingHeartbeat;
    if (heartbeatFailure !== undefined) throw heartbeatFailure;
  }
}

export async function assertAnalysisFence(
  transaction: import("./model.js").DocumentTransaction,
  request: Pick<AnalysisRequestSnapshot, "operationId" | "attemptCount">,
  now: Date,
): Promise<void> {
  const fenced = await transaction.operation.updateMany({
    where: {
      id: request.operationId,
      status: "running",
      attemptCount: request.attemptCount,
    },
    data: { startedAt: now },
  });
  if (fenced.count === 0) throw leaseLost();
}

export async function recordAnalysisEffect(
  transaction: import("./model.js").DocumentTransaction,
  request: Pick<AnalysisRequestSnapshot, "id" | "operationId" | "attemptCount">,
  resultReference: string,
): Promise<void> {
  await assertAnalysisFence(transaction, request, new Date());
  await transaction.operationEffectReceipt.create({
    data: {
      operationId: request.operationId,
      effectName: "validated-result",
      idempotencyKey: `analysis:${request.id}:validated-result`,
      receiptReference: resultReference,
    },
  });
}

export async function recordAnalysisOutbox(
  transaction: import("./model.js").DocumentTransaction,
  input: Readonly<{
    operationId: string;
    idempotencyKey: string;
    jobType: "analysis-criteria.process";
  }>,
): Promise<void> {
  await transaction.operationEffectReceipt.create({
    data: {
      operationId: input.operationId,
      effectName: "outbox-enqueued",
      idempotencyKey: `outbox:${input.idempotencyKey}`,
      receiptReference: `${input.jobType}:${input.operationId}`,
    },
  });
}

export function isRetryableAnalysisFailure(error: unknown): boolean {
  if (!(error instanceof AppError)) return true;
  return !new Set([
    "AI_OUTPUT_QUARANTINED",
    "AI_SOURCE_REFERENCE_INVALID",
    "DOCUMENT_EXTRACTION_INCOMPLETE",
    "RESOURCE_NOT_FOUND",
  ]).has(error.code);
}

export function validateAnalysisExecutionTiming(
  execution: AnalysisExecutionOptions,
  timeoutMs: number,
): void {
  validateExecutionOptions(execution);
  if (
    execution.heartbeatMs * 3 > execution.leaseMs ||
    timeoutMs + execution.heartbeatMs * 2 > execution.leaseMs
  ) {
    throw new TypeError("Analysis lease must safely exceed the heartbeat and Router timeout");
  }
}

async function heartbeatAnalysisOperation(
  database: DocumentDatabase,
  request: Pick<AnalysisRequestSnapshot, "operationId" | "attemptCount">,
  now: Date,
) {
  const heartbeat = await database.operation.updateMany({
    where: {
      id: request.operationId,
      status: "running",
      attemptCount: request.attemptCount,
    },
    data: { startedAt: now },
  });
  if (heartbeat.count === 0) throw leaseLost();
}

async function terminalizeExhaustedRequest(
  transaction: import("./model.js").DocumentTransaction,
  requestId: string,
  operationId: string,
  attemptCount: number,
  leaseCutoff: Date,
  now: Date,
) {
  const fenced = await transaction.operation.updateMany({
    where: {
      id: operationId,
      attemptCount,
      OR: [
        { status: { in: ["pending", "failed"] } },
        { status: "running", startedAt: { lte: leaseCutoff } },
      ],
    },
    data: {
      status: "failed",
      errorCode: "ANALYSIS_RETRYABLE_FAILED",
      resultReference: null,
      completedAt: now,
      startedAt: now,
    },
  });
  if (fenced.count === 0) return false;
  await transaction.documentAnalysisRequest.updateMany({
    where: { id: requestId, state: "running" },
    data: {
      state: "failed",
      errorCode: "ANALYSIS_RETRIES_EXHAUSTED",
      completedAt: now,
    },
  });
  return true;
}

function validateExecutionOptions(options: AnalysisExecutionOptions) {
  if (!Number.isInteger(options.maxAttempts) || options.maxAttempts < 1) {
    throw new TypeError("Analysis maxAttempts must be a positive integer");
  }
  if (!Number.isInteger(options.leaseMs) || options.leaseMs < 1) {
    throw new TypeError("Analysis leaseMs must be a positive integer");
  }
  if (!Number.isInteger(options.heartbeatMs) || options.heartbeatMs < 1) {
    throw new TypeError("Analysis heartbeatMs must be a positive integer");
  }
}

function requestNotFound() {
  return new AppError("RESOURCE_NOT_FOUND", "errors.documents.resourceNotFound", 404);
}
function requestRunning() {
  return new AppError("ANALYSIS_REQUEST_RUNNING", "errors.documents.analysisRequestRunning", 409);
}
function requestFailed() {
  return new AppError("ANALYSIS_REQUEST_FAILED", "errors.documents.analysisRequestFailed", 409);
}
function retriesExhausted() {
  return new AppError(
    "ANALYSIS_RETRIES_EXHAUSTED",
    "errors.documents.analysisRetriesExhausted",
    409,
  );
}
function leaseLost() {
  return new AppError("ANALYSIS_LEASE_LOST", "errors.documents.analysisLeaseLost", 409);
}
