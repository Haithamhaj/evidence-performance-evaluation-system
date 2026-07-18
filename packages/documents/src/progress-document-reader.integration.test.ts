import { describe, expect, it, vi } from "vitest";

import { ProgressDocumentReader } from "./progress-document-reader.js";

describe("ProgressDocumentReader", () => {
  it("returns the exact current ready document version and its owned scope", async () => {
    const documentId = crypto.randomUUID();
    const documentVersionId = crypto.randomUUID();
    const readinessCheckId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const reader = new ProgressDocumentReader({
      documentReadinessCheck: {
        findFirst: vi.fn(async () => ({
          id: readinessCheckId,
          documentId,
          documentVersionId,
          sourceReferences: [`document-version:${documentVersionId}`],
        })),
      },
      documentRecord: {
        findUnique: vi.fn(async () => ({ currentVersion: 3, projectId, workstreamId: null })),
      },
      documentVersion: {
        findUnique: vi.fn(async () => ({ documentId, version: 3 })),
      },
      documentReadinessLifecycleTransition: {
        findFirst: vi.fn(async () => ({ toState: "criteria_approved" })),
      },
    } as never);

    await expect(reader.getApprovedSource({ documentVersionId })).resolves.toEqual({
      documentId,
      documentVersionId,
      documentVersion: 3,
      readinessCheckId,
      projectId,
      workstreamId: null,
      sourceReferences: [`document-version:${documentVersionId}`],
    });
  });

  it.each([
    ["a stale version", 4, "criteria_approved"],
    ["a source before criteria approval", 3, "ready_for_criteria_generation"],
  ])("rejects %s", async (_label, currentVersion, lifecycleState) => {
    const documentId = crypto.randomUUID();
    const documentVersionId = crypto.randomUUID();
    const reader = new ProgressDocumentReader({
      documentReadinessCheck: {
        findFirst: vi.fn(async () => ({
          id: crypto.randomUUID(),
          documentId,
          documentVersionId,
          sourceReferences: [],
        })),
      },
      documentRecord: {
        findUnique: vi.fn(async () => ({
          currentVersion,
          projectId: crypto.randomUUID(),
          workstreamId: null,
        })),
      },
      documentVersion: {
        findUnique: vi.fn(async () => ({ documentId, version: 3 })),
      },
      documentReadinessLifecycleTransition: {
        findFirst: vi.fn(async () => ({ toState: lifecycleState })),
      },
    } as never);

    await expect(reader.getApprovedSource({ documentVersionId })).resolves.toBeNull();
  });
});
