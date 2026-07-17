import { AppError, JobEnvelopeSchema } from "@evaluation/contracts";

type Receipt = Readonly<{
  requestId: string;
  operationId: string;
}>;

type Database = Readonly<{
  documentAnalysisRequest: {
    findUnique(input: unknown): Promise<Readonly<{
      id: string;
      operationId: string;
      payloadHash: string;
      idempotencyKey: string;
      operation: Readonly<{
        organizationId: string;
        correlationId: string;
        idempotencyKey: string;
      }>;
    }> | null>;
  };
}>;

type QueuePort = Readonly<{
  enqueue(envelope: import("@evaluation/contracts").JobEnvelope): Promise<string>;
}>;

export class AnalysisJobEnqueuer {
  constructor(
    private readonly database: Database,
    private readonly queue: QueuePort,
  ) {}

  async enqueueAfterCommit(receipt: Receipt): Promise<string> {
    const request = await this.database.documentAnalysisRequest.findUnique({
      where: { id: receipt.requestId },
      include: {
        operation: {
          select: {
            organizationId: true,
            correlationId: true,
            idempotencyKey: true,
          },
        },
      },
    });
    if (
      request === null ||
      request.id !== receipt.requestId ||
      request.operationId !== receipt.operationId
    ) {
      throw new AppError(
        "ANALYSIS_REQUEST_NOT_COMMITTED",
        "errors.analysisCriteria.requestNotCommitted",
        409,
      );
    }
    const envelope = JobEnvelopeSchema.parse({
      jobType: "analysis-criteria.process",
      jobVersion: 1,
      operationId: request.operationId,
      correlationId: request.operation.correlationId,
      scope: { organizationId: request.operation.organizationId },
      idempotencyKey: request.operation.idempotencyKey,
      payload: {
        requestId: request.id,
        payloadHash: request.payloadHash,
        domainIdempotencyKey: request.idempotencyKey,
      },
    });
    return this.queue.enqueue(envelope);
  }
}
