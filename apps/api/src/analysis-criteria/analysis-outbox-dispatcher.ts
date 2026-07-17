type Database = Readonly<{
  operationEffectReceipt: {
    findMany(input: unknown): Promise<
      ReadonlyArray<
        Readonly<{
          operationId: string;
          operation: Readonly<{
            analysisRequest: Readonly<{ id: string }> | null;
          }>;
        }>
      >
    >;
  };
}>;

type AnalysisJobPort = Readonly<{
  enqueueAfterCommit(receipt: Readonly<{ requestId: string; operationId: string }>): Promise<string>;
}>;

export type AnalysisOutboxDispatchResult = Readonly<{
  attempted: number;
  delivered: number;
  failed: number;
}>;

export type TimerHandle = Readonly<{ unref?(): unknown }>;

export type TimerPort = Readonly<{
  setInterval(callback: () => void, intervalMs: number): TimerHandle;
  clearInterval(timer: TimerHandle): void;
}>;

const defaultTimers: TimerPort = {
  setInterval(callback, intervalMs) {
    return globalThis.setInterval(callback, intervalMs);
  },
  clearInterval(timer) {
    globalThis.clearInterval(timer as ReturnType<typeof globalThis.setInterval>);
  },
};

export function analysisOutboxReconcileInterval(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const raw = environment.ANALYSIS_OUTBOX_RECONCILE_MS;
  if (raw === undefined) return 30_000;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error("ANALYSIS_OUTBOX_RECONCILE_MS must be a positive integer");
  }
  return value;
}

export class AnalysisOutboxDispatcher {
  private inFlight: Promise<AnalysisOutboxDispatchResult> | undefined;
  private readonly database: Database;
  private readonly jobs: AnalysisJobPort;

  constructor(database: Database, jobs: AnalysisJobPort) {
    this.database = database;
    this.jobs = jobs;
  }

  scanOnce(): Promise<AnalysisOutboxDispatchResult> {
    this.inFlight ??= this.performScan().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  private async performScan(): Promise<AnalysisOutboxDispatchResult> {
    const rows = await this.database.operationEffectReceipt.findMany({
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
    let delivered = 0;
    let failed = 0;
    for (const row of rows) {
      const request = row.operation.analysisRequest;
      if (request === null) {
        failed += 1;
        continue;
      }
      try {
        await this.jobs.enqueueAfterCommit({
          requestId: request.id,
          operationId: row.operationId,
        });
        delivered += 1;
      } catch {
        failed += 1;
      }
    }
    return { attempted: rows.length, delivered, failed };
  }
}

export class AnalysisOutboxDispatcherLifecycle {
  private timer: TimerHandle | undefined;
  private readonly dispatcher: Pick<AnalysisOutboxDispatcher, "scanOnce">;
  private readonly intervalMs: number;
  private readonly timers: TimerPort;

  constructor(
    dispatcher: Pick<AnalysisOutboxDispatcher, "scanOnce">,
    intervalMs: number,
    timers: TimerPort = defaultTimers,
  ) {
    this.dispatcher = dispatcher;
    this.intervalMs = intervalMs;
    this.timers = timers;
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.dispatcher.scanOnce();
    this.timer = this.timers.setInterval(() => {
      void this.dispatcher.scanOnce().catch(() => undefined);
    }, this.intervalMs);
    this.timer.unref?.();
  }

  onApplicationShutdown(): void {
    if (this.timer === undefined) return;
    this.timers.clearInterval(this.timer);
    this.timer = undefined;
  }
}
