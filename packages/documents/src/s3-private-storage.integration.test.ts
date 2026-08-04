import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  CreateBucketCommand,
  DeleteBucketCommand,
  GetObjectAclCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { S3PrivateStorage } from "./s3-private-storage.js";

const endpoint = process.env.S3_ENDPOINT ?? "http://127.0.0.1:9000";
const region = process.env.S3_REGION ?? "us-east-1";
const accessKeyId = process.env.S3_ACCESS_KEY_ID ?? "local-minio";
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY ?? "local-minio-password";
const bucket = `evaluation-private-test-${crypto.randomUUID().slice(0, 12)}`;
const key = `documents/integration/${crypto.randomUUID()}/private.txt`;
const client = new S3Client({
  endpoint,
  region,
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey },
});
const storage = new S3PrivateStorage(client, bucket);
let directory = "";

beforeAll(async () => {
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
  directory = await mkdtemp(path.join(tmpdir(), "s3-private-storage-integration-"));
});

afterAll(async () => {
  const listed = await client.send(new ListObjectsV2Command({ Bucket: bucket }));
  for (const object of listed.Contents ?? []) {
    if (object.Key !== undefined) await storage.delete(object.Key);
  }
  await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  await client.destroy();
  if (directory.length > 0) await rm(directory, { recursive: true, force: true });
});

describe("S3PrivateStorage with MinIO", () => {
  it("keeps PUT private, serves signed GET, and deletes the object cleanly", async () => {
    const contents = "private document fixture";
    const source = path.join(directory, "private.txt");
    await writeFile(source, contents);

    await storage.put({
      key,
      path: source,
      contentType: "text/plain",
      byteSize: Buffer.byteLength(contents),
    });

    const acl = await client.send(new GetObjectAclCommand({ Bucket: bucket, Key: key }));
    expect(acl.Grants ?? []).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          Grantee: expect.objectContaining({
            URI: expect.stringMatching(/AllUsers|AuthenticatedUsers/u),
          }),
        }),
      ]),
    );

    const anonymous = await fetch(`${endpoint}/${bucket}/${key}`);
    expect(anonymous.status).toBe(403);

    const signedUrl = await storage.signGet({ key, expiresInSeconds: 60 });
    const signed = await fetch(signedUrl);
    expect(signed.status).toBe(200);
    await expect(signed.text()).resolves.toBe(contents);

    await storage.delete(key);
    await expect(
      client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })),
    ).rejects.toMatchObject({ $metadata: { httpStatusCode: 404 } });
  });
});
