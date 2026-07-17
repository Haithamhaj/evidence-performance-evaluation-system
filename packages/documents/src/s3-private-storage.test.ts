import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";

import { S3PrivateStorage } from "./s3-private-storage.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

async function source() {
  const directory = await mkdtemp(path.join(tmpdir(), "s3-private-storage-"));
  directories.push(directory);
  const file = path.join(directory, "source.pdf");
  await writeFile(file, "%PDF-1.7\n");
  return file;
}

describe("S3PrivateStorage", () => {
  it("puts a private object without a public ACL", async () => {
    const commands: unknown[] = [];
    const send = vi.fn(async (command: unknown) => {
      commands.push(command);
      return {};
    });
    const storage = new S3PrivateStorage({ send } as never, "private-documents", vi.fn());
    await storage.put({
      key: "documents/org/project/id/object",
      path: await source(),
      contentType: "application/pdf",
      byteSize: 9,
    });
    const command = commands[0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: "private-documents",
      Key: "documents/org/project/id/object",
      ContentType: "application/pdf",
      ContentLength: 9,
    });
    expect(command.input).not.toHaveProperty("ACL");
  });

  it("signs only GET with the caller-provided bounded expiry", async () => {
    const signer = vi.fn(async () => "https://signed.example.invalid/object?redacted");
    const client = { send: vi.fn() };
    const storage = new S3PrivateStorage(client as never, "private-documents", signer as never);
    await expect(
      storage.signGet({ key: "documents/org/project/id/object", expiresInSeconds: 60 }),
    ).resolves.toBe("https://signed.example.invalid/object?redacted");
    expect(signer).toHaveBeenCalledWith(client, expect.any(GetObjectCommand), { expiresIn: 60 });
  });

  it("deletes by opaque object key", async () => {
    const commands: unknown[] = [];
    const send = vi.fn(async (command: unknown) => {
      commands.push(command);
      return {};
    });
    const storage = new S3PrivateStorage({ send } as never, "private-documents", vi.fn());
    await storage.delete("documents/org/project/id/object");
    expect(commands[0]).toBeInstanceOf(DeleteObjectCommand);
  });

  it("rejects invalid bucket, object key, and expiry before contacting S3", async () => {
    expect(() => new S3PrivateStorage({ send: vi.fn() } as never, "", vi.fn())).toThrow();
    const send = vi.fn();
    const storage = new S3PrivateStorage({ send } as never, "private-documents", vi.fn());
    await expect(storage.delete("/public/path")).rejects.toThrow();
    await expect(
      storage.signGet({ key: "documents/private", expiresInSeconds: 0 }),
    ).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
});
