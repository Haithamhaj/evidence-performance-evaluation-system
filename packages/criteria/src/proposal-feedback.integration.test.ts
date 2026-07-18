import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { ProposalService } from "./proposal-service.js";

const now = new Date("2026-07-17T12:00:00.000Z");

function feedbackHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function requestHarness(
  input: Readonly<{
    material: boolean;
    kind?: "project" | "workstream";
    replacementTransition?: "owner_review" | "manager_resolution";
  }>,
) {
  const kind = input.kind ?? "project";
  const ownerId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const workstreamId = crypto.randomUUID();
  const resourceId = kind === "project" ? projectId : workstreamId;
  const documentId = crypto.randomUUID();
  const currentDocumentVersionId = crypto.randomUUID();
  const priorDocumentVersionId = input.material ? crypto.randomUUID() : currentDocumentVersionId;
  const readinessCheckId = crypto.randomUUID();
  const priorProposalId = crypto.randomUUID();
  const transitionId = crypto.randomUUID();
  const comparisonReviewId = crypto.randomUUID();
  const replacementTransition = input.replacementTransition ?? "owner_review";
  const transitionReason =
    replacementTransition === "manager_resolution"
      ? "Revise through a new owner-reviewed proposal."
      : "Generate a corrected alternative from the owner review.";
  const comparisonReason = "The reviewed document comparison requires revised criteria.";
  const ownerFeedback = input.material ? comparisonReason : transitionReason;
  let capturedPayload: Record<string, unknown> | undefined;
  const prerequisites = {
    documentId,
    documentVersionId: currentDocumentVersionId,
    documentVersion: 2,
    readinessCheckId,
    lifecycleState: input.material ? "revision_required" : "ready_for_criteria_generation",
    projectId: kind === "project" ? projectId : null,
    workstreamId: kind === "workstream" ? workstreamId : null,
    sourceReferences: [`readiness:${readinessCheckId}`],
  } as const;
  const identity = {
    kind,
    resourceId,
    projectId,
    organizationId: crypto.randomUUID(),
    departmentId: crypto.randomUUID(),
    primaryOwnerId: ownerId,
    contributorIds: [],
  } as const;
  const requestRow = {
    id: crypto.randomUUID(),
    operationId: crypto.randomUUID(),
    state: "queued",
    documentId,
    currentDocumentVersionId,
  };
  const transaction = {
    $queryRaw: vi.fn(async () => []),
    dynamicCriteriaProposal: {
      findUnique: vi.fn(async () => ({
        id: priorProposalId,
        kind,
        projectId: kind === "project" ? projectId : null,
        workstreamId: kind === "workstream" ? workstreamId : null,
        sourceDocumentVersionId: priorDocumentVersionId,
        state: "superseded",
        transitions: [
          {
            id: transitionId,
            fromState: replacementTransition,
            toState: "superseded",
            reason: transitionReason,
          },
        ],
      })),
    },
    documentComparisonReview: {
      findUnique: vi.fn(async () =>
        input.material
          ? {
              id: comparisonReviewId,
              effectiveClassification: "material_scope_or_goal_change",
              reason: comparisonReason,
              comparison: {
                beforeVersionId: priorDocumentVersionId,
                afterVersionId: currentDocumentVersionId,
              },
            }
          : null,
      ),
    },
    documentRecord: {
      findUnique: vi.fn(async () => ({ id: documentId, currentVersion: 2 })),
    },
    documentVersion: {
      findUnique: vi.fn(async () => ({ id: currentDocumentVersionId })),
    },
    analysisPromptArtifact: {
      findUnique: vi.fn(async () => ({
        id: crypto.randomUUID(),
        bodyHash: "a".repeat(64),
      })),
    },
    aiOutputSchemaArtifact: {
      findUnique: vi.fn(async () => ({
        id: crypto.randomUUID(),
        schemaHash: "b".repeat(64),
      })),
    },
    documentAnalysisRequest: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async () => requestRow),
    },
    operation: { create: vi.fn(async () => ({})) },
  };
  const database = {
    $transaction: vi.fn(async (callback: (value: typeof transaction) => Promise<unknown>) =>
      callback(transaction),
    ),
  };
  const sourceLoader = {
    load: vi.fn(async () => ({
      sources: [
        {
          reference: `document-version:${currentDocumentVersionId}`,
          mediaType: "text/plain",
          contentBase64: Buffer.from("immutable document").toString("base64"),
        },
      ],
    })),
  };
  const service = new ProposalService(
    database as never,
    {
      getPrerequisites: vi.fn(async () => prerequisites),
      getPrerequisitesIn: vi.fn(async () => prerequisites),
    },
    {
      snapshot: vi.fn(async () => identity),
      snapshotIn: vi.fn(async () => identity),
    },
    sourceLoader,
    { run: vi.fn() },
    {
      append: vi.fn(async () => ({
        id: crypto.randomUUID(),
        createdAt: now.toISOString(),
      })),
    },
    {
      append: vi.fn(async (_transaction, message) => {
        capturedPayload = message.payload as Record<string, unknown>;
      }),
    },
    { publish: vi.fn() } as never,
    { systemId: crypto.randomUUID(), timeoutMs: 1_000, now: () => now },
  );

  return {
    material: input.material,
    comparisonReviewId,
    currentDocumentVersionId,
    database,
    documentId,
    identity,
    kind,
    ownerFeedback,
    priorDocumentVersionId,
    priorProposalId,
    prerequisites,
    replacementTransition,
    resourceId,
    service,
    sourceLoader,
    transaction,
    transitionId,
    getCapturedPayload: () => capturedPayload,
  };
}

