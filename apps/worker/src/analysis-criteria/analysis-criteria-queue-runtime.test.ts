import { describe, expect, it, vi } from "vitest";

import { AppError } from "@evaluation/contracts";
import { currentCorrelation } from "@evaluation/observability";

import { NonRetryableJobError } from "../queue/job-errors.js";
import {
  createAnalysisCriteriaQueueLifecycle,
  processAnalysisCriteriaQueueJob,
} from "./analysis-criteria-queue-runtime.js";

const envelope = {
  jobType: "analysis-criteria.process",
  jobVersion: 1,
  operationId: "50000000-0000-4000-8000-000000000001",
  correlationId: "50000000-0000-4000-8000-000000000002",
  scope: { organizationId: "50000000-0000-4000-8000-000000000003" },
  idempotencyKey: "analysis:queue-test",
  payload: {
    requestId: "50000000-0000-4000-8000-000000000001",
    payloadHash: "a".repeat(64),
    domainIdempotencyKey: "queue-test",
  },
} as const;

describe("analysis criteria dedicated queue runtime", () => {
  it("calls the dedicated processor directly with the strict envelope", async () => {
    const processor = {
      process: vi.fn(async () => {
        expect(currentCorrelation()).toMatchObject({
          correlationId: envelope.correlationId,
        });
        return "result:stable";
      }),
    };
    const job = { name: envelope.jobType, data: envelope, discard: vi.fn() };
    await expect(processAnalysisCriteriaQueueJob(processor as never, job)).resolves.toBe(
      "result:stable",
    );
    expect(processor.process).toHaveBeenCalledWith(envelope);
    expect(job.discard).not.toHaveBeenCalled();
  });

  it.each([
    ["envelope", "wrong.type", envelope],
    ["payload", envelope.jobType, { invalid: true }],
  ])("discards a non-retryable %s conflict", async (_label, name, data) => {
    const processor = { process: vi.fn() };
    const job = { name, data, discard: vi.fn() };
    await expect(
      processAnalysisCriteriaQueueJob(processor as never, job),
    ).rejects.toMatchObject({ retryable: false });
    expect(job.discard).toHaveBeenCalledOnce();
    expect(processor.process).not.toHaveBeenCalled();
  });

  it("preserves the processor retry classification", async () => {
    const processor = {
      process: vi.fn(async () => {
        throw new NonRetryableJobError("ANALYSIS_JOB_ACTOR_INVALID");
      }),
    };
    const job = { name: envelope.jobType, data: envelope, discard: vi.fn() };
    await expect(
      processAnalysisCriteriaQueueJob(processor as never, job),
    ).rejects.toMatchObject({
      code: "ANALYSIS_JOB_ACTOR_INVALID",
      retryable: false,
    });
    expect(job.discard).toHaveBeenCalledOnce();
  });

  it.each(["AI_OUTPUT_QUARANTINED", "AI_SOURCE_REFERENCE_INVALID"] as const)(
    "discards terminal %s AppErrors after the request is terminalized",
    async (code) => {
      const processor = {
        process: vi.fn(async () => {
          throw new AppError(code, "errors.ai.terminal", 502);
        }),
      };
      const job = { name: envelope.jobType, data: envelope, discard: vi.fn() };
      await expect(
        processAnalysisCriteriaQueueJob(processor as never, job),
      ).rejects.toMatchObject({ code });
      expect(job.discard).toHaveBeenCalledOnce();
    },
  );

  it("leaves retryable crashes eligible for BullMQ retry", async () => {
    const processor = {
      process: vi.fn(async () => {
        throw new Error("transient storage failure");
      }),
    };
    const job = { name: envelope.jobType, data: envelope, discard: vi.fn() };
    await expect(
      processAnalysisCriteriaQueueJob(processor as never, job),
    ).rejects.toThrow(/transient/u);
    expect(job.discard).not.toHaveBeenCalled();
  });

  it("starts without awaiting the long-lived worker loop and closes idempotently", async () => {
    let releaseRun!: () => void;
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseRun = resolve;
        }),
    );
    const workerClose = vi.fn(async () => releaseRun());
    const queueClose = vi.fn(async () => undefined);
    const eventsClose = vi.fn(async () => undefined);
    const runtime = createAnalysisCriteriaQueueLifecycle({
      queue: { waitUntilReady: vi.fn(async () => undefined), close: queueClose },
      queueEvents: {
        waitUntilReady: vi.fn(async () => undefined),
        close: eventsClose,
      },
      worker: {
        run,
        waitUntilReady: vi.fn(async () => undefined),
        close: workerClose,
      },
    });
    await expect(runtime.start()).resolves.toBeUndefined();
    await Promise.all([runtime.close(), runtime.close()]);
    expect(run).toHaveBeenCalledOnce();
    expect(workerClose).toHaveBeenCalledOnce();
    expect(queueClose).toHaveBeenCalledOnce();
    expect(eventsClose).toHaveBeenCalledOnce();
  });
});
