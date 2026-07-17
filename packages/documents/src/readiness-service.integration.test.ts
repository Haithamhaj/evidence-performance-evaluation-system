import { AppError } from "@evaluation/contracts";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import {
  completeAnalysisOperation,
  recordAnalysisEffect,
  recordAnalysisFailure,
} from "./analysis-execution.js";
import { ReadinessService, mapManagerReadiness } from "./readiness-service.js";

const requestId = "00000000-0000-4000-8000-000000000001";
const versionId = "00000000-0000-4000-8000-000000000002";
const documentId = "00000000-0000-4000-8000-000000000003";
const actorId = "00000000-0000-4000-8000-000000000004";
const correlationId = "00000000-0000-4000-8000-000000000005";
const operationId = "00000000-0000-4000-8000-000000000006";
const now = new Date("2026-07-17T12:00:00.000Z");

function processHarness(
  options: {
    loaderError?: Error;
    routerError?: Error;
    initialRequest?: Partial<Record<string, any>>;
    initialOperation?: Partial<Record<string, any>>;
    deferRouter?: boolean;
    clock?: { value: Date };
    execution?: { heartbeatMs: number; leaseMs: number; maxAttempts: number };
    timeoutMs?: number;
  } = {},
) {
  let inTransaction = false;
  const row: Record<string, any> = {
    id: requestId,
    kind: "readiness",
    state: "queued",
    operationId,
    resultReference: null,
    documentId,
    currentDocumentVersionId: versionId,
    beforeVersionId: null,
    afterVersionId: null,
    expectedAggregateVersion: 1,
    promptArtifactId: crypto.randomUUID(),
    promptVersion: "document-readiness.v2",
    promptHash: "a".repeat(64),
    ...options.initialRequest,
  };
  const operation: Record<string, any> = {
    id: operationId,
    status: "pending",
    attemptCount: 0,
    startedAt: null,
    completedAt: null,
    errorCode: null,
    resultReference: null,
    ...options.initialOperation,
  };
  const transaction = {
    $queryRaw: vi.fn(async () => []),
    documentAnalysisRequest: {
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (where.state !== undefined && row.state !== where.state) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
      findUnique: vi.fn(async () => ({ ...row })),
      update: vi.fn(async ({ data }: any) => Object.assign(row, data)),
    },
    operation: {
      findUnique: vi.fn(async () => ({ ...operation })),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const statuses =
          where.status?.in ?? (where.status === undefined ? undefined : [where.status]);
        if (statuses !== undefined && !statuses.includes(operation.status)) return { count: 0 };
        if (typeof where.attemptCount === "number" && operation.attemptCount !== where.attemptCount)
          return { count: 0 };
        if (where.attemptCount?.lt !== undefined && operation.attemptCount >= where.attemptCount.lt)
          return { count: 0 };
        if (where.OR !== undefined) {
          const claimable = where.OR.some((candidate: any) => {
            if (candidate.status?.in?.includes(operation.status)) return true;
            return (
              candidate.status === operation.status &&
              candidate.startedAt?.lte !== undefined &&
              operation.startedAt <= candidate.startedAt.lte
            );
          });
          if (!claimable) return { count: 0 };
        }
        if (data.attemptCount?.increment !== undefined)
          operation.attemptCount += data.attemptCount.increment;
        Object.assign(operation, { ...data, attemptCount: operation.attemptCount });
        return { count: 1 };
      }),
    },
    operationEffectReceipt: { create: vi.fn() },
    documentReadinessCheck: {
      findUnique: vi.fn(async () => null),
    },
  };
  const database = {
    ...transaction,
    $transaction: vi.fn(async (callback: (tx: any) => Promise<any>) => {
      inTransaction = true;
      try {
        return await callback(transaction);
      } finally {
        inTransaction = false;
      }
    }),
  };
  let releaseLoader!: () => void;
  const loaderGate = new Promise<void>((resolve) => {
    releaseLoader = resolve;
  });
  const sourceLoader = {
    load: vi.fn(async () => {
      await loaderGate;
      if (options.loaderError !== undefined) throw options.loaderError;
      return {
        identity: {
          kind: "project",
          resourceId: crypto.randomUUID(),
          projectId: crypto.randomUUID(),
          organizationId: crypto.randomUUID(),
          departmentId: crypto.randomUUID(),
          status: "active",
        },
        documentId,
        documentVersionId: versionId,
        documentVersion: 1,
        currentVersion: 1,
        templateVersionId: crypto.randomUUID(),
        templateSections: [{ key: "scope", required: true, protected: true }],
        sources: [
          {
            reference: `document-source:${crypto.randomUUID()}`,
            sourceType: "upload",
            mediaType: "text/markdown",
            openStream: async () => Readable.from(["scope"]),
          },
        ],
        sourceReferences: [`document-source:${crypto.randomUUID()}`],
      };
    }),
  };
  let releaseRouter!: () => void;
  const routerGate = new Promise<void>((resolve) => {
    releaseRouter = resolve;
  });
  const router = {
    run: vi.fn(async () => {
      expect(inTransaction).toBe(false);
      if (options.deferRouter === true) await routerGate;
      if (options.routerError !== undefined) throw options.routerError;
      return {
        runId: crypto.randomUUID(),
        output: {},
        outputReference: `document-readiness:${crypto.randomUUID()}`,
        requiresHumanApproval: false,
      };
    }),
  };
  const service = new ReadinessService(
    database as never,
    {} as never,
    sourceLoader as never,
    router as never,
    {} as never,
    vi.fn(),
    {
      systemId: crypto.randomUUID(),
      timeoutMs: options.timeoutMs ?? 1_000,
      extractionPolicy: {
        maxSourceBytes: 1_000,
        maxArchiveEntries: 10,
        maxArchiveUncompressedBytes: 5_000,
        maxArchiveCompressionRatio: 20,
      },
      execution: options.execution ?? { heartbeatMs: 10_000, leaseMs: 60_000, maxAttempts: 3 },
      now: () => options.clock?.value ?? now,
    },
  );
  return {
    database,
    operation,
    releaseLoader,
    releaseRouter,
    router,
    row,
    service,
    sourceLoader,
    transaction,
  };
}

