export type DocumentRuntimeConfig = Readonly<{
  policy: import("./model.js").UploadPolicy;
  storage: Readonly<{
    bucket: string;
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  }>;
  scanner: Readonly<{ host: string; port: number; timeoutMilliseconds: number }>;
}>;

export function parseDocumentRuntimeConfig(
  environment: Readonly<Record<string, string | undefined>>,
): DocumentRuntimeConfig {
  try {
    const endpoint = required(environment, "S3_ENDPOINT");
    const parsedEndpoint = new URL(endpoint);
    if (!["http:", "https:"].includes(parsedEndpoint.protocol)) throw new Error("protocol");
    const port = positiveInteger(environment, "CLAMAV_PORT");
    if (port > 65_535) throw new Error("port");
    return {
      policy: {
        maxBytesByClass: {
          text: positiveInteger(environment, "DOCUMENT_MAX_TEXT_BYTES"),
          office: positiveInteger(environment, "DOCUMENT_MAX_OFFICE_BYTES"),
          image: positiveInteger(environment, "DOCUMENT_MAX_IMAGE_BYTES"),
          audio: positiveInteger(environment, "DOCUMENT_MAX_AUDIO_BYTES"),
        },
        maxArchiveEntries: positiveInteger(environment, "DOCUMENT_MAX_ARCHIVE_ENTRIES"),
        maxArchiveUncompressedBytes: positiveInteger(
          environment,
          "DOCUMENT_MAX_ARCHIVE_UNCOMPRESSED_BYTES",
        ),
        maxArchiveCompressionRatio: positiveInteger(
          environment,
          "DOCUMENT_MAX_ARCHIVE_COMPRESSION_RATIO",
        ),
        signedUrlTtlSeconds: positiveInteger(environment, "DOCUMENT_SIGNED_URL_TTL_SECONDS"),
      },
      storage: {
        bucket: required(environment, "DOCUMENT_STORAGE_BUCKET"),
        endpoint,
        region: required(environment, "S3_REGION"),
        accessKeyId: required(environment, "S3_ACCESS_KEY_ID"),
        secretAccessKey: required(environment, "S3_SECRET_ACCESS_KEY"),
      },
      scanner: {
        host: required(environment, "CLAMAV_HOST"),
        port,
        timeoutMilliseconds: positiveInteger(environment, "CLAMAV_TIMEOUT_MILLISECONDS"),
      },
    };
  } catch {
    throw new Error("Document runtime configuration is invalid");
  }
}

function required(environment: Readonly<Record<string, string | undefined>>, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(name);
  return value;
}

function positiveInteger(
  environment: Readonly<Record<string, string | undefined>>,
  name: string,
): number {
  const value = Number(required(environment, name));
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(name);
  return value;
}
