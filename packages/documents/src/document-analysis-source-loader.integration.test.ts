import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import { DocumentAnalysisSourceLoader } from "./document-analysis-source-loader.js";

describe("DocumentAnalysisSourceLoader", () => {
  it("reconstructs only the immutable version, pinned template, and stored source rows", async () => {
    const versionId = crypto.randomUUID();
    const sourceId = crypto.randomUUID();
    const storage = {
      readStream: vi.fn(async () => Readable.from(["stored bytes"])),
    };
    const database = {
      documentVersion: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
          where.id === versionId
            ? {
                id: versionId,
                version: 2,
                templateVersionId: crypto.randomUUID(),
                document: {
                  id: crypto.randomUUID(),
                  currentVersion: 2,
                  projectId: crypto.randomUUID(),
                  workstreamId: null,
                  organizationId: crypto.randomUUID(),
                  departmentId: crypto.randomUUID(),
                },
                templateVersion: {
                  sections: [
                    { key: "scope", required: true, protected: true, position: 1, display: {} },
                  ],
                },
                sources: [
                  {
                    id: sourceId,
                    sourceType: "upload",
                    position: 1,
                    url: null,
                    externalSourceId: null,
                    uploadedSource: {
                      objectKey: "documents/org/project/id/object",
                      detectedMime: "text/markdown",
                      byteSize: 12,
                      sha256: "b".repeat(64),
                    },
                  },
                ],
              }
            : null,
        ),
      },
    };
    const loader = new DocumentAnalysisSourceLoader(database as never, storage as never, {
      maxSourceBytes: 1_024,
    });
    const loaded = await loader.load({ documentVersionId: versionId });
    expect(loaded.documentVersionId).toBe(versionId);
    expect(loaded.templateSections).toEqual([
      expect.objectContaining({ key: "scope", required: true }),
    ]);
    expect(loaded.sources[0]).toMatchObject({
      reference: `document-source:${sourceId}`,
      mediaType: "text/markdown",
    });
    await loaded.sources[0]!.openStream!();
    expect(storage.readStream).toHaveBeenCalledWith({
      key: "documents/org/project/id/object",
      maxBytes: 1_024,
    });
    expect(database.documentVersion.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: versionId } }),
    );
  });
});
