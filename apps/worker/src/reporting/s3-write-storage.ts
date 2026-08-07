import { PutObjectCommand } from "@aws-sdk/client-s3";

export class S3ReportWriteStorage {
  private readonly client: import("@aws-sdk/client-s3").S3Client;
  private readonly bucket: string;

  constructor(client: import("@aws-sdk/client-s3").S3Client, bucket: string) {
    this.client = client;
    this.bucket = bucket;
    if (!bucket.trim()) throw new Error("DOCUMENT_STORAGE_BUCKET is required");
  }

  async put(
    input: Readonly<{ key: string; content: Buffer; contentType: string; encrypted: true }>,
  ) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.content,
        ContentType: input.contentType,
        ServerSideEncryption: "AES256",
      }),
    );
  }

  async signGet(): Promise<string> {
    throw new Error("Signed reads are API-only after current authorization");
  }
}
