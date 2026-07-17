import { describe, expect, it } from "vitest";

import { parseDocumentRuntimeConfig } from "./document-config.js";

const valid = {
  DOCUMENT_STORAGE_BUCKET: "evaluation-private-documents",
  DOCUMENT_MAX_TEXT_BYTES: "1000",
  DOCUMENT_MAX_OFFICE_BYTES: "2000",
  DOCUMENT_MAX_IMAGE_BYTES: "3000",
  DOCUMENT_MAX_AUDIO_BYTES: "4000",
  DOCUMENT_MAX_ARCHIVE_ENTRIES: "100",
  DOCUMENT_MAX_ARCHIVE_UNCOMPRESSED_BYTES: "5000",
  DOCUMENT_MAX_ARCHIVE_COMPRESSION_RATIO: "20",
  DOCUMENT_SIGNED_URL_TTL_SECONDS: "60",
  S3_ENDPOINT: "http://127.0.0.1:9000",
  S3_REGION: "us-east-1",
  S3_ACCESS_KEY_ID: "local-access",
  S3_SECRET_ACCESS_KEY: "local-secret",
  CLAMAV_HOST: "127.0.0.1",
  CLAMAV_PORT: "3310",
  CLAMAV_TIMEOUT_MILLISECONDS: "10000",
} as const;

describe("document runtime configuration", () => {
  it("parses every upload ceiling and credential as required configuration", () => {
    expect(parseDocumentRuntimeConfig(valid)).toEqual({
      policy: {
        maxBytesByClass: { text: 1000, office: 2000, image: 3000, audio: 4000 },
        maxArchiveEntries: 100,
        maxArchiveUncompressedBytes: 5000,
        maxArchiveCompressionRatio: 20,
        signedUrlTtlSeconds: 60,
      },
      storage: {
        bucket: "evaluation-private-documents",
        endpoint: "http://127.0.0.1:9000",
        region: "us-east-1",
        accessKeyId: "local-access",
        secretAccessKey: "local-secret",
      },
      scanner: { host: "127.0.0.1", port: 3310, timeoutMilliseconds: 10000 },
    });
  });

  it.each([
    ["DOCUMENT_MAX_TEXT_BYTES", "0"],
    ["DOCUMENT_MAX_AUDIO_BYTES", "1.5"],
    ["DOCUMENT_SIGNED_URL_TTL_SECONDS", ""],
    ["CLAMAV_PORT", "70000"],
    ["S3_SECRET_ACCESS_KEY", ""],
  ])("fails closed for invalid %s", (key, value) => {
    expect(() => parseDocumentRuntimeConfig({ ...valid, [key]: value })).toThrow(
      "Document runtime configuration is invalid",
    );
  });
});
