import { describe, expect, it, vi } from "vitest";

import { CriteriaAnalysisPhaseHandler } from "./criteria-analysis-phase-handler.js";

const ids = {
  request: "10000000-0000-4000-8000-000000000001",
  operation: "10000000-0000-4000-8000-000000000001",
  actor: "10000000-0000-4000-8000-000000000002",
  correlation: "10000000-0000-4000-8000-000000000003",
  document: "10000000-0000-4000-8000-000000000004",
  version: "10000000-0000-4000-8000-000000000005",
  readiness: "10000000-0000-4000-8000-000000000006",
  project: "10000000-0000-4000-8000-000000000007",
  organization: "10000000-0000-4000-8000-000000000008",
  department: "10000000-0000-4000-8000-000000000009",
  prompt: "10000000-0000-4000-8000-000000000010",
  schema: "10000000-0000-4000-8000-000000000011",
} as const;

function harness(
  options: {
    stale?: boolean;
    crashAfterEffect?: boolean;
    loseLeaseBeforePersist?: boolean;
    deferRouter?: boolean;
    execution?: { heartbeatMs: number; leaseMs: number; maxAttempts: number };
    timeoutMs?: number;
  } = {},
) {
  const request: Record<string, unknown> = {
    id: ids.request,
    kind: "criteria_project",
    state: "queued",
    operationId: ids.operation,
    resultReference: null,
  };
  const operation: Record<string, unknown> = {
    id: ids.operation,
    status: "pending",
    attemptCount: 0,
    startedAt: null,
    resultReference: null,
  };
  const effects = new Map<string, string>();
  let transactions = 0;
  let failCompletion = options.crashAfterEffect === true;
  let releaseRouter!: () => void;
  const routerGate = new Promise<void>((resolve) => {
    releaseRouter = resolve;
  });
  const transaction = {
    $queryRaw: vi.fn(async () => []),
    documentAnalysisRequest: {
      findUnique: vi.fn(async () => ({ ...request })),
      update: vi.fn(async ({ data }: any) => Object.assign(request, data)),
    },
    operation: {
      findUnique: vi.fn(async () => ({ ...operation })),
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (where.status !== undefined && operation.status !== where.status) return { count: 0 };
        if (
          typeof where.attemptCount === "number" &&
          operation.attemptCount !== where.attemptCount
        )
          return { count: 0 };
        if (
          where.attemptCount?.lt !== undefined &&
          Number(operation.attemptCount) >= where.attemptCount.lt
        )
          return { count: 0 };
        if (where.OR !== undefined && !where.OR.some((item: any) => item.status?.in?.includes(operation.status)))
          return { count: 0 };
        if (data.attemptCount?.increment !== undefined)
          operation.attemptCount = Number(operation.attemptCount) + data.attemptCount.increment;
        if (data.status === "succeeded" && failCompletion) {
          failCompletion = false;
          throw new Error("worker terminated after committed domain effect");
        }
        Object.assign(operation, { ...data, attemptCount: operation.attemptCount });
        return { count: 1 };
      }),
    },
    operationEffectReceipt: {
      findUnique: vi.fn(async ({ where }: any) => {
        const receiptReference = effects.get(where.idempotencyKey);
        return receiptReference === undefined ? null : { receiptReference };
      }),
      create: vi.fn(async ({ data }: any) => {
        effects.set(data.idempotencyKey, data.receiptReference);
        return data;
      }),
    },
  };
  const database = {
    documentAnalysisRequest: transaction.documentAnalysisRequest,
    operation: transaction.operation,
    operationEffectReceipt: transaction.operationEffectReceipt,
    $transaction: vi.fn(async (work: (value: typeof transaction) => Promise<unknown>) => {
      transactions += 1;
      try {
        return await work(transaction);
      } finally {
        transactions -= 1;
      }
    }),
  };
  const generationRequest = {
    id: ids.request,
    kind: "project" as const,
    routeKey: "criteria.generate.project" as const,
    state: "queued" as const,
    operationId: ids.operation,
    documentId: ids.document,
    documentVersionId: ids.version,
    readinessCheckId: ids.readiness,
    expectedDocumentVersion: 1,
    resourceId: ids.project,
    projectId: ids.project,
    organizationId: ids.organization,
    departmentId: ids.department,
    ownerId: ids.actor,
    contributorIds: [],
    promptArtifactId: ids.prompt,
    promptVersion: "criteria-generation.v2",
    promptHash: "a".repeat(64),
    outputSchemaArtifactId: ids.schema,
    outputSchemaVersion: "criteria-generation-output.v2",
    outputSchemaHash: "b".repeat(64),
    replacesProposalId: null,
    materialComparisonReviewId: null,
    ownerFeedbackSource: null,
    createdById: ids.actor,
  };
  const snapshotReader = {
    readIn: vi.fn(async () => ({
      request: generationRequest,
      readinessSourceReferences: [`document-readiness:${ids.readiness}`],
      job: {
        type: "criteria.generate.v1" as const,
        kind: "project" as const,
        requestId: ids.request,
        documentVersionId: ids.version,
        readinessCheckId: ids.readiness,
        ownerId: ids.actor,
        contributorIds: [],
        replacesProposalId: null,
        materialComparisonReviewId: null,
        ownerFeedbackSource: null,
        schemaArtifactId: ids.schema,
        schemaArtifactHash: "b".repeat(64),
        promptArtifactId: ids.prompt,
        promptArtifactHash: "a".repeat(64),
        expectedSnapshotVersion: 1,
      },
    })),
  };
  const proposal = {
    prepareGeneration: vi.fn(async () => ({
      routeKey: "criteria.generate.project",
      inputSchemaVersion: "criteria-generation-input.v2",
      outputSchemaVersion: "criteria-generation-output.v2",
      promptTemplateVersion: "criteria-generation.v2",
      input: {
        trustedInstruction: {
          routeKey: "criteria.generate.project",
          artifactId: ids.prompt,
          version: "criteria-generation.v2",
          sha256: "a".repeat(64),
        },
        untrustedContent: {},
      },
    })),
    persistValidatedGeneration: vi.fn(
      async (tx: typeof transaction, phaseRequest: typeof generationRequest) => {
        const outputReference = (
          phaseRequest as typeof generationRequest & { outputReference: string }
        ).outputReference;
        await tx.documentAnalysisRequest.update({
          where: { id: ids.request },
          data: {
            state: options.stale === true ? "superseded" : "succeeded",
            ...(options.stale === true ? {} : { resultReference: outputReference }),
          },
        });
        return {
          kind: "project",
          state: options.stale === true ? "superseded" : "owner_review",
          version: 1,
          items: options.stale === true ? [] : [{ title: "Evidence quality" }],
        };
      },
    ),
  };
  const router = {
    run: vi.fn(async (_input: unknown, persist: (tx: typeof transaction, value: unknown) => Promise<unknown>) => {
      expect(transactions).toBe(0);
      if (options.deferRouter === true) await routerGate;
      if (options.loseLeaseBeforePersist === true) operation.attemptCount = 2;
      const persisted = await database.$transaction((tx) =>
        persist(tx, {
          criteria: [
            {
              name: "Evidence quality",
              selectionReason: "Source-linked delivery evidence is material to this project.",
              successLink: "Improves the reliability of project delivery decisions.",
              expectedBehaviorOrResult: "Maintains current, source-linked project evidence.",
              evaluationMethod: "Human review of the cited approved project document.",
              suggestedEvidence: ["Approved project document"],
              sourceReferences: [`document-readiness:${ids.readiness}`],
            },
          ],
        }),
      );
      return { runId: crypto.randomUUID(), output: {}, outputReference: String(persisted) };
    }),
  };
  const handler = new CriteriaAnalysisPhaseHandler(
    database as never,
    proposal as never,
    router as never,
    snapshotReader as never,
    {
      systemId: ids.organization,
      timeoutMs: options.timeoutMs ?? 1_000,
      execution: options.execution ?? {
        heartbeatMs: 10_000,
        leaseMs: 60_000,
        maxAttempts: 3,
      },
      now: () => new Date("2026-07-17T12:00:00.000Z"),
    },
  );
  return { handler, operation, proposal, releaseRouter, request, router, snapshotReader, transaction };
}

