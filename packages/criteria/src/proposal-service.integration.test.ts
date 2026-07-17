import { AppError, CriteriaGenerationOutputSchema } from "@evaluation/contracts";
import { describe, expect, it, vi } from "vitest";

import { ProposalService } from "./proposal-service.js";

const now = new Date("2026-07-17T12:00:00.000Z");

function criterion(position: number) {
  return {
    name: `Criterion ${position}`,
    selectionReason: `Reason ${position}`,
    successLink: `Success ${position}`,
    expectedBehaviorOrResult: `Expected ${position}`,
    evaluationMethod: `Method ${position}`,
    suggestedEvidence: [`Evidence ${position}`],
    sourceReferences: [`document-source:${crypto.randomUUID()}`],
  };
}

function persistenceHarness(kind: "project" | "workstream", count: number) {
  const requestId = crypto.randomUUID();
  const resourceId = crypto.randomUUID();
  const projectId = kind === "project" ? resourceId : crypto.randomUUID();
  const ownerId = crypto.randomUUID();
  const documentVersionId = crypto.randomUUID();
  const readinessCheckId = crypto.randomUUID();
  const createdItems: unknown[] = [];
  const createdTransitions: unknown[] = [];
  let proposal: Record<string, unknown> | null = null;
  const request = {
    id: requestId,
    kind,
    routeKey: `criteria.generate.${kind}`,
    state: "running",
    operationId: crypto.randomUUID(),
    documentId: crypto.randomUUID(),
    documentVersionId,
    readinessCheckId,
    expectedDocumentVersion: 2,
    resourceId,
    projectId,
    organizationId: crypto.randomUUID(),
    departmentId: crypto.randomUUID(),
    ownerId,
    promptArtifactId: crypto.randomUUID(),
    promptVersion: "criteria-generation.v1",
    promptHash: "a".repeat(64),
    outputSchemaVersion: "criteria-generation-output.v1",
    replacesProposalId: null,
    materialComparisonReviewId: null,
    ownerFeedback: null,
    createdById: ownerId,
  } satisfies import("./proposal-service.js").CriteriaGenerationRequestSnapshot;
  const current = {
    documentAnalysisRequest: {
      findUnique: vi.fn(async () => ({
        state: "running",
        currentDocumentVersionId: documentVersionId,
        pinnedReadinessCheckId: readinessCheckId,
        expectedAggregateVersion: 2,
      })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data),
    },
    documentRecord: {
      findUnique: vi.fn(async () => ({ currentVersion: 2 })),
    },
    documentReadinessCheck: {
      findUnique: vi.fn(async () => ({
        id: readinessCheckId,
        documentVersionId,
        analyzedState: "ready_for_criteria_generation",
        stale: false,
        lifecycleTransitions: [{ toState: "ready_for_criteria_generation" }],
      })),
    },
    dynamicCriteriaProposal: {
      count: vi.fn(async () => 0),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        proposal = { id: crypto.randomUUID(), createdAt: now, updatedAt: now, ...data };
        return proposal;
      }),
      findUnique: vi.fn(async () =>
        proposal === null
          ? null
          : { ...proposal, items: createdItems, transitions: createdTransitions },
      ),
    },
    dynamicCriteriaProposalItem: {
      createMany: vi.fn(async ({ data }: { data: unknown[] }) => {
        createdItems.push(...data);
        return { count: data.length };
      }),
    },
    dynamicCriteriaProposalTransition: {
      create: vi.fn(async ({ data }: { data: unknown }) => {
        createdTransitions.push(data);
        return data;
      }),
    },
  };
  const reviewReader = {
    snapshot: vi.fn(async () => ({
      kind,
      resourceId,
      projectId,
      organizationId: request.organizationId,
      departmentId: request.departmentId,
      primaryOwnerId: ownerId,
      contributorIds: [],
    })),
  };
  const service = new ProposalService(
    {} as never,
    {} as never,
    reviewReader,
    {} as never,
    {} as never,
    { append: vi.fn(async () => ({ id: crypto.randomUUID(), createdAt: now.toISOString() })) },
    { append: vi.fn(async () => undefined) },
    { systemId: crypto.randomUUID(), timeoutMs: 1_000, now: () => now },
  );
  return {
    count,
    createdItems,
    createdTransitions,
    current,
    output: { criteria: Array.from({ length: count }, (_, index) => criterion(index + 1)) },
    request,
    service,
  };
}

