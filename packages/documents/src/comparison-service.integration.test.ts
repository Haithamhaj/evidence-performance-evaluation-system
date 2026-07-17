import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import { ComparisonService } from "./comparison-service.js";

const comparisonId = "00000000-0000-4000-8000-000000000011";
const documentId = "00000000-0000-4000-8000-000000000012";
const actorId = "00000000-0000-4000-8000-000000000013";
const operationId = "00000000-0000-4000-8000-000000000014";
const now = new Date("2026-07-17T12:00:00.000Z");

function processHarness(loaderError?: Error) {
  const row: Record<string, any> = {
    id: crypto.randomUUID(),
    kind: "comparison",
    state: "queued",
    operationId,
    resultReference: null,
    documentId,
    beforeVersionId: crypto.randomUUID(),
    afterVersionId: crypto.randomUUID(),
    expectedAggregateVersion: 2,
    promptArtifactId: crypto.randomUUID(),
    promptVersion: "document-comparison.v2",
    promptHash: "a".repeat(64),
  };
  const operation: Record<string, any> = {
    id: operationId,
    status: "pending",
    attemptCount: 0,
    startedAt: null,
    completedAt: null,
    errorCode: null,
    resultReference: null,
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
        if (where.attemptCount?.lt !== undefined && operation.attemptCount >= where.attemptCount.lt)
          return { count: 0 };
        if (where.OR !== undefined) {
          const claimable = where.OR.some((candidate: any) =>
            candidate.status?.in?.includes(operation.status),
          );
          if (!claimable) return { count: 0 };
        }
        if (data.attemptCount?.increment !== undefined)
          operation.attemptCount += data.attemptCount.increment;
        Object.assign(operation, { ...data, attemptCount: operation.attemptCount });
        return { count: 1 };
      }),
    },
    operationEffectReceipt: { create: vi.fn() },
    documentComparison: { findUnique: vi.fn(async () => null) },
  };
  const database = {
    ...transaction,
    $transaction: vi.fn(async (callback: (tx: any) => Promise<any>) => callback(transaction)),
  };
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const loader = {
    load: vi.fn(async ({ documentVersionId }: any) => {
      await gate;
      if (loaderError !== undefined) throw loaderError;
      const reference = `document-source:${crypto.randomUUID()}`;
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
        documentVersionId,
        documentVersion: 1,
        currentVersion: 2,
        templateVersionId: crypto.randomUUID(),
        templateSections: [],
        sources: [
          {
            reference,
            sourceType: "upload",
            mediaType: "text/plain",
            openStream: async () => Readable.from(["content"]),
          },
        ],
        sourceReferences: [reference],
      };
    }),
  };
  const router = {
    run: vi.fn(async () => ({
      runId: crypto.randomUUID(),
      output: {},
      outputReference: `document-comparison:${crypto.randomUUID()}`,
      requiresHumanApproval: true,
    })),
  };
  const service = new ComparisonService(
    database as never,
    {} as never,
    loader as never,
    router as never,
    {} as never,
    vi.fn(),
    {
      systemId: crypto.randomUUID(),
      timeoutMs: 1_000,
      extractionPolicy: {
        maxSourceBytes: 1_000,
        maxArchiveEntries: 10,
        maxArchiveUncompressedBytes: 5_000,
        maxArchiveCompressionRatio: 20,
      },
      execution: { heartbeatMs: 10_000, leaseMs: 60_000, maxAttempts: 3 },
      now: () => now,
    },
  );
  return { loader, operation, release, router, row, service };
}

