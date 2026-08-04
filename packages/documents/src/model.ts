import type { Readable } from "node:stream";

export type DocumentDatabase = import("@evaluation/database").DatabaseClient;
export type DocumentTransaction = import("@evaluation/database").DatabaseTransaction;
export type DocumentAuditWriter = import("@evaluation/contracts").AuditWriter<DocumentTransaction>;
export type DocumentResourceIdentity = import("@evaluation/projects").DocumentResourceIdentity;
export type DocumentResourceIdentityReader =
  import("@evaluation/projects").DocumentResourceIdentityReader;

export type DocumentClock = () => Date;

export interface PrivateObjectStorage {
  put(
    input: Readonly<{
      key: string;
      path: string;
      contentType: string;
      byteSize: number;
    }>,
  ): Promise<void>;
  delete(key: string): Promise<void>;
  signGet(input: Readonly<{ key: string; expiresInSeconds: number }>): Promise<string>;
  readStream(input: Readonly<{ key: string; maxBytes: number }>): Promise<Readable>;
}

export interface MalwareScanner {
  scan(path: string): Promise<"clean">;
}

export type UploadMediaClass = "text" | "office" | "image" | "audio";

export type UploadPolicy = Readonly<{
  maxBytesByClass: Readonly<Record<UploadMediaClass, number>>;
  maxArchiveEntries: number;
  maxArchiveUncompressedBytes: number;
  maxArchiveCompressionRatio: number;
  signedUrlTtlSeconds: number;
}>;
