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
    await expect(service.enqueueAfterCommit(receipt)).resolves.toBe("analysis-job-recovered");
    expect(database.documentAnalysisRequest.findUnique).toHaveBeenCalledTimes(2);
    expect(enqueue).toHaveBeenCalledTimes(2);
  });

  it("refuses to enqueue before the durable request is visible", async () => {
    const enqueue = vi.fn();
    const service = new AnalysisJobEnqueuer(
      { documentAnalysisRequest: { findUnique: vi.fn(async () => null) } } as never,
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
});
