import { describe, expect, it, vi } from "vitest";

import { CriteriaDocumentReader } from "./criteria-document-reader.js";

const documentVersionId = "00000000-0000-4000-8000-000000000031";

describe("CriteriaDocumentReader", () => {
  it("locks the stable document and reports whether a version is still current", async () => {
    const documentId = crypto.randomUUID();
    const queryRaw = vi.fn(async () => [{ id: documentId }]);
    const findUnique = vi.fn(async () => ({
      id: documentVersionId,
      documentId,
      version: 2,
    }));
    const findDocument = vi
      .fn()
      .mockResolvedValueOnce({ currentVersion: 2 })
      .mockResolvedValueOnce({ currentVersion: 3 });
    const transaction = {
      $queryRaw: queryRaw,
      documentVersion: { findUnique },
      documentRecord: { findUnique: findDocument },
    } as never;
    const reader = new CriteriaDocumentReader({} as never);

    await expect(reader.lockVersionIdentityIn(transaction, { documentVersionId })).resolves.toEqual(
      { documentId, documentVersionId, isCurrent: true },
    );
    await expect(reader.lockVersionIdentityIn(transaction, { documentVersionId })).resolves.toEqual(
      { documentId, documentVersionId, isCurrent: false },
    );
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it("returns only current ready prerequisites from the document-owned read port", async () => {
    const readiness = {
      id: crypto.randomUUID(),
      documentId: crypto.randomUUID(),
      documentVersionId,
      projectId: crypto.randomUUID(),
      workstreamId: crypto.randomUUID(),
      sourceReferences: [`document-source:${crypto.randomUUID()}`],
    };
    const findFirst = vi.fn(async () => readiness);
    const reader = new CriteriaDocumentReader({
      documentReadinessCheck: { findFirst },
      documentRecord: {
        findUnique: vi.fn(async () => ({
          projectId: readiness.projectId,
          workstreamId: readiness.workstreamId,
        })),
      },
      documentVersion: { findUnique: vi.fn(async () => ({ version: 2 })) },
      documentReadinessLifecycleTransition: {
        findFirst: vi.fn(async () => ({ toState: "ready_for_criteria_generation" })),
      },
    } as never);

    await expect(reader.getPrerequisites({ documentVersionId })).resolves.toEqual({
      documentId: readiness.documentId,
      documentVersionId,
      documentVersion: 2,
      readinessCheckId: readiness.id,
      lifecycleState: "ready_for_criteria_generation",
      projectId: readiness.projectId,
      workstreamId: readiness.workstreamId,
      sourceReferences: readiness.sourceReferences,
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          documentVersionId,
          analyzedState: "ready_for_criteria_generation",
          stale: false,
        },
      }),
    );
  });

  it("returns only the document-owned workstream scope without querying Projects persistence", async () => {
    const documentId = crypto.randomUUID();
    const workstreamId = crypto.randomUUID();
    const readinessCheckId = crypto.randomUUID();
    const reader = new CriteriaDocumentReader({
      documentReadinessCheck: {
        findFirst: vi.fn(async () => ({
          id: readinessCheckId,
          documentId,
          documentVersionId,
          sourceReferences: [`document-version:${documentVersionId}`],
        })),
      },
      documentRecord: {
        findUnique: vi.fn(async () => ({ projectId: null, workstreamId })),
      },
      documentVersion: { findUnique: vi.fn(async () => ({ version: 1 })) },
      documentReadinessLifecycleTransition: {
        findFirst: vi.fn(async () => ({ toState: "ready_for_criteria_generation" })),
      },
    } as never);

    await expect(reader.getPrerequisites({ documentVersionId })).resolves.toMatchObject({
      documentId,
      projectId: null,
      workstreamId,
    });
  });

  it("locks and returns latest reviewed material lineage without mutating comparison history", async () => {
    const documentId = crypto.randomUUID();
    const reviewId = crypto.randomUUID();
    const comparisonId = crypto.randomUUID();
    const beforeDocumentVersionId = crypto.randomUUID();
    const afterDocumentVersionId = crypto.randomUUID();
    const transaction = {
      $queryRaw: vi.fn(async () => []),
      documentComparisonReview: {
        findUnique: vi.fn(async () => ({
          id: reviewId,
          comparisonId,
          effectiveClassification: "material_scope_or_goal_change",
          reason: "Reviewed material change.",
        })),
        findFirst: vi.fn(async () => ({ id: reviewId })),
      },
      documentComparison: {
        findUnique: vi.fn(async () => ({
          documentId,
          beforeVersionId: beforeDocumentVersionId,
          afterVersionId: afterDocumentVersionId,
        })),
      },
      documentVersion: { findUnique: vi.fn(async () => ({ version: 2 })) },
      documentRecord: { findUnique: vi.fn(async () => ({ currentVersion: 2 })) },
    } as never;
    const reader = new CriteriaDocumentReader({} as never);

    await expect(
      reader.lockReviewedMaterialRevisionIn(transaction, { comparisonReviewId: reviewId }),
    ).resolves.toEqual({
      comparisonReviewId: reviewId,
      documentId,
      beforeDocumentVersionId,
      afterDocumentVersionId,
      effectiveClassification: "material_scope_or_goal_change",
      reviewReason: "Reviewed material change.",
      isLatestReview: true,
      isCurrentAfterVersion: true,
    });
  });

  it("appends a legal lifecycle transition and rejects an illegal transition before writing", async () => {
    const create = vi.fn(async () => ({}));
    const reader = new CriteriaDocumentReader({} as never);
    const transaction = {
      documentReadinessLifecycleTransition: { create },
    } as never;
    const base = {
      readinessCheckId: crypto.randomUUID(),
      documentVersionId,
      actorId: crypto.randomUUID(),
      reason: "Criteria approved by the authorized human",
      effectiveAt: new Date("2026-07-17T12:00:00.000Z"),
    };

    await reader.appendLifecycleTransition(transaction, {
      ...base,
      fromState: "ready_for_criteria_generation",
      toState: "criteria_approved",
    });
    expect(create).toHaveBeenCalledOnce();
    await expect(
      reader.appendLifecycleTransition(transaction, {
        ...base,
        fromState: "draft",
        toState: "criteria_approved",
      }),
    ).rejects.toMatchObject({ code: "READINESS_LIFECYCLE_INVALID" });
    expect(create).toHaveBeenCalledOnce();
  });
});
