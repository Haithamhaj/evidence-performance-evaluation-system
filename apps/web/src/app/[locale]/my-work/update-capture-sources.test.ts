import { describe, expect, it, vi } from "vitest";

import {
  collectCaptureSources,
  mergeResumedCaptureSources,
  updateDraftText,
  uploadUpdateFile,
} from "./update-capture-sources.js";

const scope = {
  projectId: "11111111-1111-4111-8111-111111111111",
  workstreamId: null,
};

describe("universal Update capture sources", () => {
  it("uses the inspected private upload route and returns a typed image source", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: "22222222-2222-4222-8222-222222222222" }), {
          status: 200,
        }),
    );
    const source = await uploadUpdateFile(
      new File(["png"], "proof.png", { type: "image/png" }),
      scope,
      fetcher,
    );

    expect(source).toEqual({
      kind: "image",
      uploadedSourceId: "22222222-2222-4222-8222-222222222222",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/daily-work/evidence/uploads",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("collects source-only and combined captures as one ordered typed source list", async () => {
    const sourceOnly = new FormData();
    sourceOnly.append("sourceFiles", new File(["png"], "before.png", { type: "image/png" }));
    sourceOnly.append("sourceFiles", new File(["pdf"], "record.pdf", { type: "application/pdf" }));
    sourceOnly.set("sourceCode", "expect(ready).toBe(true);");
    sourceOnly.set("sourceCli", "pnpm test: 24 passed");
    sourceOnly.set("sourceUrl", "https://example.invalid/acceptance");
    sourceOnly.set("sourceGithub", "PR #42 passed the required checks.");

    const sources = await collectCaptureSources(sourceOnly, scope, async (file) => ({
      kind: file.type.startsWith("image/") ? "image" : "file",
      uploadedSourceId:
        file.name === "before.png"
          ? "33333333-3333-4333-8333-333333333333"
          : "44444444-4444-4444-8444-444444444444",
    }));

    expect(sources).toEqual([
      { kind: "image", uploadedSourceId: "33333333-3333-4333-8333-333333333333" },
      { kind: "file", uploadedSourceId: "44444444-4444-4444-8444-444444444444" },
      { kind: "pasted_code", text: "expect(ready).toBe(true);" },
      { kind: "cli_snapshot", text: "pnpm test: 24 passed" },
      { kind: "url", url: "https://example.invalid/acceptance" },
      { kind: "github_snapshot", text: "PR #42 passed the required checks." },
    ]);
  });

  it("does not upload the empty file entry emitted by an untouched browser picker", async () => {
    const form = new FormData();
    form.append("sourceFiles", new File([], "", { type: "application/octet-stream" }));
    await expect(
      collectCaptureSources(form, scope, async () => {
        throw new Error("empty picker must not upload");
      }),
    ).resolves.toEqual([]);
  });

  it("preserves only recoverable source metadata when raw text is edited", () => {
    expect(
      updateDraftText(
        {
          projectId: scope.projectId,
          workstreamId: null,
          workItemId: null,
          rawText: "first text",
          sources: [
            { kind: "image", uploadedSourceId: "33333333-3333-4333-8333-333333333333" },
            { kind: "url", url: "https://example.invalid/acceptance" },
            { kind: "cli_snapshot" },
          ],
        },
        "revised text",
      ),
    ).toEqual({
      projectId: scope.projectId,
      workstreamId: null,
      workItemId: null,
      rawText: "revised text",
      sources: [
        { kind: "image", uploadedSourceId: "33333333-3333-4333-8333-333333333333" },
        { kind: "url", url: "https://example.invalid/acceptance" },
        { kind: "cli_snapshot" },
      ],
    });
  });

  it("constructs a retry submission from recovered upload and URL metadata without reviving stripped bodies", () => {
    expect(
      mergeResumedCaptureSources(
        [
          { kind: "image", uploadedSourceId: "33333333-3333-4333-8333-333333333333" },
          { kind: "url", url: "https://example.invalid/acceptance" },
          { kind: "cli_snapshot" },
        ],
        [
          { kind: "image", uploadedSourceId: "33333333-3333-4333-8333-333333333333" },
          { kind: "pasted_code", text: "expect(ready).toBe(true);" },
        ],
      ),
    ).toEqual([
      { kind: "image", uploadedSourceId: "33333333-3333-4333-8333-333333333333" },
      { kind: "url", url: "https://example.invalid/acceptance" },
      { kind: "pasted_code", text: "expect(ready).toBe(true);" },
    ]);
  });
});
