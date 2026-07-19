import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { ProgressContractDraftSourceReader } from "./progress-contract-draft-source-reader.js";

const actor = { userId: crypto.randomUUID(), active: true } as const;
const projectId = crypto.randomUUID();
const documentId = crypto.randomUUID();
const documentVersionId = crypto.randomUUID();
const sourceId = crypto.randomUUID();
const content = "Approved scope\nAcceptance requires a reviewed release.";
const checksum = createHash("sha256").update(content).digest("hex");

function harness(overrides: {
  documentProjectId?: string;
  lifecycleState?: string;
  version?: number;
  currentVersion?: number;
  extractedChecksum?: string;
} = {}) {
  const database = {
    documentReadinessCheck: {
      findFirst: vi.fn(async () => ({
        id: crypto.randomUUID(),
        documentId,
        documentVersionId,
        stale: false,
      })),
    },
    documentReadinessLifecycleTransition: {
      findFirst: vi.fn(async () => ({
        toState: overrides.lifecycleState ?? "criteria_approved",
      })),
    },
    documentRecord: {
      findUnique: vi.fn(async () => ({
        id: documentId,
        projectId: overrides.documentProjectId ?? projectId,
        workstreamId: null,
        currentVersion: overrides.currentVersion ?? 2,
      })),
    },
    documentVersion: {
      findUnique: vi.fn(async () => ({
        id: documentVersionId,
        documentId,
        version: overrides.version ?? 2,
      })),
    },
  };
  const identityReader = {
    read: vi.fn(async () => ({
      kind: "project",
      resourceId: projectId,
      projectId,
      organizationId: crypto.randomUUID(),
      departmentId: crypto.randomUUID(),
      status: "active",
    })),
  };
  const sourceLoader = {
    load: vi.fn(async () => ({
      identity: await identityReader.read(),
      documentId,
      documentVersionId,
      documentVersion: 2,
      currentVersion: 2,
      templateVersionId: crypto.randomUUID(),
      templateSections: [],
      sourceReferences: [`document-source:${sourceId}`],
      sources: [],
    })),
  };
  const extract = vi.fn(async () => ({
    coverage: "complete" as const,
    sources: [
      {
        reference: `document-source:${sourceId}`,
        mediaType: "text/markdown",
        coverage: "complete" as const,
        sha256: overrides.extractedChecksum ?? checksum,
        contentBase64: Buffer.from(content).toString("base64"),
      },
    ],
  }));
  const authorize = vi.fn(async () => undefined);
  return {
    authorize,
    reader: new ProgressContractDraftSourceReader(
      database as never,
      identityReader as never,
      sourceLoader as never,
      {
        maxSourceBytes: 100_000,
        maxArchiveEntries: 100,
        maxArchiveUncompressedBytes: 1_000_000,
        maxArchiveCompressionRatio: 20,
        maxQuotedCharacters: 20_000,
      },
      extract,
      authorize,
    ),
  };
}

describe("ProgressContractDraftSourceReader", () => {
  it("returns bounded quoted untrusted content from the exact approved Project version", async () => {
    const context = harness();
    const result = await context.reader.loadApprovedVersion({
      actor,
      projectId,
      documentVersionId,
      sourceChecksum: checksum,
    });

    expect(result).toMatchObject({
      projectId,
      documentId,
      documentVersionId,
      documentVersion: 2,
      sourceChecksum: checksum,
      quotedSections: [
        {
          reference: `document-source:${sourceId}`,
          mediaType: "text/markdown",
          text: content,
          trust: "untrusted",
        },
      ],
    });
    expect(context.authorize).toHaveBeenCalledOnce();
  });

  it.each([
    ["a cross-Project document", { documentProjectId: crypto.randomUUID() }],
    ["an unapproved version", { lifecycleState: "ready_for_criteria_generation" }],
    ["a stale version", { currentVersion: 3 }],
    ["a checksum mismatch", { extractedChecksum: "a".repeat(64) }],
  ])("rejects %s", async (_label, overrides) => {
    const context = harness(overrides);
    await expect(
      context.reader.loadApprovedVersion({
        actor,
        projectId,
        documentVersionId,
        sourceChecksum: checksum,
      }),
    ).rejects.toMatchObject({
      code: expect.stringMatching(
        /PROGRESS_CONTRACT_DRAFT_SOURCE_(?:INVALID|CHECKSUM_MISMATCH)/u,
      ),
    });
  });
});
