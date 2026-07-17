import { AppError, CriteriaGenerationOutputSchema } from "@evaluation/contracts";

type Database = import("@evaluation/database").DatabaseClient;
type Transaction = import("@evaluation/database").DatabaseTransaction;
type GenerationRequest = import("@evaluation/criteria").CriteriaGenerationRequestSnapshot;
type GenerationJob = Extract<
  import("@evaluation/contracts").AnalysisCriteriaJobPayload,
  { type: "criteria.generate.v1" }
>;

type ProposalPort = Readonly<{
  prepareGeneration(input: Readonly<{
    job: GenerationJob;
    readinessSourceReferences: readonly string[];
  }>): Promise<
    Readonly<{
      routeKey: "criteria.generate.project" | "criteria.generate.workstream";
      inputSchemaVersion: string;
      outputSchemaVersion: string;
      promptTemplateVersion: string;
      input: unknown;
      sourceReferences: readonly string[];
    }>
  >;
  persistValidatedGeneration(
    transaction: Transaction,
    request: GenerationRequest,
    output: unknown,
  ): Promise<Readonly<{ state: string }>>;
}>;

type RouterPort = Readonly<{
  run(
    input: Readonly<Record<string, unknown>>,
    persist: (
      transaction: Transaction,
      output: unknown,
    ) => Promise<Readonly<{ outputReference: string }>>,
  ): Promise<unknown>;
}>;

export type CriteriaPhaseSnapshot = Readonly<{
  request: GenerationRequest;
  job: GenerationJob;
  readinessSourceReferences: readonly string[];
}>;

export type CriteriaPhaseSnapshotReader = Readonly<{
  readIn(
    transaction: Transaction,
    input: Readonly<{ requestId: string; actorId: string; correlationId: string }>,
  ): Promise<CriteriaPhaseSnapshot | null>;
}>;

type Claimed = Readonly<{
  snapshot: CriteriaPhaseSnapshot;
  attemptCount: number;
  stableReference: string;
}>;

type Replay = Readonly<{
  attemptCount: number;
  stableReference: string;
}>;

export class CriteriaAnalysisPhaseHandler {
  private readonly database: Database;
  private readonly proposal: ProposalPort;
  private readonly router: RouterPort;
  private readonly snapshotReader: CriteriaPhaseSnapshotReader;
  private readonly options: Readonly<{
    systemId: string;
    timeoutMs: number;
    execution: { heartbeatMs: number; leaseMs: number; maxAttempts: number };
    now?: () => Date;
  }>;

  constructor(
    database: Database,
    proposal: ProposalPort,
    router: RouterPort,
    snapshotReader: CriteriaPhaseSnapshotReader,
    options: Readonly<{
      systemId: string;
      timeoutMs: number;
      execution: { heartbeatMs: number; leaseMs: number; maxAttempts: number };
      now?: () => Date;
    }>,
  ) {
    this.database = database;
    this.proposal = proposal;
    this.router = router;
    this.snapshotReader = snapshotReader;
    this.options = options;
  }