function managerReadHarness() {
  const projectId = crypto.randomUUID();
  const departmentId = crypto.randomUUID();
  const findFirst = vi.fn(async ({ select }: any) =>
    select?.managerState === true
      ? { managerState: "needs_attention" }
      : {
          id: crypto.randomUUID(),
          documentVersionId: versionId,
          output: {},
          createdAt: now,
          lifecycleTransitions: [],
        },
  );
  const database = {
    documentRecord: {
      findUnique: vi.fn(async () => ({ projectId, workstreamId: null })),
    },
    user: { findUnique: vi.fn(async () => ({ active: true })) },
    roleAssignment: {
      findMany: vi.fn(async () => [
        { role: "manager", scopeType: "department", scopeId: departmentId },
      ]),
    },
    authorizationScope: { findFirst: vi.fn(async () => ({ id: departmentId })) },
    responsibilityWindow: { findMany: vi.fn(async () => []) },
    documentReadinessCheck: { findFirst },
  };
  const service = new ReadinessService(
    database as never,
    {
      read: vi.fn(async () => ({
        kind: "project" as const,
        resourceId: projectId,
        projectId,
        organizationId: crypto.randomUUID(),
        departmentId,
        status: "active" as const,
      })),
    },
    {} as never,
    {} as never,
    {} as never,
    vi.fn(),
    {
      systemId: crypto.randomUUID(),
      timeoutMs: 1_000,
      extractionPolicy: {
        maxSourceBytes: 1,
        maxArchiveEntries: 1,
        maxArchiveUncompressedBytes: 1,
        maxArchiveCompressionRatio: 1,
      },
      execution: { heartbeatMs: 10_000, leaseMs: 60_000, maxAttempts: 3 },
    },
  );
  return { findFirst, service };
}

