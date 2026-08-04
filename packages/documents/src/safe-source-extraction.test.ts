import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";

import { extractSafeSources } from "./safe-source-extraction.js";

const policy = {
  maxSourceBytes: 1_024,
  maxArchiveEntries: 20,
  maxArchiveUncompressedBytes: 4_096,
  maxArchiveCompressionRatio: 50,
} as const;

describe("safe analysis extraction", () => {
  it("streams valid UTF-8 and retains its original opaque reference and digest", async () => {
    const result = await extractSafeSources({
      policy,
      sources: [
        {
          reference: `document-source:${crypto.randomUUID()}`,
          sourceType: "upload",
          mediaType: "text/markdown",
          openStream: async () => Readable.from(["# Scope\nSafe"]),
        },
      ],
    });
    expect(result.coverage).toBe("complete");
    expect(result.sources[0]).toMatchObject({
      coverage: "complete",
      mediaType: "text/markdown",
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(Buffer.from(result.sources[0]!.contentBase64!, "base64").toString()).toContain(
      "# Scope",
    );
  });

  it.each([
    ["application/pdf", "unsupported_safe_extraction"],
    ["image/png", "unsupported_safe_extraction"],
    ["audio/mpeg", "unsupported_safe_extraction"],
  ])("fails readiness coverage closed for %s", async (mediaType, reason) => {
    const result = await extractSafeSources({
      policy,
      sources: [
        {
          reference: `document-source:${crypto.randomUUID()}`,
          sourceType: "upload",
          mediaType,
          openStream: async () => {
            throw new Error("unsupported sources must not be opened");
          },
        },
      ],
    });
    expect(result).toMatchObject({
      coverage: "unsupported",
      sources: [{ coverage: "unsupported", reason }],
    });
  });

  it("never fetches external or GitHub sources", async () => {
    const result = await extractSafeSources({
      policy,
      sources: [
        {
          reference: `document-source:${crypto.randomUUID()}`,
          sourceType: "external_link",
          mediaType: "text/uri-list",
        },
        {
          reference: `document-source:${crypto.randomUUID()}`,
          sourceType: "github",
          mediaType: "application/vnd.github+json",
        },
      ],
    });
    expect(result.sources.map(({ reason }) => reason)).toEqual(["not_fetched", "not_fetched"]);
    expect(result.coverage).toBe("unsupported");
  });

  it("marks malformed or over-limit text failed", async () => {
    const result = await extractSafeSources({
      policy: { ...policy, maxSourceBytes: 2 },
      sources: [
        {
          reference: `document-source:${crypto.randomUUID()}`,
          sourceType: "upload",
          mediaType: "text/plain",
          openStream: async () => Readable.from([Buffer.from([0xc3, 0x28, 0x61])]),
        },
      ],
    });
    expect(result).toMatchObject({ coverage: "failed", sources: [{ coverage: "failed" }] });
  });
});