describe("ProposalService persisted generation", () => {
  it.each([
    ["project", 1],
    ["project", 3],
    ["workstream", 2],
    ["workstream", 3],
  ] as const)("accepts the bounded %s count %i and preserves every field", async (kind, count) => {
    const harness = persistenceHarness(kind, count);
    const detail = await harness.service.persistValidatedGeneration(
      harness.current as never,
      harness.request,
      harness.output,
    );
    expect(detail.state).toBe("owner_review");
    expect(detail.items).toHaveLength(count);
    expect(detail.items[0]).toMatchObject(harness.output.criteria[0]!);
    expect(harness.createdTransitions).toHaveLength(1);
  });

  it.each([
    ["project", 0],
    ["project", 4],
    ["workstream", 1],
  ] as const)("rejects invalid %s count %i", async (kind, count) => {
    const harness = persistenceHarness(kind, count);
    await expect(
      harness.service.persistValidatedGeneration(
        harness.current as never,
        harness.request,
        harness.output as never,
      ),
    ).rejects.toMatchObject({ code: "CRITERIA_COUNT_INVALID" });
  });

  it("strictly rejects rating, rank, productivity, and average fields", () => {
    const forbidden = ["rating", "rank", "productivityScore", "automaticAverage"] as const;
    for (const field of forbidden) {
      expect(() =>
        CriteriaGenerationOutputSchema.parse({
          criteria: [{ ...criterion(1), [field]: 5 }],
        }),
      ).toThrow();
    }
  });

  it("suppresses proposal persistence when the document, readiness, or owner pin is stale", async () => {
    const harness = persistenceHarness("project", 1);
    harness.current.documentRecord.findUnique.mockResolvedValueOnce({ currentVersion: 3 });
    await expect(
      harness.service.persistValidatedGeneration(
        harness.current as never,
        harness.request,
        harness.output,
      ),
    ).resolves.toMatchObject({ state: "superseded", items: [] });
    expect(harness.current.dynamicCriteriaProposal.create).not.toHaveBeenCalled();
  });
});

