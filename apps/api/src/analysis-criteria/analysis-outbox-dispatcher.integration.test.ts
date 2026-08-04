import { describe, expect, it, vi } from "vitest";

import {
  AnalysisOutboxDispatcher,
  AnalysisOutboxDispatcherLifecycle,
  analysisOutboxReconcileInterval,
} from "./analysis-outbox-dispatcher.js";

describe("AnalysisOutboxDispatcher", () => {
  it("reconciles every committed undelivered analysis request without stopping on one failure", async () => {
    const rows = [
      {
        operationId: "60000000-0000-4000-8000-000000000001",
        operation: {
          analysisRequest: { id: "60000000-0000-4000-8000-000000000011" },
        },
      },
      {
        operationId: "60000000-0000-4000-8000-000000000002",
        operation: {
          analysisRequest: { id: "60000000-0000-4000-8000-000000000012" },
        },
      },
    ];
    const database = {
      operationEffectReceipt: {
        findMany: vi.fn(async () => rows),
      },
    };
    const enqueueAfterCommit = vi
      .fn()
      .mockRejectedValueOnce(new Error("redis unavailable"))
      .mockResolvedValueOnce("analysis-job-2");
    const dispatcher = new AnalysisOutboxDispatcher(
      database as never,
      { enqueueAfterCommit } as never,
    );

    await expect(dispatcher.scanOnce()).resolves.toEqual({
      attempted: 2,
      delivered: 1,
      failed: 1,
    });
    expect(database.operationEffectReceipt.findMany).toHaveBeenCalledWith({
      where: {
        effectName: "outbox-enqueued",
        operation: {
          jobType: "analysis-criteria.process",
          jobVersion: 1,
          status: { in: ["pending", "failed"] },
          effectReceipts: {
            none: { effectName: "outbox-dispatched" },
          },
          analysisRequest: { isNot: null },
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 100,
      select: {
        operationId: true,
        operation: {
          select: {
            analysisRequest: { select: { id: true } },
          },
        },
      },
    });
    expect(enqueueAfterCommit).toHaveBeenNthCalledWith(1, {
      requestId: rows[0]!.operation.analysisRequest.id,
      operationId: rows[0]!.operationId,
    });
    expect(enqueueAfterCommit).toHaveBeenNthCalledWith(2, {
      requestId: rows[1]!.operation.analysisRequest.id,
      operationId: rows[1]!.operationId,
    });
  });

  it("coalesces overlapping scans into one database pass", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const findMany = vi.fn(async () => {
      await gate;
      return [];
    });
    const dispatcher = new AnalysisOutboxDispatcher(
      { operationEffectReceipt: { findMany } } as never,
      { enqueueAfterCommit: vi.fn() } as never,
    );

    const first = dispatcher.scanOnce();
    const second = dispatcher.scanOnce();
    release();

    await expect(Promise.all([first, second])).resolves.toEqual([
      { attempted: 0, delivered: 0, failed: 0 },
      { attempted: 0, delivered: 0, failed: 0 },
    ]);
    expect(findMany).toHaveBeenCalledOnce();
  });

  it("scans at bootstrap and keeps one unrefed reconciliation timer until shutdown", async () => {
    const scanOnce = vi.fn(async () => ({ attempted: 0, delivered: 0, failed: 0 }));
    const unref = vi.fn();
    const timer = { unref };
    let scheduledCallback: (() => void) | undefined;
    const setInterval = vi.fn((callback: () => void, _intervalMs: number) => {
      scheduledCallback = callback;
      return timer;
    });
    const clearInterval = vi.fn();
    const lifecycle = new AnalysisOutboxDispatcherLifecycle({ scanOnce }, 12_000, {
      setInterval,
      clearInterval,
    } as never);

    await lifecycle.onApplicationBootstrap();

    expect(scanOnce).toHaveBeenCalledOnce();
    expect(setInterval).toHaveBeenCalledOnce();
    expect(setInterval.mock.calls[0]?.[1]).toBe(12_000);
    expect(unref).toHaveBeenCalledOnce();

    expect(scheduledCallback).toBeTypeOf("function");
    if (scheduledCallback === undefined) throw new Error("reconciliation timer was not scheduled");
    scheduledCallback();
    await vi.waitFor(() => expect(scanOnce).toHaveBeenCalledTimes(2));

    lifecycle.onApplicationShutdown();
    expect(clearInterval).toHaveBeenCalledWith(timer);
  });

  it("uses a bounded configurable reconciliation interval", () => {
    expect(analysisOutboxReconcileInterval({})).toBe(30_000);
    expect(
      analysisOutboxReconcileInterval({
        ANALYSIS_OUTBOX_RECONCILE_MS: "15000",
      }),
    ).toBe(15_000);
    expect(() =>
      analysisOutboxReconcileInterval({
        ANALYSIS_OUTBOX_RECONCILE_MS: "0",
      }),
    ).toThrow("ANALYSIS_OUTBOX_RECONCILE_MS must be a positive integer");
  });
});
