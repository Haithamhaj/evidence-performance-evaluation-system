import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { describe, expect, it } from "vitest";

process.loadEnvFile(existsSync(".env.local") ? ".env.local" : ".env.example");

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing local integration environment variable: ${name}`);
  return value;
}

async function waitForSignedUrlDenial(signedUrl: string, timeoutMilliseconds = 8_000) {
  const deadline = Date.now() + timeoutMilliseconds;

  while (Date.now() < deadline) {
    const response = await fetch(signedUrl);
    if (response.status === 403) return;
    if (response.status !== 200) {
      throw new Error(`Signed URL changed to unexpected HTTP ${response.status}.`);
    }
    await response.body?.cancel();
    await delay(100);
  }

  throw new Error(`Signed URL was not denied within ${timeoutMilliseconds}ms.`);
}

async function expectNotFound(operation: Promise<unknown>) {
  await expect(operation).rejects.toMatchObject({ $metadata: { httpStatusCode: 404 } });
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
    let bucketNeedsCleanup = false;
    let objectNeedsCleanup = false;

    try {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
      bucketNeedsCleanup = true;
      await client.send(
        new PutObjectCommand({ Body: body, Bucket: bucket, ContentType: "text/plain", Key: key }),
      );
      objectNeedsCleanup = true;

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

      await waitForSignedUrlDenial(signedUrl);

      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      objectNeedsCleanup = false;
      await expectNotFound(client.send(new GetObjectCommand({ Bucket: bucket, Key: key })));
      await expectNotFound(client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })));

      await client.send(new DeleteBucketCommand({ Bucket: bucket }));
      bucketNeedsCleanup = false;
      await expectNotFound(client.send(new HeadBucketCommand({ Bucket: bucket })));
    } finally {
      if (objectNeedsCleanup) {
        await client
          .send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
          .catch(() => undefined);
      }
      if (bucketNeedsCleanup) {
        await client.send(new DeleteBucketCommand({ Bucket: bucket })).catch(() => undefined);
      }
      client.destroy();
    }
  }, 15_000);
});