function workerHarness(
  harness: ReturnType<typeof requestHarness>,
  overrides: Readonly<{
    sourceMissing?: boolean;
    transitionProposalId?: string;
    comparisonBeforeVersionId?: string;
  }> = {},
) {
  const sourceLoader = {
    load: vi.fn(async () => harness.sourceLoader.load()),
  };
  const aiRouter = { run: vi.fn() };
  const transaction = {
    documentVersion: {
      findUnique: vi.fn(async () => ({
        id: harness.currentDocumentVersionId,
        documentId: harness.documentId,
        document: {
          projectId: harness.kind === "project" ? harness.resourceId : null,
          workstreamId: harness.kind === "workstream" ? harness.resourceId : null,
        },
      })),
    },
    dynamicCriteriaProposal: {
      findUnique: vi.fn(async () => ({
        id: harness.priorProposalId,
        kind: harness.kind,
        projectId: harness.kind === "project" ? harness.resourceId : null,
        workstreamId: harness.kind === "workstream" ? harness.resourceId : null,
        sourceDocumentVersionId: harness.priorDocumentVersionId,
        state: harness.material ? "activated" : "superseded",
        transitions: [
          {
            id: harness.transitionId,
            fromState: harness.replacementTransition,
            toState: "superseded",
          },
        ],
      })),
    },
    dynamicCriteriaSet: {
      findUnique: vi.fn(async () =>
        harness.material ? { id: crypto.randomUUID(), effectiveTo: null } : null,
      ),
    },
    dynamicCriteriaProposalTransition: {
      findUnique: vi.fn(async () =>
        overrides.sourceMissing
          ? null
          : {
              id: harness.transitionId,
              proposalId: overrides.transitionProposalId ?? harness.priorProposalId,
              fromState: harness.replacementTransition,
              toState: "superseded",
              reason: harness.ownerFeedback,
            },
      ),
    },
    documentComparisonReview: {
      findUnique: vi.fn(async () =>
        overrides.sourceMissing
          ? null
          : {
              id: harness.comparisonReviewId,
              effectiveClassification: "material_scope_or_goal_change",
              reason: harness.ownerFeedback,
              comparison: {
                documentId: harness.documentId,
                beforeVersionId:
                  overrides.comparisonBeforeVersionId ?? harness.priorDocumentVersionId,
                afterVersionId: harness.currentDocumentVersionId,
              },
            },
      ),
    },
  };
  const service = new ProposalService(
    {
      $transaction: vi.fn(async (callback: (value: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    } as never,
    {} as never,
    {} as never,
    sourceLoader,
    aiRouter,
    {} as never,
    {} as never,
    {} as never,
    { systemId: crypto.randomUUID(), timeoutMs: 1_000, now: () => now },
  );
  return { aiRouter, service, sourceLoader };
}

describe("ProposalService durable owner feedback", () => {
  it("reconstructs correction feedback in a fresh worker instance from the outbox reference", async () => {
    const harness = requestHarness({ material: false });
    await harness.service.requestGeneration({
      actor: { userId: harness.identity.primaryOwnerId, active: true },
      correlationId: crypto.randomUUID(),
      kind: "project",
      resourceId: harness.identity.projectId,
      documentVersionId: harness.currentDocumentVersionId,
      idempotencyKey: crypto.randomUUID(),
      replacesProposalId: harness.priorProposalId,
      ownerFeedback: harness.ownerFeedback,
    });
    const payload = harness.getCapturedPayload();
    expect(payload).toMatchObject({
      ownerFeedbackSource: {
        kind: "proposal_transition",
        referenceId: harness.transitionId,
        sha256: feedbackHash(harness.ownerFeedback),
      },
    });
    expect(JSON.stringify(payload)).not.toContain(harness.ownerFeedback);

    const worker = workerHarness(harness);

    await expect(
      worker.service.prepareGeneration({
        job: payload as never,
        readinessSourceReferences: harness.prerequisites.sourceReferences,
      }),
    ).resolves.toMatchObject({
      input: {
        untrustedContent: {
          ownerFeedback: {
            value: harness.ownerFeedback,
          },
        },
      },
    });
  });

  it("creates a replacement from a manager request_revision transition", async () => {
    const harness = requestHarness({
      material: false,
      kind: "workstream",
      replacementTransition: "manager_resolution",
    });

    await harness.service.requestGeneration({
      actor: { userId: harness.identity.primaryOwnerId, active: true },
      correlationId: crypto.randomUUID(),
      kind: "workstream",
      resourceId: harness.resourceId,
      documentVersionId: harness.currentDocumentVersionId,
      idempotencyKey: crypto.randomUUID(),
      replacesProposalId: harness.priorProposalId,
      ownerFeedback: harness.ownerFeedback,
    });
    const payload = harness.getCapturedPayload();
    expect(payload).toMatchObject({
      replacesProposalId: harness.priorProposalId,
      ownerFeedbackSource: {
        kind: "proposal_transition",
        referenceId: harness.transitionId,
        sha256: feedbackHash(harness.ownerFeedback),
      },
    });

    const worker = workerHarness(harness);
    await expect(
      worker.service.prepareGeneration({
        job: payload as never,
        readinessSourceReferences: harness.prerequisites.sourceReferences,
      }),
    ).resolves.toMatchObject({
      input: {
        untrustedContent: {
          ownerFeedback: {
            value: harness.ownerFeedback,
          },
        },
      },
    });
  });

  it.each(["missing", "tampered"] as const)(
    "fails closed when the immutable feedback source is %s",
    async (failure) => {
      const harness = requestHarness({ material: false });
      await harness.service.requestGeneration({
        actor: { userId: harness.identity.primaryOwnerId, active: true },
        correlationId: crypto.randomUUID(),
        kind: "project",
        resourceId: harness.identity.projectId,
        documentVersionId: harness.currentDocumentVersionId,
        idempotencyKey: crypto.randomUUID(),
        replacesProposalId: harness.priorProposalId,
        ownerFeedback: harness.ownerFeedback,
      });
      const payload = structuredClone(harness.getCapturedPayload()!);
      if (failure === "tampered") {
        Object.assign(payload.ownerFeedbackSource as object, { sha256: "f".repeat(64) });
      }
      const worker = workerHarness(harness, { sourceMissing: failure === "missing" });

      await expect(
        worker.service.prepareGeneration({
          job: payload as never,
          readinessSourceReferences: harness.prerequisites.sourceReferences,
        }),
      ).rejects.toMatchObject({ code: "CRITERIA_REPLACEMENT_INVALID" });
    },
  );

  it("pins reviewed material feedback to the immutable comparison review", async () => {
    const harness = requestHarness({ material: true });
    await harness.service.requestGeneration({
      actor: { userId: harness.identity.primaryOwnerId, active: true },
      correlationId: crypto.randomUUID(),
      kind: "project",
      resourceId: harness.identity.projectId,
      documentVersionId: harness.currentDocumentVersionId,
      idempotencyKey: crypto.randomUUID(),
      replacesProposalId: harness.priorProposalId,
      ownerFeedback: harness.ownerFeedback,
      materialComparisonReviewId: harness.comparisonReviewId,
    });

    expect(harness.getCapturedPayload()).toMatchObject({
      materialComparisonReviewId: harness.comparisonReviewId,
      ownerFeedbackSource: {
        kind: "comparison_review",
        referenceId: harness.comparisonReviewId,
        sha256: feedbackHash(harness.ownerFeedback),
      },
    });
  });

  it("rejects a correctly hashed correction transition from another proposal before prompt work", async () => {
    const harness = requestHarness({ material: false });
    await harness.service.requestGeneration({
      actor: { userId: harness.identity.primaryOwnerId, active: true },
      correlationId: crypto.randomUUID(),
      kind: "project",
      resourceId: harness.identity.projectId,
      documentVersionId: harness.currentDocumentVersionId,
      idempotencyKey: crypto.randomUUID(),
      replacesProposalId: harness.priorProposalId,
      ownerFeedback: harness.ownerFeedback,
    });
    const worker = workerHarness(harness, {
      transitionProposalId: crypto.randomUUID(),
    });

    await expect(
      worker.service.prepareGeneration({
        job: harness.getCapturedPayload() as never,
        readinessSourceReferences: harness.prerequisites.sourceReferences,
      }),
    ).rejects.toMatchObject({ code: "CRITERIA_REPLACEMENT_INVALID" });
    expect(worker.sourceLoader.load).not.toHaveBeenCalled();
    expect(worker.aiRouter.run).not.toHaveBeenCalled();
  });

  it("rejects a correctly hashed material review with wrong document lineage before prompt work", async () => {
    const harness = requestHarness({ material: true });
    await harness.service.requestGeneration({
      actor: { userId: harness.identity.primaryOwnerId, active: true },
      correlationId: crypto.randomUUID(),
      kind: "project",
      resourceId: harness.identity.projectId,
      documentVersionId: harness.currentDocumentVersionId,
      idempotencyKey: crypto.randomUUID(),
      replacesProposalId: harness.priorProposalId,
      ownerFeedback: harness.ownerFeedback,
      materialComparisonReviewId: harness.comparisonReviewId,
    });
    const worker = workerHarness(harness, {
      comparisonBeforeVersionId: crypto.randomUUID(),
    });

    await expect(
      worker.service.prepareGeneration({
        job: harness.getCapturedPayload() as never,
        readinessSourceReferences: harness.prerequisites.sourceReferences,
      }),
    ).rejects.toMatchObject({ code: "CRITERIA_REPLACEMENT_INVALID" });
    expect(worker.sourceLoader.load).not.toHaveBeenCalled();
    expect(worker.aiRouter.run).not.toHaveBeenCalled();
  });

  it("reconstructs reviewed material feedback in a fresh worker instance", async () => {
    const harness = requestHarness({ material: true });
    await harness.service.requestGeneration({
      actor: { userId: harness.identity.primaryOwnerId, active: true },
      correlationId: crypto.randomUUID(),
      kind: "project",
      resourceId: harness.identity.projectId,
      documentVersionId: harness.currentDocumentVersionId,
      idempotencyKey: crypto.randomUUID(),
      replacesProposalId: harness.priorProposalId,
      ownerFeedback: harness.ownerFeedback,
      materialComparisonReviewId: harness.comparisonReviewId,
    });
    const worker = workerHarness(harness);

    await expect(
      worker.service.prepareGeneration({
        job: harness.getCapturedPayload() as never,
        readinessSourceReferences: harness.prerequisites.sourceReferences,
      }),
    ).resolves.toMatchObject({
      input: {
        untrustedContent: {
          ownerFeedback: {
            value: harness.ownerFeedback,
          },
        },
      },
    });
  });
});
