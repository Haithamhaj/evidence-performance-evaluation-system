import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { TextDecoder } from "node:util";

import { extractValidatedDocxText } from "./file-inspection.js";

type Input = Readonly<{
  policy: Readonly<{
    maxSourceBytes: number;
    maxArchiveEntries: number;
    maxArchiveUncompressedBytes: number;
    maxArchiveCompressionRatio: number;
  }>;
  sources: readonly import("./analysis-model.js").CanonicalSource[];
}>;

export async function extractSafeSources(
  input: Input,
): Promise<import("./analysis-model.js").ExtractionBundle> {
  const sources = await Promise.all(
    input.sources.map((source) => extractOne(source, input.policy)),
  );
  const coverage = sources.every((source) => source.coverage === "complete")
    ? "complete"
    : sources.some((source) => source.coverage === "failed")
      ? "failed"
      : "unsupported";
  return { coverage, sources };
}

async function extractOne(
  source: import("./analysis-model.js").CanonicalSource,
  policy: Input["policy"],
): Promise<import("./analysis-model.js").ExtractedSource> {
  if (source.sourceType !== "upload") {
    return {
      reference: source.reference,
      mediaType: source.mediaType,
      coverage: "unsupported",
      reason: "not_fetched",
    };
  }
  if (!isText(source.mediaType) && !isDocx(source.mediaType)) {
    return {
      reference: source.reference,
      mediaType: source.mediaType,
      coverage: "unsupported",
      reason: "unsupported_safe_extraction",
    };
  }
  try {
    if (source.openStream === undefined) throw new Error("missing stream");
    const bytes = await readBounded(await source.openStream(), policy.maxSourceBytes);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (source.expectedSha256 !== undefined && source.expectedSha256 !== sha256)
      throw new Error("source digest mismatch");
    let content: Buffer;
    if (isText(source.mediaType)) {
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      content = Buffer.from(decoded, "utf8");
    } else {
      const directory = await mkdtemp(path.join(tmpdir(), "document-analysis-docx-"));
      const target = path.join(directory, "source.docx");
      try {
        await writeFile(target, bytes);
        const text = await extractValidatedDocxText(target, {
          maxBytesByClass: {
            text: policy.maxSourceBytes,
            office: policy.maxSourceBytes,
            image: policy.maxSourceBytes,
            audio: policy.maxSourceBytes,
          },
          maxArchiveEntries: policy.maxArchiveEntries,
          maxArchiveUncompressedBytes: policy.maxArchiveUncompressedBytes,
          maxArchiveCompressionRatio: policy.maxArchiveCompressionRatio,
          signedUrlTtlSeconds: 1,
        });
        content = Buffer.from(text, "utf8");
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
    return {
      reference: source.reference,
      mediaType: source.mediaType,
      coverage: "complete",
      sha256,
      contentBase64: content.toString("base64"),
    };
  } catch {
    return {
      reference: source.reference,
      mediaType: source.mediaType,
      coverage: "failed",
      reason: "failed",
    };
  }
}

async function readBounded(stream: NodeJS.ReadableStream, limit: number): Promise<Buffer> {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("invalid extraction limit");
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const raw of stream) {
    const chunk =
      typeof raw === "string"
        ? Buffer.from(raw)
        : Buffer.isBuffer(raw)
          ? raw
          : Buffer.from(raw as Uint8Array);
    total += chunk.length;
    if (total > limit) throw new Error("source too large");
    chunks.push(chunk);
  }
  if (total < 1) throw new Error("empty source");
  return Buffer.concat(chunks, total);
}

function isText(mediaType: string) {
  return mediaType === "text/plain" || mediaType === "text/markdown";
}
function isDocx(mediaType: string) {
  return mediaType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}
