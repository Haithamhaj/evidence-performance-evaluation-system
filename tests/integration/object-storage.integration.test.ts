import { createHash, randomUUID } from "node:crypto";

import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { describe, expect, it } from "vitest";

process.loadEnvFile(".env.local");

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing local integration environment variable: ${name}`);
  return value;
}

describe("private local object storage", () => {
  it("supports checksummed private objects and expiring signed reads", async () => {
    const endpoint = requiredEnvironment("S3_ENDPOINT");
    const client = new S3Client({
      credentials: {
        accessKeyId: requiredEnvironment("MINIO_ROOT_USER"),
        secretAccessKey: requiredEnvironment("MINIO_ROOT_PASSWORD"),
      },
      endpoint,
      forcePathStyle: true,
      region: requiredEnvironment("S3_REGION"),
    });
    const uniqueId = randomUUID();
    const bucket = `evaluation-private-${uniqueId}`;
    const key = `integration/${uniqueId}/evidence.txt`;
    const body = Buffer.from("private local integration evidence", "utf8");
    const expectedChecksum = createHash("sha256").update(body).digest("hex");

    try {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
      await client.send(
        new PutObjectCommand({ Body: body, Bucket: bucket, ContentType: "text/plain", Key: key }),
      );

      const storedObject = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const storedBytes = Buffer.from(await storedObject.Body!.transformToByteArray());
      expect(createHash("sha256").update(storedBytes).digest("hex")).toBe(expectedChecksum);

      const anonymousResponse = await fetch(`${endpoint}/${bucket}/${key}`);
      expect(anonymousResponse.status).toBe(403);

      const signedUrl = await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { expiresIn: 2 },
      );
      const signedResponse = await fetch(signedUrl);
      expect(signedResponse.status).toBe(200);
      expect(Buffer.from(await signedResponse.arrayBuffer())).toEqual(body);

      await new Promise((resolve) => setTimeout(resolve, 3_000));
      const expiredResponse = await fetch(signedUrl);
      expect(expiredResponse.status).toBe(403);
    } finally {
      await client
        .send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
        .catch(() => undefined);
      await client.send(new DeleteBucketCommand({ Bucket: bucket })).catch(() => undefined);
      client.destroy();
    }
  }, 15_000);
});
