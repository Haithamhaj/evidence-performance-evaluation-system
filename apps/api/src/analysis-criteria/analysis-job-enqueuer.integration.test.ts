import { describe, expect, it, vi } from "vitest";

import { AnalysisJobEnqueuer } from "./analysis-job-enqueuer.js";

describe("AnalysisJobEnqueuer", () => {
  it("enqueues the durable analysis request only after its transaction receipt exists", async () => {
    const requestId = crypto.randomUUID();
    const operationId = crypto.randomUUID();
    const organizationId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();
    const payloadHash = "a".repeat(64);
    const enqueue = vi.fn(async () => "analysis-job-1");
    const markDelivered = vi.fn(async () => ({ receiptReference: "analysis-job-1" }));
    const database = {
      documentAnalysisRequest: {
        findUnique: vi.fn(async () => ({
          id: requestId,
          operationId,
          payloadHash,
          idempotencyKey: "readiness-v1",
          operation: {
            organizationId,
            correlationId,
            idempotencyKey: "analysis:readiness-v1",
          },
        })),
      },
      operationEffectReceipt: { upsert: markDelivered },
    };
    const service = new AnalysisJobEnqueuer(database as never, { enqueue });

    await expect(
      service.enqueueAfterCommit({
        requestId,
        operationId,
      }),
    ).resolves.toBe("analysis-job-1");

    expect(enqueue).toHaveBeenCalledWith({
      jobType: "analysis-criteria.process",
      jobVersion: 1,
      operationId,
      correlationId,
      scope: { organizationId },
      idempotencyKey: "analysis:readiness-v1",
      payload: {
        requestId,
        payloadHash,
        domainIdempotencyKey: "readiness-v1",
      },
    });
    expect(markDelivered).toHaveBeenCalledWith({
      where: {
        operationId_effectName: {
          operationId,
          effectName: "outbox-dispatched",
        },
      },
      create: {
        operationId,
        effectName: "outbox-dispatched",
        idempotencyKey: `outbox-dispatched:${operationId}`,
        receiptReference: "analysis-job-1",
      },
      update: {},
    });
  });

  it("leaves the committed request retryable when queue delivery fails", async () => {
    const requestId = crypto.randomUUID();
    const operationId = crypto.randomUUID();
    const row = {
      id: requestId,
      operationId,
      payloadHash: "b".repeat(64),
      idempotencyKey: "comparison-v1",
      operation: {
        organizationId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        idempotencyKey: "analysis:comparison-v1",
      },
    };
    const database = {
      documentAnalysisRequest: { findUnique: vi.fn(async () => row) },
      operationEffectReceipt: {
        upsert: vi.fn(async () => ({ receiptReference: "analysis-job-recovered" })),
      },
    };
    const enqueue = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("redis unavailable"))
      .mockResolvedValueOnce("analysis-job-recovered");
    const service = new AnalysisJobEnqueuer(database as never, { enqueue });
    const receipt = {
      requestId,
      operationId,
    } as const;

    await expect(service.enqueueAfterCommit(receipt)).rejects.toThrow("redis unavailable");
    expect(database.operationEffectReceipt.upsert).not.toHaveBeenCalled();
    await expect(service.enqueueAfterCommit(receipt)).resolves.toBe("analysis-job-recovered");
    expect(database.documentAnalysisRequest.findUnique).toHaveBeenCalledTimes(2);
    expect(enqueue).toHaveBeenCalledTimes(2);
  });

  it("refuses to enqueue before the durable request is visible", async () => {
    const enqueue = vi.fn();
    const service = new AnalysisJobEnqueuer(
      {
        documentAnalysisRequest: { findUnique: vi.fn(async () => null) },
        operationEffectReceipt: { upsert: vi.fn() },
      } as never,
      { enqueue },
    );

    await expect(
      service.enqueueAfterCommit({
        requestId: crypto.randomUUID(),
        operationId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "ANALYSIS_REQUEST_NOT_COMMITTED", status: 409 });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("rejects a conflicting immutable delivery receipt", async () => {
    const requestId = crypto.randomUUID();
    const operationId = crypto.randomUUID();
    const enqueue = vi.fn(async () => "analysis-job-new");
    const service = new AnalysisJobEnqueuer(
      {
        documentAnalysisRequest: {
          findUnique: vi.fn(async () => ({
            id: requestId,
            operationId,
            payloadHash: "c".repeat(64),
            idempotencyKey: "readiness-conflict",
            operation: {
              organizationId: crypto.randomUUID(),
              correlationId: crypto.randomUUID(),
              idempotencyKey: "analysis:readiness-conflict",
            },
          })),
        },
        operationEffectReceipt: {
          upsert: vi.fn(async () => ({ receiptReference: "analysis-job-original" })),
        },
      } as never,
      { enqueue },
    );

    await expect(
      service.enqueueAfterCommit({ requestId, operationId }),
    ).rejects.toMatchObject({
      code: "ANALYSIS_QUEUE_RECEIPT_CONFLICT",
      status: 409,
    });
  });
});