function reviewHarness(currentVersion: number, afterVersion: number) {
  const events: string[] = [];
  const projectId = crypto.randomUUID();
  const comparison = {
    id: comparisonId,
    documentId,
    document: { projectId, workstreamId: null, currentVersion },
    afterVersionId: crypto.randomUUID(),
    aiClassification: "editorial" as const,
    stale: false,
  };
  const createdAt = new Date("2026-07-17T12:00:00.000Z");
  const reviewCreate = vi.fn(async ({ data }: any) => {
    events.push("review-insert");
    return { id: crypto.randomUUID(), createdAt, ...data };
  });
  const transaction = {
    $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
      events.push(
        strings.join("").includes("DocumentRecord") ? "document-lock" : "comparison-lock",
      );
      return [];
    }),
    documentComparison: { findUnique: vi.fn(async () => comparison) },
    documentVersion: { findUnique: vi.fn(async () => ({ version: afterVersion })) },
    documentComparisonReview: { create: reviewCreate },
    user: { findUnique: vi.fn(async () => ({ active: true })) },
    roleAssignment: {
      findMany: vi.fn(async () => [
        { role: "project_owner", scopeType: "project", scopeId: projectId },
      ]),
    },
    authorizationScope: { findFirst: vi.fn(async () => ({ id: projectId })) },
    responsibilityWindow: {
      findMany: vi.fn(async () => [
        {
          projectId,
          workstreamId: null,
          responsibilityType: "original",
          startsAt: new Date("2026-01-01T00:00:00Z"),
          endsAt: null,
        },
      ]),
    },
  };
  const database = {
    documentComparison: { findUnique: vi.fn(async () => ({ documentId })) },
    $transaction: vi.fn(async (callback: (tx: any) => Promise<any>) => callback(transaction)),
  };
  const audit = { append: vi.fn() };
  const service = new ComparisonService(
    database as never,
    {
      read: vi.fn(async () => ({
        kind: "project" as const,
        resourceId: projectId,
        projectId,
        organizationId: crypto.randomUUID(),
        departmentId: crypto.randomUUID(),
        status: "active" as const,
      })),
    },
    {} as never,
    {} as never,
    audit as never,
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
      now: () => now,
    },
  );
  return { audit, events, reviewCreate, service };
}

describe("ComparisonService", () => {
  it("claims once and records a retryable loader failure without a second Router call", async () => {
    const test = processHarness(new Error("storage unavailable"));
    const first = test.service.process(test.row.id, actorId, crypto.randomUUID());
    await vi.waitFor(() => expect(test.row.state).toBe("running"));
    await expect(
      test.service.process(test.row.id, actorId, crypto.randomUUID()),
    ).rejects.toMatchObject({ code: "ANALYSIS_REQUEST_RUNNING" });
    test.release();
    await expect(first).rejects.toBeDefined();
    expect(test.row).toMatchObject({ state: "running" });
    expect(test.operation).toMatchObject({
      status: "failed",
      attemptCount: 1,
      errorCode: "ANALYSIS_RETRYABLE_FAILED",
    });
    expect(test.router.run).not.toHaveBeenCalled();
  });

  it("locks the stable document before comparison review and denies stale review", async () => {
    const test = reviewHarness(3, 2);
    await expect(
      test.service.review({
        actor: { userId: actorId, active: true },
        correlationId: crypto.randomUUID(),
        comparisonId,
        review: { action: "confirm", reason: "Reviewed" },
      }),
    ).rejects.toMatchObject({ code: "DOCUMENT_COMPARISON_STALE" });
    expect(test.events.slice(0, 2)).toEqual(["document-lock", "comparison-lock"]);
    expect(test.events).not.toContain("review-insert");
  });

  it("appends a human review without updating the immutable AI comparison", async () => {
    const test = reviewHarness(2, 2);
    await expect(
      test.service.review({
        actor: { userId: actorId, active: true },
        correlationId: crypto.randomUUID(),
        comparisonId,
        review: {
          action: "correct",
          classification: "routine_execution_update",
          reason: "Human correction",
        },
      }),
    ).resolves.toMatchObject({
      comparisonId,
      effectiveClassification: "routine_execution_update",
      reviewerId: actorId,
      reason: "Human correction",
    });
    expect(test.events.slice(0, 3)).toEqual(["document-lock", "comparison-lock", "review-insert"]);
    expect(test.reviewCreate).toHaveBeenCalledOnce();
    expect(test.audit.append).toHaveBeenCalledOnce();
  });
});
