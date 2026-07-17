import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { ProposalService } from "./proposal-service.js";

const now = new Date("2026-07-17T12:00:00.000Z");

function feedbackHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function requestHarness(input: Readonly<{ material: boolean }>) {
  const ownerId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const documentId = crypto.randomUUID();
  const currentDocumentVersionId = crypto.randomUUID();
  const priorDocumentVersionId = input.material ? crypto.randomUUID() : currentDocumentVersionId;
  const readinessCheckId = crypto.randomUUID();
  const priorProposalId = crypto.randomUUID();
  const transitionId = crypto.randomUUID();
  const comparisonReviewId = crypto.randomUUID();
  const transitionReason = "Generate a corrected alternative from the owner review.";
  const comparisonReason = "The reviewed document comparison requires revised criteria.";
  const ownerFeedback = input.material ? comparisonReason : transitionReason;
  let capturedPayload: Record<string, unknown> | undefined;
  const prerequisites = {
    documentId,
    documentVersionId: currentDocumentVersionId,
    documentVersion: 2,
    readinessCheckId,
    lifecycleState: input.material ? "revision_required" : "ready_for_criteria_generation",
    projectId,
    workstreamId: null,
    sourceReferences: [`readiness:${readinessCheckId}`],
  } as const;
  const identity = {
    kind: "project",
    resourceId: projectId,
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
        kind: "project",
        projectId,
        workstreamId: null,
        sourceDocumentVersionId: priorDocumentVersionId,
        state: "superseded",
        transitions: [
          {
            id: transitionId,
            fromState: "owner_review",
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
    comparisonReviewId,
    currentDocumentVersionId,
    database,
    identity,
    ownerFeedback,
    priorProposalId,
    prerequisites,
    service,
    sourceLoader,
    transaction,
    transitionId,
    getCapturedPayload: () => capturedPayload,
  };
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

    const freshService = new ProposalService(
      {
        $transaction: vi.fn(
          async (
            callback: (transaction: {
              dynamicCriteriaProposalTransition: {
                findUnique: ReturnType<typeof vi.fn>;
              };
            }) => Promise<unknown>,
          ) =>
            callback({
              dynamicCriteriaProposalTransition: {
                findUnique: vi.fn(async () => ({
                  id: harness.transitionId,
                  reason: harness.ownerFeedback,
                })),
              },
            }),
        ),
      } as never,
      {} as never,
      {} as never,
      harness.sourceLoader,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { systemId: crypto.randomUUID(), timeoutMs: 1_000, now: () => now },
    );

    await expect(
      freshService.prepareGeneration({
        job: payload as never,
        readinessSourceReferences: harness.prerequisites.sourceReferences,
      }),
    ).resolves.toMatchObject({
      input: {
        untrustedOwnerFeedback: {
          value: harness.ownerFeedback,
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
      const worker = new ProposalService(
        {
          $transaction: vi.fn(
            async (
              callback: (transaction: {
                dynamicCriteriaProposalTransition: {
                  findUnique: ReturnType<typeof vi.fn>;
                };
              }) => Promise<unknown>,
            ) =>
              callback({
                dynamicCriteriaProposalTransition: {
                  findUnique: vi.fn(async () =>
                    failure === "missing"
                      ? null
                      : { id: harness.transitionId, reason: harness.ownerFeedback },
                  ),
                },
              }),
          ),
        } as never,
        {} as never,
        {} as never,
        harness.sourceLoader,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        { systemId: crypto.randomUUID(), timeoutMs: 1_000, now: () => now },
      );

      await expect(
        worker.prepareGeneration({
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
});
