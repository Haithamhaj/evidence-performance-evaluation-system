import { createReadStream } from "node:fs";
import { Readable, Transform } from "node:stream";

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type Signer = (
  client: import("@aws-sdk/client-s3").S3Client,
  command: GetObjectCommand,
  options: Readonly<{ expiresIn: number }>,
) => Promise<string>;
type StoragePort = import("./model.js").PrivateObjectStorage;

export class S3PrivateStorage implements StoragePort {
  private readonly client: import("@aws-sdk/client-s3").S3Client;
  private readonly bucket: string;
  private readonly signer: Signer;

  constructor(
    client: import("@aws-sdk/client-s3").S3Client,
    bucket: string,
    signer: Signer = getSignedUrl,
  ) {
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u.test(bucket)) {
      throw new Error("Document storage bucket is invalid");
    }
    this.client = client;
    this.bucket = bucket;
    this.signer = signer;
  }

  async put(
    input: Readonly<{
      key: string;
      path: string;
      contentType: string;
      byteSize: number;
    }>,
  ): Promise<void> {
    assertKey(input.key);
    if (
      input.contentType.trim().length === 0 ||
      !Number.isSafeInteger(input.byteSize) ||
      input.byteSize < 1
    ) {
      throw new Error("Private object metadata is invalid");
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: createReadStream(input.path),
        ContentType: input.contentType,
        ContentLength: input.byteSize,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    assertKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async signGet(input: Readonly<{ key: string; expiresInSeconds: number }>): Promise<string> {
    assertKey(input.key);
    if (!Number.isSafeInteger(input.expiresInSeconds) || input.expiresInSeconds < 1) {
      throw new Error("Signed URL expiry is invalid");
    }
    return this.signer(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: input.key }), {
      expiresIn: input.expiresInSeconds,
    });
  }

  async readStream(input: Readonly<{ key: string; maxBytes: number }>): Promise<Readable> {
    assertKey(input.key);
    if (!Number.isSafeInteger(input.maxBytes) || input.maxBytes < 1) {
      throw new Error("Private object read limit is invalid");
    }
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: input.key }),
    );
    if (
      result.ContentLength !== undefined &&
      (!Number.isSafeInteger(result.ContentLength) || result.ContentLength > input.maxBytes)
    ) {
      result.Body?.transformToWebStream().cancel().catch(() => undefined);
      throw new Error("Private object exceeds read limit");
    }
    if (!(result.Body instanceof Readable)) throw new Error("Private object stream is unavailable");
    let total = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        total += chunk.length;
        if (total > input.maxBytes) {
          callback(new Error("Private object exceeds read limit"));
          return;
        }
        callback(null, chunk);
      },
    });
    return result.Body.pipe(limiter);
  }
}

function assertKey(key: string): void {
  if (
    !key.startsWith("documents/") ||
    key.startsWith("documents//") ||
    key.includes("..") ||
    key.includes("\\") ||
    key.length > 1_024
  ) {
    throw new Error("Private object key is invalid");
  }
}