function requestHarness() {
  const projectId = crypto.randomUUID();
  const departmentId = crypto.randomUUID();
  const prompt = {
    id: crypto.randomUUID(),
    bodyHash: "a".repeat(64),
  };
  const schema = {
    id: crypto.randomUUID(),
    schemaHash: "b".repeat(64),
  };
  let createdRequest: Record<string, any> | null = null;
  const operationCreate = vi.fn(async () => ({}));
  const requestCreate = vi.fn(async ({ data }: any) => {
    createdRequest = { id: crypto.randomUUID(), ...data };
    return createdRequest;
  });
  const transaction = {
    $queryRaw: vi.fn(async () => []),
    user: { findUnique: vi.fn(async () => ({ active: true })) },
    roleAssignment: {
      findMany: vi.fn(async () => [
        { role: "project_owner", scopeType: "project", scopeId: projectId },
      ]),
    },
    authorizationScope: { findFirst: vi.fn(async () => ({ id: departmentId })) },
    responsibilityWindow: {
      findMany: vi.fn(async () => [
        {
          projectId,
          workstreamId: null,
          responsibilityType: "original",
          startsAt: new Date("2026-01-01T00:00:00.000Z"),
          endsAt: null,
        },
      ]),
    },
    documentRecord: {
      findUnique: vi.fn(async () => ({ id: documentId, currentVersion: 1 })),
    },
    documentVersion: { findUnique: vi.fn(async () => ({ id: versionId })) },
    analysisPromptArtifact: { findUnique: vi.fn(async () => prompt) },
    aiOutputSchemaArtifact: { findUnique: vi.fn(async () => schema) },
    operation: { create: operationCreate },
    documentAnalysisRequest: {
      findUnique: vi.fn(async () => createdRequest),
      findFirst: vi.fn(async () => null),
      create: requestCreate,
    },
  };
  const database = {
    documentRecord: {
      findUnique: vi.fn(async () => ({ projectId, workstreamId: null })),
    },
    $transaction: vi.fn(async (callback: (tx: any) => Promise<any>) => callback(transaction)),
  };
  const enqueue = vi.fn();
  const audit = { append: vi.fn() };
  const service = new ReadinessService(
    database as never,
    {
      read: vi.fn(async () => ({
        kind: "project" as const,
        resourceId: projectId,
        projectId,
        organizationId: crypto.randomUUID(),
        departmentId,
        status: "active" as const,
      })),
    },
    {} as never,
    {} as never,
    audit as never,
    enqueue,
    {
      systemId: crypto.randomUUID(),
      timeoutMs: 1_000,
      extractionPolicy: {
        maxSourceBytes: 1,
        maxArchiveEntries: 1,
        maxArchiveUncompressedBytes: 1,
        maxArchiveCompressionRatio: 1,
      },
      execution: { heartbeatMs: 10_000, leaseMs: 60_000, maxAttempts: 3 },
      now: () => now,
    },
  );
  return { audit, enqueue, operationCreate, prompt, requestCreate, service };
}