  async process(requestId: string, actorId: string, correlationId: string): Promise<string> {
    validateTiming(this.options);
    const claimed = await this.claim(requestId, actorId, correlationId);
    if ("replay" in claimed) {
      await this.complete(requestId, claimed.attemptCount, claimed.stableReference);
      return claimed.stableReference;
    }

    try {
      let persistedReference = claimed.stableReference;
      await this.withHeartbeat(
        claimed.snapshot.request.operationId,
        claimed.attemptCount,
        async () => {
          const prepared = await this.proposal.prepareGeneration({
            job: claimed.snapshot.job,
            readinessSourceReferences: claimed.snapshot.readinessSourceReferences,
          });
          await this.router.run(
            {
              routeKey: prepared.routeKey,
              projectId: claimed.snapshot.request.projectId,
              departmentId: claimed.snapshot.request.departmentId,
              systemId: this.options.systemId,
              input: prepared.input,
              inputReference: `document-version:${claimed.snapshot.request.documentVersionId}`,
              inputSchemaVersion: prepared.inputSchemaVersion,
              outputSchemaVersion: prepared.outputSchemaVersion,
              promptTemplateVersion: prepared.promptTemplateVersion,
              outputSchema: CriteriaGenerationOutputSchema,
              sourceReferences: [...prepared.sourceReferences],
              classification: "confidential",
              timeoutMs: this.options.timeoutMs,
              requiresHumanApproval: true,
              correlationId,
            },
            async (transaction, output) => {
              await assertFence(
                transaction,
                claimed.snapshot.request.operationId,
                claimed.attemptCount,
                this.options.now?.() ?? new Date(),
              );
              const effectKey = effectIdempotencyKey(requestId);
              const recorded = await transaction.operationEffectReceipt.findUnique({
                where: { idempotencyKey: effectKey },
                select: { receiptReference: true },
              });
              if (recorded !== null) {
                persistedReference = recorded.receiptReference;
                return { outputReference: recorded.receiptReference };
              }
              const parsedOutput = CriteriaGenerationOutputSchema.parse(output);
              assertBoundCriteriaSources(parsedOutput, prepared.sourceReferences);
              const detail = await this.proposal.persistValidatedGeneration(
                transaction,
                {
                  ...claimed.snapshot.request,
                  state: "running",
                  outputReference: claimed.stableReference,
                },
                parsedOutput,
              );
              persistedReference =
                detail.state === "superseded"
                  ? `criteria-superseded-request:${requestId}`
                  : claimed.stableReference;
              await transaction.operationEffectReceipt.create({
                data: {
                  operationId: claimed.snapshot.request.operationId,
                  effectName: "validated-result",
                  idempotencyKey: effectKey,
                  receiptReference: persistedReference,
                },
              });
              return { outputReference: persistedReference };
            },
          );
        },
      );
      await this.complete(requestId, claimed.attemptCount, persistedReference);
      return persistedReference;
    } catch (error) {
      if (await this.effectCommitted(requestId)) throw error;
      await this.recordFailure(requestId, claimed.attemptCount, error);
      throw error;
    }
  }

