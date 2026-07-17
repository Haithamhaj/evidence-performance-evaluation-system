import { createReadStream } from "node:fs";

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
