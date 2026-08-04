import { Readable } from "node:stream";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UploadService } from "./upload-service.js";

const roots: string[] = [];
const actorId = "00000000-0000-4000-8000-000000000001";
const organizationId = "00000000-0000-4000-8000-000000000002";
const departmentId = "00000000-0000-4000-8000-000000000003";
const projectId = "00000000-0000-4000-8000-000000000004";
const scopeId = "00000000-0000-4000-8000-000000000005";

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function harness(
  options: Readonly<{
    databaseFailure?: boolean;
    infected?: boolean;
    wrongScope?: boolean;
  }> = {},
) {
  const events: string[] = [];
  const root = await mkdtemp(path.join(tmpdir(), "upload-service-test-"));
  roots.push(root);
  const uploaded = {
    id: "00000000-0000-4000-8000-000000000006",
    projectId,
    workstreamId: null,
    organizationId,
    departmentId,
    originalFilename: "report.pdf",
    objectKey: `documents/${organizationId}/project/${projectId}/source`,
    detectedMime: "application/pdf",
    detectedType: "pdf",
    byteSize: 20,
    sha256: "a".repeat(64),
    createdAt: new Date("2026-07-17T12:00:00Z"),
  };
  const database = {
    user: { findUnique: vi.fn(async () => ({ active: true })) },
    roleAssignment: {
      findMany: vi.fn(async () => [
        {
          role: "manager",
          scopeType: "department",
          scopeId: options.wrongScope ? "00000000-0000-4000-8000-000000000099" : scopeId,
        },
      ]),
    },
    authorizationScope: { findFirst: vi.fn(async () => ({ id: scopeId })) },
    responsibilityWindow: { findMany: vi.fn(async () => []) },
    uploadedSource: {
      findUnique: vi.fn(async () => uploaded),
      create: vi.fn(async () => {
        events.push("metadata");
        if (options.databaseFailure) throw new Error("database unavailable");
        return uploaded;
      }),
    },
    $transaction: vi.fn(async (operation: (transaction: unknown) => Promise<unknown>) =>
      operation(database),
    ),
  };
  const storage = {
    put: vi.fn(async () => {
      events.push("storage");
    }),
    delete: vi.fn(async () => {
      events.push("delete");
    }),
    signGet: vi.fn(async () => "http://127.0.0.1/private-signed-read"),
    readStream: vi.fn(async () => Readable.from([])),
  };
  const scanner = {
    scan: vi.fn(async () => {
      events.push("scan");
      if (options.infected)
        throw Object.assign(new Error("infected"), { code: "UPLOAD_SAFETY_REJECTED" });
      return "clean" as const;
    }),
  };
  const audit = {
    append: vi.fn(async () => ({ id: crypto.randomUUID(), createdAt: new Date().toISOString() })),
  };
  const reader = {
    read: vi.fn(async () => ({
      kind: "project" as const,
      resourceId: projectId,
      projectId,
      organizationId,
      departmentId,
      status: "active" as const,
    })),
  };
  const service = new UploadService(
    database as never,
    reader,
    storage,
    scanner,
    {
      maxBytesByClass: { text: 32, office: 64, image: 64, audio: 64 },
      maxArchiveEntries: 10,
      maxArchiveUncompressedBytes: 1_000,
      maxArchiveCompressionRatio: 20,
      signedUrlTtlSeconds: 60,
    },
    audit as never,
    {
      temporaryRoot: root,
      randomId: () => "00000000-0000-4000-8000-000000000007",
      now: () => new Date("2026-07-17T12:00:00Z"),
    },
  );
  return { audit, database, events, root, scanner, service, storage };
}

const command = {
  actor: { userId: actorId, active: true },
  correlationId: "00000000-0000-4000-8000-000000000008",
  metadata: {
    kind: "project",
    resourceId: projectId,
    filename: "report.pdf",
    declaredMime: "application/pdf",
    reason: "Approved source",
  },
} as const;

describe("UploadService", () => {
  it("streams validation, scan, private storage, metadata, and audit in order", async () => {
    const test = await harness();
    const result = await test.service.stage(
      command,
      Readable.from([Buffer.from("%PDF-1.7\nprivate\n")]),
    );
    expect(result).toMatchObject({
      id: expect.any(String),
      detectedType: "pdf",
      filename: "report.pdf",
    });
    expect(test.events).toEqual(["scan", "storage", "metadata"]);
    expect(test.audit.append).toHaveBeenCalledOnce();
    expect(await readdir(test.root)).toEqual([]);
  });

  it("rejects an oversize stream before scan or storage", async () => {
    const test = await harness();
    await expect(
      test.service.stage(command, Readable.from([Buffer.alloc(65, 65)])),
    ).rejects.toMatchObject({
      code: "UPLOAD_SIZE_REJECTED",
    });
    expect(test.scanner.scan).not.toHaveBeenCalled();
    expect(test.storage.put).not.toHaveBeenCalled();
    expect(await readdir(test.root)).toEqual([]);
  });

  it("fails closed on malware and leaves no object or temp file", async () => {
    const test = await harness({ infected: true });
    await expect(
      test.service.stage(command, Readable.from([Buffer.from("%PDF-1.7\nprivate\n")])),
    ).rejects.toMatchObject({ code: "UPLOAD_SAFETY_REJECTED" });
    expect(test.storage.put).not.toHaveBeenCalled();
    expect(await readdir(test.root)).toEqual([]);
  });

  it("deletes the private object when metadata persistence fails", async () => {
    const test = await harness({ databaseFailure: true });
    await expect(
      test.service.stage(command, Readable.from([Buffer.from("%PDF-1.7\nprivate\n")])),
    ).rejects.toThrow("database unavailable");
    expect(test.storage.delete).toHaveBeenCalledWith(
      `documents/${organizationId}/project/${projectId}/00000000-0000-4000-8000-000000000007`,
    );
    expect(test.events).toEqual(["scan", "storage", "metadata", "delete"]);
    expect(await readdir(test.root)).toEqual([]);
  });

  it("reauthorizes each signed read and returns a bounded URL without exposing the object key", async () => {
    const test = await harness();
    const result = await test.service.signRead({
      actor: command.actor,
      correlationId: command.correlationId,
      uploadedSourceId: "00000000-0000-4000-8000-000000000006",
    });
    expect(result).toEqual({
      url: "http://127.0.0.1/private-signed-read",
      expiresAt: "2026-07-17T12:01:00.000Z",
    });
    expect(test.storage.signGet).toHaveBeenCalledWith({
      key: `documents/${organizationId}/project/${projectId}/source`,
      expiresInSeconds: 60,
    });
    expect(test.audit.append).toHaveBeenCalledWith(
      test.database,
      expect.objectContaining({
        eventType: "document.upload_read_signed",
        targetId: "00000000-0000-4000-8000-000000000006",
      }),
    );
    expect(JSON.stringify(result)).not.toContain("objectKey");
  });

  it("denies a signed read outside the actor department before generating a URL", async () => {
    const test = await harness({ wrongScope: true });
    await expect(
      test.service.signRead({
        actor: command.actor,
        correlationId: command.correlationId,
        uploadedSourceId: "00000000-0000-4000-8000-000000000006",
      }),
    ).rejects.toMatchObject({ code: "AUTHZ_SCOPE_MISMATCH" });
    expect(test.storage.signGet).not.toHaveBeenCalled();
  });
});
