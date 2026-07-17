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
    contributorIds: [],
    promptArtifactId: crypto.randomUUID(),
    promptVersion: "criteria-generation.v1",
    promptHash: "a".repeat(64),
    outputSchemaArtifactId: crypto.randomUUID(),
    outputSchemaVersion: "criteria-generation-output.v1",
    outputSchemaHash: "b".repeat(64),
    replacesProposalId: null,
    materialComparisonReviewId: null,
    ownerFeedback: null,
    createdById: ownerId,
  } satisfies import("./proposal-service.js").CriteriaGenerationRequestSnapshot;
  const current = {
    $queryRaw: vi.fn(async () => []),
    documentAnalysisRequest: {
      findUnique: vi.fn(async () => ({
        kind: kind === "project" ? "criteria_project" : "criteria_workstream",
        routeKey: `criteria.generate.${kind}`,
        state: "running",
        currentDocumentVersionId: documentVersionId,
        pinnedReadinessCheckId: readinessCheckId,
        pinnedProposalId: null,
        expectedAggregateVersion: 2,
        promptArtifactId: request.promptArtifactId,
        promptVersion: request.promptVersion,
        promptHash: request.promptHash,
        outputSchemaArtifactId: request.outputSchemaArtifactId,
        outputSchemaVersion: request.outputSchemaVersion,
        outputSchemaHash: request.outputSchemaHash,
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
    snapshotIn: vi.fn(async () => ({
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
    { publish: vi.fn(async () => undefined) } as never,
    { systemId: crypto.randomUUID(), timeoutMs: 1_000, now: () => now },
  );
  return {
    count,
    createdItems,
    createdTransitions,
    current,
    output: { criteria: Array.from({ length: count }, (_, index) => criterion(index + 1)) },
    request,
    reviewReader,
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
    expect(harness.createdTransitions).toHaveLength(0);
    expect(harness.current.documentAnalysisRequest.update).toHaveBeenCalledWith({
      where: { id: harness.request.id },
      data: expect.objectContaining({
        state: "succeeded",
        resultReference: expect.stringMatching(/^criteria-proposal:/u),
      }),
    });
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

  it("suppresses proposal persistence when the frozen contributor IDs changed", async () => {
    const harness = persistenceHarness("workstream", 2);
    const pinnedContributorId = crypto.randomUUID();
    harness.reviewReader.snapshotIn.mockResolvedValueOnce({
      kind: "workstream",
      resourceId: harness.request.resourceId,
      projectId: harness.request.projectId,
      organizationId: harness.request.organizationId,
      departmentId: harness.request.departmentId,
      primaryOwnerId: harness.request.ownerId,
      contributorIds: [],
    });
    await expect(
      harness.service.persistValidatedGeneration(
        harness.current as never,
        { ...harness.request, contributorIds: [pinnedContributorId] },
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
    const documentReader = {
      getPrerequisites: vi.fn(async () => prerequisites),
      getPrerequisitesIn: vi.fn(async () => prerequisites),
    };
    const identity = {
      kind: "workstream",
      resourceId,
      projectId,
      organizationId: crypto.randomUUID(),
      departmentId: crypto.randomUUID(),
      primaryOwnerId: ownerId,
      contributorIds: [crypto.randomUUID(), crypto.randomUUID()].sort(),
    } as const;
    const reviewReader = {
      snapshot: vi.fn(async () => identity),
      snapshotIn: vi.fn(async () => identity),
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
      { publish: vi.fn(async () => undefined) } as never,
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
          ownerId,
          contributorIds: identity.contributorIds,
        }),
      }),
    );
    expect(documentReader.getPrerequisitesIn).toHaveBeenCalledWith(transaction, {
      documentVersionId,
    });
    expect(reviewReader.snapshotIn).toHaveBeenCalledWith(transaction, {
      kind: "workstream",
      resourceId,
      at: now,
    });
    expect(auditAppend).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({ eventType: "dynamic_criteria.generation_requested" }),
    );
    expect(sourceLoader.load).not.toHaveBeenCalled();
    expect(aiRouter.run).not.toHaveBeenCalled();

    const replacesProposalId = crypto.randomUUID();
    Object.assign(transaction, {
      dynamicCriteriaProposal: {
        findUnique: vi.fn(async () => ({
          id: replacesProposalId,
          kind: "project",
          projectId,
          workstreamId: null,
          sourceDocumentVersionId: documentVersionId,
          state: "superseded",
          transitions: [
            {
              fromState: "owner_review",
              toState: "superseded",
            },
          ],
        })),
      },
    });
    await expect(
      service.requestGeneration({
        actor: { userId: ownerId, active: true },
        correlationId: crypto.randomUUID(),
        kind: "workstream",
        resourceId,
        documentVersionId,
        replacesProposalId,
        ownerFeedback: "Generate a corrected alternative.",
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "CRITERIA_REPLACEMENT_INVALID" });
  });

  it("keeps stored items immutable while appending owner review history", async () => {
    const ownerId = crypto.randomUUID();
    const proposalId = crypto.randomUUID();
    const itemsUpdateMany = vi.fn();
    const callOrder: string[] = [];
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
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          callOrder.push("update");
          return { ...proposal, ...data };
        }),
      },
      dynamicCriteriaProposalItem: { updateMany: itemsUpdateMany },
      dynamicCriteriaProposalTransition: {
        create: vi.fn(async () => {
          callOrder.push("transition");
          return {};
        }),
      },
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
      snapshotIn: vi.fn(
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
      { publish: vi.fn(async () => undefined) } as never,
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
    expect(callOrder).toEqual(["transition", "update"]);
    expect(auditAppend).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({ eventType: "dynamic_criteria.owner_reviewed" }),
    );
  });

  it("rejects inactive and non-owner reviewers", async () => {
    const service = new ProposalService(
      {} as never,
      {} as never,
      { snapshot: vi.fn(async () => null), snapshotIn: vi.fn(async () => null) },
      {} as never,
      {} as never,
      { append: vi.fn(async () => ({ id: crypto.randomUUID(), createdAt: now.toISOString() })) },
      { append: vi.fn(async () => undefined) },
      { publish: vi.fn(async () => undefined) } as never,
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

  it("hands workstream approval to the frozen-snapshot workflow without updating directly", async () => {
    const ownerId = crypto.randomUUID();
    const proposalId = crypto.randomUUID();
    const workstreamId = crypto.randomUUID();
    const proposal = {
      id: proposalId,
      kind: "workstream",
      projectId: null,
      workstreamId,
      state: "owner_review",
      version: 1,
      items: [criterion(1), criterion(2)],
      transitions: [],
    } as const;
    const transaction = {
      $queryRaw: vi.fn(async () => []),
      dynamicCriteriaProposal: {
        findUnique: vi.fn(async () => proposal),
        update: vi.fn(),
      },
    };
    const database = {
      $transaction: vi.fn(async (callback: (value: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const identity = {
      kind: "workstream",
      resourceId: workstreamId,
      projectId: crypto.randomUUID(),
      organizationId: crypto.randomUUID(),
      departmentId: crypto.randomUUID(),
      primaryOwnerId: ownerId,
      contributorIds: [crypto.randomUUID()],
    } as const;
    const publisher = {
      publish: vi.fn(async () => ({
        ...proposal,
        state: "contributor_review" as const,
        version: 2,
      })),
    };
    const service = new ProposalService(
      database as never,
      {} as never,
      {
        snapshot: vi.fn(async () => identity),
        snapshotIn: vi.fn(async () => identity),
      },
      {} as never,
      {} as never,
      { append: vi.fn() } as never,
      { append: vi.fn() },
      publisher,
      { systemId: crypto.randomUUID(), timeoutMs: 1_000, now: () => now },
    );

    await expect(
      service.reviewByOwner({
        actor: { userId: ownerId, active: true },
        correlationId: crypto.randomUUID(),
        proposalId,
        review: { action: "approve", reason: "Publish the reviewed criteria." },
      }),
    ).resolves.toMatchObject({ state: "contributor_review" });
    expect(publisher.publish).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({ proposal, identity, actorId: ownerId }),
    );
    expect(transaction.dynamicCriteriaProposal.update).not.toHaveBeenCalled();
  });
});
