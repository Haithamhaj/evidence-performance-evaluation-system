import { AppError } from "@evaluation/contracts";
import { describe, expect, it, vi } from "vitest";

import { ResearchDocumentSourceReader } from "./research-document-source-reader.js";

const actor = { userId: crypto.randomUUID(), active: true } as const;
const projectId = crypto.randomUUID();
const documentId = crypto.randomUUID();
const documentVersionId = crypto.randomUUID();
const otherVersionId = crypto.randomUUID();
const checksum = "a".repeat(64);
const sourceReference = `document-source:${crypto.randomUUID()}`;

function harness() {
  const locator = {
    locateApprovedProjectVersion: vi.fn(async () => ({
      documentVersionId,
      sourceChecksum: checksum,
      sourceVersion: 3,
    })),
  };
  const approvedSources = {
    loadApprovedVersion: vi.fn(async () => ({
      projectId,
      departmentScopeId: crypto.randomUUID(),
      documentId,
      documentVersionId,
      documentVersion: 3,
      sourceChecksum: checksum,
      sourceReferences: [sourceReference],
      quotedSections: [
        {
          reference: sourceReference,
          mediaType: "text/markdown",
          text: "# Objective\nShip approved immutable context.",
          trust: "untrusted" as const,
        },
      ],
    })),
  };
  return {
    locator,
    approvedSources,
    reader: new ResearchDocumentSourceReader(locator, approvedSources),
  };
}

describe("ResearchDocumentSourceReader", () => {
  it("returns safe extracted text from the exact approved immutable Project version", async () => {
    const { reader } = harness();

    await expect(
      reader.readApprovedVersion({ actor, documentVersionId, projectId }),
    ).resolves.toEqual({
      projectId,
      documentId,
      documentVersionId,
      documentVersion: 3,
      sourceChecksumSha256: checksum,
      sourceReferences: [sourceReference],
      extractedText: "# Objective\nShip approved immutable context.",
    });
  });

  it("rejects a stale or cross-Project requested version without loading its content", async () => {
    const { reader, approvedSources } = harness();

    await expect(
      reader.readApprovedVersion({ actor, documentVersionId: otherVersionId, projectId }),
    ).rejects.toMatchObject({ code: "RESEARCH_DOCUMENT_SOURCE_INVALID" });
    expect(approvedSources.loadApprovedVersion).not.toHaveBeenCalled();
  });

  it("preserves an authorization failure from the approved-source owner boundary", async () => {
    const { reader, locator } = harness();
    locator.locateApprovedProjectVersion.mockRejectedValueOnce(
      new AppError("AUTHZ_SCOPE_MISMATCH", "errors.authorization.denied", 403),
    );

    await expect(
      reader.readApprovedVersion({
        actor: { ...actor, active: false },
        documentVersionId,
        projectId,
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_SCOPE_MISMATCH", status: 403 });
  });
});
