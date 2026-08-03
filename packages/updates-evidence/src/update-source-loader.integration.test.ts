import { describe, expect, it } from "vitest";

import { PrismaUpdateSourceLoader } from "./update-source-loader.js";

const ids = {
  update: "00000000-0000-4000-8000-000000000001",
  employee: "00000000-0000-4000-8000-000000000002",
  project: "00000000-0000-4000-8000-000000000003",
  attachment: "00000000-0000-4000-8000-000000000004",
};

describe("PrismaUpdateSourceLoader", () => {
  it("returns bounded quoted untrusted source input without exposing an upload object key", async () => {
    const loader = new PrismaUpdateSourceLoader();
    const transaction = {
      updateSourceAttachment: {
        findMany: async () => [
          {
            id: ids.attachment,
            sourceVersion: 1,
            kind: "file",
            uploadedSourceId: "00000000-0000-4000-8000-000000000005",
            content: null,
            sourceUrl: null,
            uploadedSource: {
              id: "00000000-0000-4000-8000-000000000005",
              createdById: ids.employee,
              projectId: ids.project,
              workstreamId: null,
              originalFilename: "acceptance.pdf",
              detectedMime: "application/pdf",
              byteSize: 1200,
              sha256: "a".repeat(64),
              objectKey: "private/never-exposed",
            },
          },
        ],
      },
    };

    const loaded = await loader.loadIn(transaction as never, {
      updateSourceId: ids.update,
      employeeId: ids.employee,
      projectId: ids.project,
      workstreamId: null,
    });

    expect(loaded.untrustedText).toContain("BEGIN_UNTRUSTED_UPDATE_SOURCE");
    expect(loaded.untrustedText).toContain("acceptance.pdf");
    expect(loaded.untrustedText).not.toContain("private/never-exposed");
    expect(loaded.sourceReferences).toEqual([`update-source-attachment:${ids.attachment}:1`]);
  });

  it("rejects a private upload outside the employee and Project scope", async () => {
    const loader = new PrismaUpdateSourceLoader();
    const transaction = {
      updateSourceAttachment: {
        findMany: async () => [
          {
            id: ids.attachment,
            sourceVersion: 1,
            kind: "file",
            uploadedSourceId: "00000000-0000-4000-8000-000000000005",
            content: null,
            sourceUrl: null,
            uploadedSource: {
              id: "00000000-0000-4000-8000-000000000005",
              createdById: crypto.randomUUID(),
              projectId: ids.project,
              workstreamId: null,
              originalFilename: "private.pdf",
              detectedMime: "application/pdf",
              byteSize: 1200,
              sha256: "b".repeat(64),
            },
          },
        ],
      },
    };

    await expect(
      loader.loadIn(transaction as never, {
        updateSourceId: ids.update,
        employeeId: ids.employee,
        projectId: ids.project,
        workstreamId: null,
      }),
    ).rejects.toMatchObject({ code: "SCOPE_MISMATCH", status: 403 });
  });
});