describe("ProposalService request and owner review", () => {
  it("records the pinned request and outbox atomically without calling the Router inline", async () => {
    let inTransaction = false;
    const ownerId = crypto.randomUUID();
    const resourceId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const documentId = crypto.randomUUID();
    const documentVersionId = crypto.randomUUID();
    const readinessCheckId = crypto.randomUUID();
    const requestId = crypto.randomUUID();
    const operationId = requestId;
    const requestRow = {
      id: requestId,
      kind: "criteria_workstream",
      routeKey: "criteria.generate.workstream",
      state: "queued",
      operationId,
      documentId,
      currentDocumentVersionId: documentVersionId,
      pinnedReadinessCheckId: readinessCheckId,
      expectedAggregateVersion: 1,
      promptArtifactId: crypto.randomUUID(),
      promptVersion: "criteria-generation.v1",
      promptHash: "a".repeat(64),
      outputSchemaVersion: "criteria-generation-output.v1",
      pinnedProposalId: null,
    };
    const transaction = {
      $queryRaw: vi.fn(async () => []),
      documentRecord: {
        findUnique: vi.fn(async () => ({ id: documentId, currentVersion: 1 })),
      },
      documentVersion: { findUnique: vi.fn(async () => ({ id: documentVersionId })) },
      analysisPromptArtifact: {
        findUnique: vi.fn(async () => ({
          id: requestRow.promptArtifactId,
          bodyHash: requestRow.promptHash,
        })),
      },
      aiOutputSchemaArtifact: {
        findUnique: vi.fn(async () => ({ id: crypto.randomUUID(), schemaHash: "b".repeat(64) })),
      },
      documentAnalysisRequest: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async () => requestRow),
      },
      operation: { create: vi.fn(async () => ({})) },
      outboxMessage: { create: vi.fn(async () => ({})) },
    };
    const database = {
      ...transaction,
      $transaction: vi.fn(async (callback: (value: typeof transaction) => Promise<unknown>) => {
        inTransaction = true;
        try {
          return await callback(transaction);
        } finally {
          inTransaction = false;
        }
      }),
    };
    const prerequisites = {
      documentId,
      documentVersionId,
      documentVersion: 1,
      readinessCheckId,
      lifecycleState: "ready_for_criteria_generation",
      projectId,
      workstreamId: resourceId,
      sourceReferences: [`document-source:${crypto.randomUUID()}`],
    } as const;
    const documentReader = { getPrerequisites: vi.fn(async () => prerequisites) };
    const reviewReader = {
      snapshot: vi.fn(
        async () =>
          ({
            kind: "workstream",
            resourceId,
            projectId,
            organizationId: crypto.randomUUID(),
            departmentId: crypto.randomUUID(),
            primaryOwnerId: ownerId,
            contributorIds: [],
          }) as const,
      ),
    };
    const sourceLoader = {
      load: vi.fn(),
    };
    const aiRouter = {
      run: vi.fn(),
    };
    const auditAppend = vi.fn(async () => {
      expect(inTransaction).toBe(true);
      return { id: crypto.randomUUID(), createdAt: now.toISOString() };
    });
    const outboxAppend = vi.fn(async () => {
      expect(inTransaction).toBe(true);
    });
    const service = new ProposalService(
      database as never,
      documentReader,
      reviewReader,
      sourceLoader,
      aiRouter as never,
      { append: auditAppend } as never,
      { append: outboxAppend },
      { systemId: crypto.randomUUID(), timeoutMs: 1_000, now: () => now },
    );

    await expect(
      service.requestGeneration({
        actor: { userId: ownerId, active: true },
        correlationId: crypto.randomUUID(),
        kind: "workstream",
        resourceId,
        documentVersionId,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).resolves.toMatchObject({ requestId, operationId });
    expect(outboxAppend).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        jobType: "analysis-criteria.process",
        operationId,
        payload: expect.objectContaining({
          type: "criteria.generate.v1",
          requestId,
          documentVersionId,
          readinessCheckId,
        }),
      }),
    );
    expect(auditAppend).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({ eventType: "dynamic_criteria_generation_requested" }),
    );
    expect(sourceLoader.load).not.toHaveBeenCalled();
    expect(aiRouter.run).not.toHaveBeenCalled();
  });

  it("keeps stored items immutable while appending owner review history", async () => {
    const ownerId = crypto.randomUUID();
    const proposalId = crypto.randomUUID();
    const itemsUpdateMany = vi.fn();
    const proposal = {
      id: proposalId,
      kind: "project",
      projectId: crypto.randomUUID(),
      workstreamId: null,
      state: "owner_review",
      version: 1,
      items: [criterion(1)],
      transitions: [],
    } as const;
    const transaction = {
      $queryRaw: vi.fn(async () => []),
      dynamicCriteriaProposal: {
        findUnique: vi.fn(async () => proposal),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          ...proposal,
          ...data,
        })),
      },
      dynamicCriteriaProposalItem: { updateMany: itemsUpdateMany },
      dynamicCriteriaProposalTransition: { create: vi.fn(async () => ({})) },
    };
    const database = {
      $transaction: vi.fn(async (callback: (value: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const reviewReader = {
      snapshot: vi.fn(
        async () =>
          ({
            kind: "project",
            resourceId: proposal.projectId,
            projectId: proposal.projectId,
            organizationId: crypto.randomUUID(),
            departmentId: crypto.randomUUID(),
            primaryOwnerId: ownerId,
            contributorIds: [],
          }) as const,
      ),
    };
    const auditAppend = vi.fn(async () => ({
      id: crypto.randomUUID(),
      createdAt: now.toISOString(),
    }));
    const service = new ProposalService(
      database as never,
      {} as never,
      reviewReader,
      {} as never,
      {} as never,
      { append: auditAppend } as never,
      { append: vi.fn(async () => undefined) },
      { systemId: crypto.randomUUID(), timeoutMs: 1_000, now: () => now },
    );
    await expect(
      service.reviewByOwner({
        actor: { userId: ownerId, active: true },
        correlationId: crypto.randomUUID(),
        proposalId,
        review: { action: "approve", reason: "The proposal reflects the project." },
      }),
    ).resolves.toMatchObject({ state: "approved" });
    expect(itemsUpdateMany).not.toHaveBeenCalled();
    expect(transaction.dynamicCriteriaProposalTransition.create).toHaveBeenCalledOnce();
    expect(auditAppend).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({ eventType: "dynamic_criteria_owner_reviewed" }),
    );
  });

  it("rejects inactive and non-owner reviewers", async () => {
    const service = new ProposalService(
      {} as never,
      {} as never,
      { snapshot: vi.fn(async () => null) },
      {} as never,
      {} as never,
      { append: vi.fn(async () => ({ id: crypto.randomUUID(), createdAt: now.toISOString() })) },
      { append: vi.fn(async () => undefined) },
      { systemId: crypto.randomUUID(), timeoutMs: 1_000, now: () => now },
    );
    await expect(
      service.reviewByOwner({
        actor: { userId: crypto.randomUUID(), active: false },
        correlationId: crypto.randomUUID(),
        proposalId: crypto.randomUUID(),
        review: { action: "reject", reason: "Not acceptable." },
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