describe("CriteriaAnalysisPhaseHandler", () => {
  it("claims briefly, calls the Router outside a transaction, and commits the stable result", async () => {
    const test = harness();
    const reference = await test.handler.process(ids.request, ids.actor, ids.correlation);
    expect(reference).toBe(`criteria-proposal-request:${ids.request}`);
    expect(test.request).toMatchObject({ state: "succeeded", resultReference: reference });
    expect(test.operation).toMatchObject({ status: "succeeded", resultReference: reference });
    expect(test.router.run).toHaveBeenCalledOnce();
  });

  it("recovers a crash after the domain effect without a duplicate Router call", async () => {
    const test = harness({ crashAfterEffect: true });
    await expect(test.handler.process(ids.request, ids.actor, ids.correlation)).rejects.toThrow(
      /terminated/u,
    );
    const reference = await test.handler.process(ids.request, ids.actor, ids.correlation);
    expect(reference).toBe(`criteria-proposal-request:${ids.request}`);
    expect(test.router.run).toHaveBeenCalledOnce();
    expect(test.operation).toMatchObject({ status: "succeeded", resultReference: reference });
  });

  it("suppresses stale output and never exposes it as an owner-review proposal", async () => {
    const test = harness({ stale: true });
    const reference = await test.handler.process(ids.request, ids.actor, ids.correlation);
    expect(reference).toBe(`criteria-superseded-request:${ids.request}`);
    expect(test.request).toMatchObject({ state: "superseded", resultReference: null });
    expect(test.request.state).not.toBe("owner_review");
  });

  it("fences a stale attempt before proposal or effect persistence", async () => {
    const test = harness({ loseLeaseBeforePersist: true });
    await expect(
      test.handler.process(ids.request, ids.actor, ids.correlation),
    ).rejects.toMatchObject({ code: "ANALYSIS_LEASE_LOST" });
    expect(test.proposal.persistValidatedGeneration).not.toHaveBeenCalled();
    expect(test.transaction.operationEffectReceipt.create).not.toHaveBeenCalled();
  });

  it("heartbeats while Router work is outside the transaction", async () => {
    const test = harness({
      deferRouter: true,
      timeoutMs: 5,
      execution: { heartbeatMs: 10, leaseMs: 100, maxAttempts: 3 },
    });
    const processing = test.handler.process(ids.request, ids.actor, ids.correlation);
    await vi.waitFor(() => expect(test.router.run).toHaveBeenCalledOnce());
    test.transaction.operation.updateMany.mockClear();
    await vi.waitFor(() =>
      expect(test.transaction.operation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "running", attemptCount: 1 }),
          data: expect.objectContaining({ startedAt: expect.any(Date) }),
        }),
      ),
    );
    test.releaseRouter();
    await expect(processing).resolves.toBe(`criteria-proposal-request:${ids.request}`);
  });
});
