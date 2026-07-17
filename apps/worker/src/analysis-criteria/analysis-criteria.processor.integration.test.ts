import { describe, expect, it, vi } from "vitest";

import { AnalysisCriteriaProcessor } from "./analysis-criteria.processor.js";

const ids = {
  operationId: "00000000-0000-4000-8000-000000000001",
  requestId: "00000000-0000-4000-8000-000000000002",
  correlationId: "00000000-0000-4000-8000-000000000003",
  organizationId: "00000000-0000-4000-8000-000000000004",
  actorId: "00000000-0000-4000-8000-000000000005",
} as const;
const payloadHash = "a".repeat(64);

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    jobType: "analysis-criteria.process",
    jobVersion: 1,
    operationId: ids.operationId,
    correlationId: ids.correlationId,
    scope: { organizationId: ids.organizationId },
    idempotencyKey: "analysis:readiness-v1",
    payload: {
      requestId: ids.requestId,
      payloadHash,
      domainIdempotencyKey: "readiness-v1",
    },
    ...overrides,
  };
}

function fixture(
  overrides: Partial<{
    kind: "readiness" | "comparison" | "criteria_project" | "criteria_workstream";
    requestState: "queued" | "running" | "succeeded" | "failed" | "superseded";
    requestResult: string | null;
    operationState: "pending" | "running" | "succeeded" | "failed";
    operationResult: string | null;
    organizationId: string;
    operationId: string;
    jobType: string;
    jobVersion: number;
    correlationId: string;
    operationIdempotencyKey: string;
    domainIdempotencyKey: string;
    payloadHash: string;
    audit: null | { actorKind: string; actorId: string; correlationId: string };
    effectReference: string | null;
    domainReference: string | null;
  }> = {},
) {
  const resultReference = overrides.requestResult ?? null;
  const row = {
    id: ids.requestId,
    kind: overrides.kind ?? "readiness",
    operationId: overrides.operationId ?? ids.operationId,
    idempotencyKey: overrides.domainIdempotencyKey ?? "readiness-v1",
    payloadHash: overrides.payloadHash ?? payloadHash,
    state: overrides.requestState ?? "queued",
    resultReference,
    operation: {
      id: overrides.operationId ?? ids.operationId,
      organizationId: overrides.organizationId ?? ids.organizationId,
      correlationId: overrides.correlationId ?? ids.correlationId,
      idempotencyKey: overrides.operationIdempotencyKey ?? "analysis:readiness-v1",
      jobType: overrides.jobType ?? "analysis-criteria.process",
      jobVersion: overrides.jobVersion ?? 1,
      payloadHash: overrides.payloadHash ?? payloadHash,
      status: overrides.operationState ?? "pending",
      resultReference: overrides.operationResult ?? null,
    },
  };
  const audit =
    overrides.audit === undefined
      ? { actorKind: "human", actorId: ids.actorId, correlationId: ids.correlationId }
      : overrides.audit;
  const effectReference = overrides.effectReference ?? null;
  const domainReference = overrides.domainReference ?? null;
  let openTransactions = 0;
  const transaction = {
    $queryRaw: vi.fn(async () => []),
    documentAnalysisRequest: { findUnique: vi.fn(async () => row) },
    auditEvent: { findFirst: vi.fn(async () => audit) },
    operationEffectReceipt: {
      findUnique: vi.fn(async () =>
        effectReference === null ? null : { receiptReference: effectReference },
      ),
    },
    documentReadinessCheck: {
      findUnique: vi.fn(async () =>
        domainReference === null ? null : { outputReference: domainReference },
      ),
    },
    documentComparison: {
      findUnique: vi.fn(async () =>
        domainReference === null ? null : { outputReference: domainReference },
      ),
    },
  };
  const database = {
    $transaction: vi.fn(async (work: (value: typeof transaction) => Promise<unknown>) => {
      openTransactions += 1;
      try {
        return await work(transaction);
      } finally {
        openTransactions -= 1;
      }
    }),
  };
  const stableReference = `analysis-result:${ids.requestId}`;
  const handlers = {
    readiness: {
      process: vi.fn(async () => {
        expect(openTransactions).toBe(0);
        return stableReference;
      }),
    },
    comparison: {
      process: vi.fn(async () => {
        expect(openTransactions).toBe(0);
        return stableReference;
      }),
    },
    criteria: {
      process: vi.fn(async () => {
        expect(openTransactions).toBe(0);
        return stableReference;
      }),
    },
  };
  return {
    database,
    handlers,
    row,
    get openTransactions() {
      return openTransactions;
    },
    processor: new AnalysisCriteriaProcessor(database as never, handlers as never),
  };
}