  private async claim(requestId: string, actorId: string, correlationId: string): Promise<
    (Claimed & { replay?: never }) | (Replay & { replay: true })
  > {
    const now = this.options.now?.() ?? new Date();
    const result = await this.database.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT request.id
        FROM "DocumentAnalysisRequest" request
        INNER JOIN "Operation" operation ON operation.id = request."operationId"
        WHERE request.id = ${requestId}::uuid
        FOR UPDATE OF request, operation
      `;
      const request = await transaction.documentAnalysisRequest.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          kind: true,
          state: true,
          operationId: true,
          resultReference: true,
        },
      });
      if (
        request === null ||
        !["criteria_project", "criteria_workstream"].includes(request.kind)
      )
        throw requestNotFound();
      const operation = await transaction.operation.findUnique({
        where: { id: request.operationId },
        select: { status: true, attemptCount: true, startedAt: true, resultReference: true },
      });
      if (operation === null) throw requestNotFound();
      if (
        (request.state === "succeeded" || request.state === "superseded") &&
        request.resultReference !== null
      ) {
        if (
          operation.status === "succeeded" &&
          operation.resultReference !== request.resultReference
        )
          throw stateInconsistent();
        return {
          replay: true as const,
          attemptCount: operation.attemptCount,
          stableReference: request.resultReference,
        };
      }
      if (request.state === "superseded") {
        const effect = await transaction.operationEffectReceipt.findUnique({
          where: { idempotencyKey: effectIdempotencyKey(requestId) },
          select: { receiptReference: true },
        });
        if (effect === null) throw stateInconsistent();
        return {
          replay: true as const,
          attemptCount: operation.attemptCount,
          stableReference: effect.receiptReference,
        };
      }
      if (request.state === "failed") throw requestFailed();

      const leaseCutoff = new Date(now.getTime() - this.options.execution.leaseMs);
      const acquired = await transaction.operation.updateMany({
        where: {
          id: request.operationId,
          attemptCount: { lt: this.options.execution.maxAttempts },
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
          startedAt: now,
          completedAt: null,
        },
      });
      if (acquired.count !== 1) {
        const leaseExpired =
          operation.status === "running" &&
          (operation.startedAt === null || operation.startedAt <= leaseCutoff);
        if (
          operation.attemptCount >= this.options.execution.maxAttempts &&
          (["pending", "failed"].includes(operation.status) || leaseExpired)
        ) {
          await transaction.operation.updateMany({
            where: {
              id: request.operationId,
              attemptCount: operation.attemptCount,
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
          await transaction.documentAnalysisRequest.updateMany({
            where: { id: request.id, state: "running" },
            data: {
              state: "failed",
              errorCode: "ANALYSIS_RETRIES_EXHAUSTED",
              completedAt: now,
            },
          });
          return { terminal: true as const };
        }
        throw requestRunning();
      }
      if (request.state === "queued") {
        await transaction.documentAnalysisRequest.update({
          where: { id: request.id },
          data: { state: "running", startedAt: now, errorCode: null },
        });
      }
      const snapshot = await this.snapshotReader.readIn(transaction, {
        requestId,
        actorId,
        correlationId,
      });
      if (snapshot === null || snapshot.request.operationId !== request.operationId)
        throw requestNotFound();
      return {
        snapshot,
        attemptCount: operation.attemptCount + 1,
        stableReference: `criteria-proposal-request:${requestId}`,
      };
    });
    if ("terminal" in result) throw retriesExhausted();
    return result;
  }

  private async complete(
    requestId: string,
    attemptCount: number,
    stableReference: string,
  ): Promise<void> {
    const completedAt = this.options.now?.() ?? new Date();
    await this.database.$transaction(async (transaction) => {
      const request = await transaction.documentAnalysisRequest.findUnique({
        where: { id: requestId },
        select: { operationId: true, resultReference: true, state: true },
      });
      if (request === null) throw stateInconsistent();
      const effect =
        request.state === "superseded"
          ? await transaction.operationEffectReceipt.findUnique({
              where: { idempotencyKey: effectIdempotencyKey(requestId) },
              select: { receiptReference: true },
            })
          : null;
      const durableResultMatches =
        (request.state === "succeeded" && request.resultReference === stableReference) ||
        (request.state === "superseded" && effect?.receiptReference === stableReference);
      if (!durableResultMatches) throw stateInconsistent();
      const completed = await transaction.operation.updateMany({
        where: { id: request.operationId, status: "running", attemptCount },
        data: {
          status: "succeeded",
          errorCode: null,
          resultReference: stableReference,
          completedAt,
        },
      });
      if (completed.count === 0) {
        const operation = await transaction.operation.findUnique({
          where: { id: request.operationId },
          select: { status: true, resultReference: true },
        });
        if (
          operation?.status !== "succeeded" ||
          operation.resultReference !== stableReference
        )
          throw stateInconsistent();
      }
    });
  }

  private async effectCommitted(requestId: string): Promise<boolean> {
    const [request, effect] = await Promise.all([
      this.database.documentAnalysisRequest.findUnique({
        where: { id: requestId },
        select: { state: true, resultReference: true },
      }),
      this.database.operationEffectReceipt.findUnique({
        where: { idempotencyKey: effectIdempotencyKey(requestId) },
        select: { receiptReference: true },
      }),
    ]);
    return request?.state === "succeeded"
      ? request.resultReference !== null &&
          request.resultReference === effect?.receiptReference
      : request?.state === "superseded" && effect !== null;
  }

  private async recordFailure(
    requestId: string,
    attemptCount: number,
    error: unknown,
  ): Promise<void> {
    const retryable = isRetryable(error);
    const exhausted = attemptCount >= this.options.execution.maxAttempts;
    await this.database.$transaction(async (transaction) => {
      const request = await transaction.documentAnalysisRequest.findUnique({
        where: { id: requestId },
        select: { operationId: true, state: true },
      });
      if (request === null || request.state !== "running") return;
      const failed = await transaction.operation.updateMany({
        where: { id: request.operationId, status: "running", attemptCount },
        data: {
          status: "failed",
          errorCode: retryable
            ? "ANALYSIS_RETRYABLE_FAILED"
            : "ANALYSIS_TERMINAL_FAILED",
          completedAt: this.options.now?.() ?? new Date(),
        },
      });
      if (failed.count === 1 && (!retryable || exhausted)) {
        await transaction.documentAnalysisRequest.updateMany({
          where: { id: requestId, state: "running" },
          data: {
            state: "failed",
            errorCode: exhausted
              ? "ANALYSIS_RETRIES_EXHAUSTED"
              : "ANALYSIS_TERMINAL_FAILED",
            completedAt: this.options.now?.() ?? new Date(),
          },
        });
      }
    });
  }

  private async withHeartbeat<T>(
    operationId: string,
    attemptCount: number,
    work: () => Promise<T>,
  ): Promise<T> {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: Promise<void> = Promise.resolve();
    let heartbeatFailure: unknown;
    const schedule = () => {
      if (stopped) return;
      timer = setTimeout(() => {
        pending = this.database.operation
          .updateMany({
            where: { id: operationId, status: "running", attemptCount },
            data: { startedAt: this.options.now?.() ?? new Date() },
          })
          .then((result) => {
            if (result.count !== 1) throw leaseLost();
          })
          .catch((error: unknown) => {
            heartbeatFailure = error;
          })
          .finally(schedule);
      }, this.options.execution.heartbeatMs);
      timer.unref?.();
    };
    schedule();
    try {
      const result = await work();
      return result;
    } finally {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      await pending;
      if (heartbeatFailure !== undefined) throw heartbeatFailure;
    }
  }
}

function effectIdempotencyKey(requestId: string): string {
  return `analysis:${requestId}:validated-result`;
}

function validateTiming(options: Readonly<{
  timeoutMs: number;
  execution: { heartbeatMs: number; leaseMs: number; maxAttempts: number };
}>): void {
  if (
    !Number.isInteger(options.timeoutMs) ||
    options.timeoutMs < 1 ||
    !Number.isInteger(options.execution.maxAttempts) ||
    options.execution.maxAttempts < 1 ||
    !Number.isInteger(options.execution.heartbeatMs) ||
    options.execution.heartbeatMs < 1 ||
    !Number.isInteger(options.execution.leaseMs) ||
    options.execution.leaseMs < 1 ||
    options.execution.heartbeatMs * 3 > options.execution.leaseMs ||
    options.timeoutMs + options.execution.heartbeatMs * 2 >
      options.execution.leaseMs
  )
    throw new TypeError(
      "Analysis lease must safely exceed the heartbeat and Router timeout",
    );
}

function requestNotFound(): AppError {
  return new AppError("ANALYSIS_REQUEST_NOT_FOUND", "errors.analysis.requestNotFound", 404);
}

function requestFailed(): AppError {
  return new AppError("ANALYSIS_REQUEST_FAILED", "errors.analysis.requestFailed", 409);
}

function requestRunning(): AppError {
  return new AppError("ANALYSIS_REQUEST_RUNNING", "errors.analysis.requestRunning", 409);
}

function stateInconsistent(): AppError {
  return new AppError(
    "ANALYSIS_JOB_STATE_INCONSISTENT",
    "errors.analysis.stateInconsistent",
    409,
  );
}

async function assertFence(
  transaction: Transaction,
  operationId: string,
  attemptCount: number,
  now: Date,
): Promise<void> {
  const fenced = await transaction.operation.updateMany({
    where: { id: operationId, status: "running", attemptCount },
    data: { startedAt: now },
  });
  if (fenced.count !== 1) throw leaseLost();
}

function leaseLost(): AppError {
  return new AppError("ANALYSIS_LEASE_LOST", "errors.analysis.leaseLost", 409);
}

function retriesExhausted(): AppError {
  return new AppError(
    "ANALYSIS_RETRIES_EXHAUSTED",
    "errors.analysis.retriesExhausted",
    409,
  );
}

function isRetryable(error: unknown): boolean {
  if (!(error instanceof AppError)) return true;
  return !new Set([
    "AI_OUTPUT_QUARANTINED",
    "AI_SOURCE_REFERENCE_INVALID",
    "CRITERIA_COUNT_INVALID",
    "DOCUMENT_EXTRACTION_INCOMPLETE",
    "RESOURCE_NOT_FOUND",
  ]).has(error.code);
}

function assertBoundCriteriaSources(
  output: import("@evaluation/contracts").CriteriaGenerationOutput,
  allowedReferences: readonly string[],
): void {
  const allowed = new Set(allowedReferences);
  if (
    output.criteria.some((criterion) =>
      criterion.sourceReferences.some((reference) => !allowed.has(reference)),
    )
  ) {
    throw new AppError(
      "AI_SOURCE_REFERENCE_INVALID",
      "errors.ai.sourceReferenceInvalid",
      502,
    );
  }
}
