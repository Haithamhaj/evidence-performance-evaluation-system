/* eslint-disable no-unused-vars */
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type ReportObjectStorage = import("@evaluation/reporting").ReportObjectStorage;

export class S3ReportStorage implements ReportObjectStorage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {
    if (!bucket) throw new Error("DOCUMENT_STORAGE_BUCKET is required for report storage");
  }

  async put(
    input: Readonly<{ key: string; content: Buffer; contentType: string; encrypted: true }>,
  ) {
    if (!input.key.startsWith("reports/") || input.key.includes("..")) {
      throw new Error("Invalid report object key");
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.content,
        ContentLength: input.content.byteLength,
        ContentType: input.contentType,
        ServerSideEncryption: "AES256",
      }),
    );
  }

  signGet(input: Readonly<{ key: string; expiresInSeconds: number }>) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: input.key }),
      { expiresIn: input.expiresInSeconds },
    );
  }
}
