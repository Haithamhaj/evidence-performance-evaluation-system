import { describe, expect, it, vi } from "vitest";

import { CriteriaDocumentReader } from "./criteria-document-reader.js";

const documentVersionId = "00000000-0000-4000-8000-000000000031";

describe("CriteriaDocumentReader", () => {
  it("locks the stable document and reports whether a version is still current", async () => {
    const documentId = crypto.randomUUID();
    const queryRaw = vi.fn(async () => [{ id: documentId }]);
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({
        id: documentVersionId,
        documentId,
        version: 2,
        document: { currentVersion: 2 },
      })
      .mockResolvedValueOnce({
        id: documentVersionId,
        documentId,
        version: 2,
        document: { currentVersion: 3 },
      });
    const transaction = {
      $queryRaw: queryRaw,
      documentVersion: { findUnique },
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
      documentVersion: { version: 2 },
      document: { projectId: crypto.randomUUID(), workstreamId: crypto.randomUUID() },
      lifecycleTransitions: [{ toState: "ready_for_criteria_generation" }],
      sourceReferences: [`document-source:${crypto.randomUUID()}`],
    };
    const findFirst = vi.fn(async () => readiness);
    const reader = new CriteriaDocumentReader({
      documentReadinessCheck: { findFirst },
    } as never);

    await expect(reader.getPrerequisites({ documentVersionId })).resolves.toEqual({
      documentId: readiness.documentId,
      documentVersionId,
      documentVersion: 2,
      readinessCheckId: readiness.id,
      lifecycleState: "ready_for_criteria_generation",
      projectId: readiness.document.projectId,
      workstreamId: readiness.document.workstreamId,
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