describe("ReadinessService", () => {
  it("claims once atomically and never performs a second Router call for a running request", async () => {
    const test = processHarness();
    const first = test.service.process(requestId, actorId, correlationId);
    await vi.waitFor(() => expect(test.row.state).toBe("running"));
    const second = test.service.process(requestId, actorId, correlationId);
    await expect(second).rejects.toMatchObject({ code: "ANALYSIS_REQUEST_RUNNING" });
    test.releaseLoader();
    await first;
    expect(test.router.run).toHaveBeenCalledOnce();
    expect(test.sourceLoader.load).toHaveBeenCalledOnce();
  });

  it("heartbeats a deferred Router attempt so it cannot be reclaimed after the original lease", async () => {
    const clock = { value: now };
    const test = processHarness({
      clock,
      deferRouter: true,
      execution: { heartbeatMs: 10, leaseMs: 40, maxAttempts: 1 },
      timeoutMs: 5,
    });
    const first = test.service.process(requestId, actorId, correlationId);
    test.releaseLoader();
    await vi.waitFor(() => expect(test.router.run).toHaveBeenCalledOnce());
    clock.value = new Date(now.getTime() + 100);
    await new Promise((resolve) => setTimeout(resolve, 30));

    const second = test.service.process(requestId, actorId, correlationId);
    const outcome = await Promise.race([
      second.then(
        () => "resolved",
        (error: AppError) => error.code,
      ),
      new Promise<string>((resolve) => setTimeout(() => resolve("pending"), 30)),
    ]);
    test.releaseRouter();
    await Promise.allSettled([first, second]);
    expect(outcome).toBe("ANALYSIS_REQUEST_RUNNING");
    expect(test.router.run).toHaveBeenCalledOnce();
  });

  it("reclaims an abandoned running attempt after its heartbeat lease expires", async () => {
    const clock = { value: new Date(now.getTime() + 100) };
    const test = processHarness({
      clock,
      initialRequest: { state: "running" },
      initialOperation: { status: "running", attemptCount: 1, startedAt: now },
      execution: { heartbeatMs: 10, leaseMs: 40, maxAttempts: 3 },
      timeoutMs: 5,
    });
    test.releaseLoader();
    await expect(test.service.process(requestId, actorId, correlationId)).resolves.toMatch(
      /^document-readiness:/u,
    );
    expect(test.operation).toMatchObject({ status: "succeeded", attemptCount: 2 });
    expect(test.router.run).toHaveBeenCalledOnce();
  });

  it("fences stale failure, completion, and effect writes after another attempt takes over", async () => {
    const staleRequest = {
      id: requestId,
      kind: "readiness",
      state: "running",
      operationId,
      resultReference: null,
      documentId,
      currentDocumentVersionId: versionId,
      beforeVersionId: null,
      afterVersionId: null,
      expectedAggregateVersion: 1,
      promptArtifactId: crypto.randomUUID(),
      promptVersion: "document-readiness.v2",
      promptHash: "a".repeat(64),
      attemptCount: 1,
    } as const;

    const failure = processHarness({
      initialRequest: { state: "running" },
      initialOperation: { status: "running", attemptCount: 2, startedAt: now },
    });
    await recordAnalysisFailure(
      failure.database as never,
      staleRequest,
      new Error("stale worker"),
      now,
      { heartbeatMs: 10_000, leaseMs: 60_000, maxAttempts: 3 },
    );
    expect(failure.operation).toMatchObject({ status: "running", attemptCount: 2 });

    const completion = processHarness({
      initialRequest: { state: "running" },
      initialOperation: { status: "running", attemptCount: 2, startedAt: now },
    });
    await completeAnalysisOperation(
      completion.database as never,
      staleRequest,
      `document-readiness:${crypto.randomUUID()}`,
      now,
    );
    expect(completion.operation).toMatchObject({ status: "running", attemptCount: 2 });

    const effect = processHarness({
      initialRequest: { state: "running" },
      initialOperation: { status: "running", attemptCount: 2, startedAt: now },
    });
    await expect(
      recordAnalysisEffect(
        effect.transaction as never,
        staleRequest,
        `document-readiness:${crypto.randomUUID()}`,
      ),
    ).rejects.toMatchObject({ code: "ANALYSIS_LEASE_LOST" });
    expect(effect.transaction.operationEffectReceipt.create).not.toHaveBeenCalled();
  });

  it("rejects execution timing that could silently outlive its lease", async () => {
    const test = processHarness({
      execution: { heartbeatMs: 20, leaseMs: 40, maxAttempts: 3 },
      timeoutMs: 100,
    });
    test.releaseLoader();
    await expect(test.service.process(requestId, actorId, correlationId)).rejects.toThrow(/lease/u);
    expect(test.sourceLoader.load).not.toHaveBeenCalled();
  });

  it("retries transient failures with the stable operation and terminalizes after exhaustion", async () => {
    const test = processHarness({ loaderError: new Error("storage unavailable") });
    test.releaseLoader();
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await expect(test.service.process(requestId, actorId, correlationId)).rejects.toBeDefined();
      expect(test.operation).toMatchObject({
        id: operationId,
        status: "failed",
        attemptCount: attempt,
        errorCode: "ANALYSIS_RETRYABLE_FAILED",
      });
      expect(test.row.state).toBe(attempt === 3 ? "failed" : "running");
    }
    expect(test.row.errorCode).toBe("ANALYSIS_RETRIES_EXHAUSTED");
    expect(test.router.run).not.toHaveBeenCalled();
  });

  it("terminalizes invalid Router output without consuming retry attempts", async () => {
    const test = processHarness({
      routerError: new AppError("AI_OUTPUT_QUARANTINED", "errors.ai.outputQuarantined", 502),
    });
    const processing = test.service.process(requestId, actorId, correlationId);
    test.releaseLoader();
    await expect(processing).rejects.toMatchObject({ code: "AI_OUTPUT_QUARANTINED" });
    expect(test.operation).toMatchObject({
      status: "failed",
      attemptCount: 1,
      errorCode: "ANALYSIS_TERMINAL_FAILED",
    });
    expect(test.row).toMatchObject({
      state: "failed",
      errorCode: "ANALYSIS_TERMINAL_FAILED",
    });
  });

  it("recovers a crash after the validated effect without loading or calling the Router again", async () => {
    const resultReference = `document-readiness:${crypto.randomUUID()}`;
    const test = processHarness({
      initialRequest: { state: "succeeded", resultReference },
      initialOperation: { status: "running", attemptCount: 1, startedAt: now },
    });
    await expect(test.service.process(requestId, actorId, correlationId)).resolves.toBe(
      resultReference,
    );
    expect(test.operation).toMatchObject({ status: "succeeded", resultReference });
    expect(test.sourceLoader.load).not.toHaveBeenCalled();
    expect(test.router.run).not.toHaveBeenCalled();
  });

  it("uses pinned required/protected metadata for manager mapping without leaking detail", () => {
    const sections = [
      { key: "required_scope", required: true, protected: false },
      { key: "protected_context", required: false, protected: true },
      { key: "optional_notes", required: false, protected: false },
    ];
    expect(
      mapManagerReadiness("incomplete", [{ templateSectionKey: "optional_notes" }], sections, true),
    ).toEqual({ state: "needs_attention" });
    expect(
      mapManagerReadiness(
        "incomplete",
        [{ templateSectionKey: "optional_notes" }],
        sections,
        false,
      ),
    ).toEqual({ state: "missing_critical_information" });
    for (const key of ["required_scope", "protected_context"]) {
      expect(
        mapManagerReadiness("incomplete", [{ templateSectionKey: key }], sections, true),
      ).toEqual({ state: "missing_critical_information" });
    }
    expect(
      JSON.stringify(
        mapManagerReadiness(
          "incomplete",
          [{ templateSectionKey: "optional_notes" }],
          sections,
          true,
        ),
      ),
    ).not.toMatch(/percentage|rank|rating|missingItems/u);
  });

  it("selects only the safe manager state and denies the manager participant detail", async () => {
    const test = managerReadHarness();
    const actor = { userId: actorId, active: true };
    await expect(test.service.getOperationalSummary({ actor, documentId })).resolves.toEqual({
      state: "needs_attention",
    });
    expect(test.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ select: { managerState: true } }),
    );
    await expect(test.service.getParticipantDetail({ actor, documentId })).rejects.toMatchObject({
      code: "AUTHZ_ROLE_REQUIRED",
    });
    expect(test.findFirst).toHaveBeenCalledOnce();
  });

  it("returns the same request for the same idempotency payload and rejects key reuse", async () => {
    const test = requestHarness();
    const command = {
      actor: { userId: actorId, active: true },
      correlationId,
      documentId,
      idempotencyKey: "readiness-stable-key",
    };
    const first = await test.service.request(command);
    await expect(test.service.request(command)).resolves.toEqual(first);
    expect(test.operationCreate).toHaveBeenCalledOnce();
    expect(test.requestCreate).toHaveBeenCalledOnce();
    expect(test.audit.append).toHaveBeenCalledOnce();
    expect(test.enqueue).toHaveBeenCalledTimes(2);

    test.prompt.bodyHash = "c".repeat(64);
    await expect(test.service.request(command)).rejects.toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
    });
    expect(test.operationCreate).toHaveBeenCalledOnce();
    expect(test.requestCreate).toHaveBeenCalledOnce();
  });
});