describe("AnalysisCriteriaProcessor", () => {
  it.each([
    ["readiness", "readiness"],
    ["comparison", "comparison"],
    ["criteria_project", "criteria"],
    ["criteria_workstream", "criteria"],
  ] as const)("validates durably then dispatches %s outside the transaction", async (kind, handler) => {
    const harness = fixture({ kind });

    await expect(harness.processor.process(envelope())).resolves.toBe(
      `analysis-result:${ids.requestId}`,
    );

    expect(harness.handlers[handler].process).toHaveBeenCalledWith(
      ids.requestId,
      ids.actorId,
      ids.correlationId,
    );
    expect(harness.openTransactions).toBe(0);
  });

  it.each([
    ["organization", { organizationId: "00000000-0000-4000-8000-000000000099" }],
    ["operation id", { operationId: "00000000-0000-4000-8000-000000000099" }],
    ["job type", { jobType: "document.readiness" }],
    ["job version", { jobVersion: 2 }],
    ["correlation", { correlationId: "00000000-0000-4000-8000-000000000099" }],
    ["operation idempotency", { operationIdempotencyKey: "analysis:other" }],
    ["domain idempotency", { domainIdempotencyKey: "other" }],
    ["payload hash", { payloadHash: "b".repeat(64) }],
  ])("rejects mismatched durable %s identity as non-retryable", async (_label, mismatch) => {
    const harness = fixture(mismatch);

    await expect(harness.processor.process(envelope())).rejects.toMatchObject({
      code: "ANALYSIS_JOB_IDEMPOTENCY_CONFLICT",
      retryable: false,
    });
    expect(harness.handlers.readiness.process).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", null],
    [
      "non-human",
      { actorKind: "service", actorId: "worker", correlationId: ids.correlationId },
    ],
    [
      "wrong-correlation",
      {
        actorKind: "human",
        actorId: ids.actorId,
        correlationId: "00000000-0000-4000-8000-000000000099",
      },
    ],
  ])("rejects %s durable request actor audit", async (_label, audit) => {
    const harness = fixture({ audit });
    await expect(harness.processor.process(envelope())).rejects.toMatchObject({
      code: "ANALYSIS_JOB_ACTOR_INVALID",
      retryable: false,
    });
    expect(harness.handlers.readiness.process).not.toHaveBeenCalled();
  });

  it("replays only one result when request and operation agree on succeeded state", async () => {
    const resultReference = `document-readiness:${ids.requestId}`;
    const harness = fixture({
      requestState: "succeeded",
      requestResult: resultReference,
      operationState: "succeeded",
      operationResult: resultReference,
    });
    await expect(harness.processor.process(envelope())).resolves.toBe(resultReference);
    expect(harness.handlers.readiness.process).not.toHaveBeenCalled();
  });

  it("dispatches a committed request effect so its running Operation can be finalized", async () => {
    const resultReference = `document-readiness:${ids.requestId}`;
    const harness = fixture({
      requestState: "succeeded",
      requestResult: resultReference,
      operationState: "running",
      operationResult: null,
    });
    await expect(harness.processor.process(envelope())).resolves.toBe(
      `analysis-result:${ids.requestId}`,
    );
    expect(harness.handlers.readiness.process).toHaveBeenCalledOnce();
  });

  it("replays a superseded criteria effect only when the durable receipt and Operation agree", async () => {
    const resultReference = `criteria-superseded-request:${ids.requestId}`;
    const harness = fixture({
      kind: "criteria_project",
      requestState: "superseded",
      requestResult: null,
      operationState: "succeeded",
      operationResult: resultReference,
      effectReference: resultReference,
    });
    await expect(harness.processor.process(envelope())).resolves.toBe(resultReference);
    expect(harness.handlers.criteria.process).not.toHaveBeenCalled();
  });

  it("dispatches a superseded criteria effect while its Operation still needs finalization", async () => {
    const resultReference = `criteria-superseded-request:${ids.requestId}`;
    const harness = fixture({
      kind: "criteria_workstream",
      requestState: "superseded",
      requestResult: null,
      operationState: "running",
      operationResult: null,
      effectReference: resultReference,
    });
    await expect(harness.processor.process(envelope())).resolves.toBe(
      `analysis-result:${ids.requestId}`,
    );
    expect(harness.handlers.criteria.process).toHaveBeenCalledOnce();
  });

  it.each(["readiness", "comparison"] as const)(
    "dispatches a superseded %s domain result while its Operation still needs finalization",
    async (kind) => {
      const resultReference = `document-${kind}:${ids.requestId}`;
      const harness = fixture({
        kind,
        requestState: "superseded",
        requestResult: null,
        operationState: "running",
        operationResult: null,
        domainReference: resultReference,
      });
      await expect(harness.processor.process(envelope())).resolves.toBe(
        `analysis-result:${ids.requestId}`,
      );
      expect(harness.handlers[kind].process).toHaveBeenCalledOnce();
    },
  );

  it.each([
    ["operation pending", { operationState: "pending" as const, operationResult: null }],
    [
      "different operation result",
      {
        operationState: "succeeded" as const,
        operationResult: `document-readiness:00000000-0000-4000-8000-000000000099`,
      },
    ],
  ])("rejects inconsistent replay state: %s", async (_label, state) => {
    const harness = fixture({
      requestState: "succeeded",
      requestResult: `document-readiness:${ids.requestId}`,
      ...state,
    });
    await expect(harness.processor.process(envelope())).rejects.toMatchObject({
      code: "ANALYSIS_JOB_STATE_INCONSISTENT",
      retryable: false,
    });
  });
});
