import { Readable } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import { PrivateCaptureUploadService } from "./private-capture-upload-service.js";

const ownerId = "00000000-0000-4000-8000-000000000001";
const uploadId = "00000000-0000-4000-8000-000000000002";

function database(
  upload: Readonly<{ id: string; ownerId: string; objectKey: string }> | null = {
    id: uploadId,
    ownerId,
    objectKey: "private/capture",
  },
) {
  return {
    $transaction: async (callback: (transaction: unknown) => Promise<unknown>) =>
      callback({
        privateCaptureUpload: {
          create: vi.fn(async () => ({
            id: uploadId,
            ownerId,
            originalFilename: "notes.pdf",
            detectedType: "pdf",
            detectedMime: "application/pdf",
            byteSize: 17,
            sha256: "a".repeat(64),
            createdAt: new Date("2026-08-12T08:00:00.000Z"),
          })),
        },
      }),
    privateCaptureUpload: {
      findUnique: vi.fn(async () => upload),
    },
  };
}

describe("PrivateCaptureUploadService", () => {
  it("stages an owner-private file through inspection, malware scan, and private storage", async () => {
    const storage = { put: vi.fn(), delete: vi.fn(), signGet: vi.fn() };
    const scanner = { scan: vi.fn(async () => "clean" as const) };
    const service = new PrivateCaptureUploadService(
      database() as never,
      storage as never,
      scanner as never,
      { ...policy(), signedUrlTtlSeconds: 60 },
      audit(),
      { temporaryRoot: "/tmp", randomId: () => uploadId },
    );

    await expect(
      service.stage(
        {
          actor: { userId: ownerId, active: true, roles: ["employee"] },
          correlationId: "00000000-0000-4000-8000-000000000003",
          metadata: { filename: "notes.pdf", declaredMime: "application/pdf" },
        },
        Readable.from([Buffer.from("%PDF-1.7\nprivate")]),
      ),
    ).resolves.toMatchObject({ id: uploadId, filename: "notes.pdf" });

    expect(scanner.scan).toHaveBeenCalledTimes(1);
    expect(storage.put).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: "application/pdf",
        key: expect.stringContaining(ownerId),
      }),
    );
  });

  it("denies a different user before issuing a signed private read", async () => {
    const storage = { put: vi.fn(), delete: vi.fn(), signGet: vi.fn() };
    const service = new PrivateCaptureUploadService(
      database() as never,
      storage as never,
      { scan: vi.fn() } as never,
      policy(),
      audit(),
    );

    await expect(
      service.signRead({
        actor: {
          userId: "00000000-0000-4000-8000-000000000004",
          active: true,
          roles: ["employee"],
        },
        correlationId: "00000000-0000-4000-8000-000000000005",
        privateCaptureUploadId: uploadId,
      }),
    ).rejects.toMatchObject({ code: "PRIVATE_CAPTURE_FORBIDDEN" });
    expect(storage.signGet).not.toHaveBeenCalled();
  });

  it.each([
    [
      "wrong owner",
      {
        id: uploadId,
        ownerId: "00000000-0000-4000-8000-000000000004",
        objectKey: "private/capture",
      },
    ],
    ["missing upload", null],
  ] as const)("denies ownership validation for a %s", async (_label, upload) => {
    const service = new PrivateCaptureUploadService(
      database(upload) as never,
      { put: vi.fn(), delete: vi.fn(), signGet: vi.fn() } as never,
      { scan: vi.fn() } as never,
      policy(),
      audit(),
    );

    await expect(
      service.assertOwned({
        actor: { userId: ownerId, active: true, roles: ["employee"] },
        privateCaptureUploadId: uploadId,
      }),
    ).rejects.toMatchObject({ code: "PRIVATE_CAPTURE_FORBIDDEN" });
  });

  it.each([["manager"], ["system_administrator"]])(
    "denies %s-only principals before staging or signing",
    async (role) => {
      const storage = { put: vi.fn(), delete: vi.fn(), signGet: vi.fn() };
      const service = new PrivateCaptureUploadService(
        database() as never,
        storage as never,
        { scan: vi.fn() } as never,
        policy(),
        audit(),
      );
      await expect(
        service.stage(
          {
            actor: { userId: ownerId, active: true, roles: [role] },
            correlationId: "00000000-0000-4000-8000-000000000003",
            metadata: { filename: "notes.pdf", declaredMime: "application/pdf" },
          },
          Readable.from([Buffer.from("%PDF-1.7\nprivate")]),
        ),
      ).rejects.toMatchObject({ code: "PRIVATE_CAPTURE_FORBIDDEN" });
      await expect(
        service.signRead({
          actor: { userId: ownerId, active: true, roles: [role] },
          correlationId: "00000000-0000-4000-8000-000000000003",
          privateCaptureUploadId: uploadId,
        }),
      ).rejects.toMatchObject({ code: "PRIVATE_CAPTURE_FORBIDDEN" });
      expect(storage.put).not.toHaveBeenCalled();
      expect(storage.signGet).not.toHaveBeenCalled();
    },
  );
});

function policy() {
  return {
    maxBytesByClass: { text: 1024, office: 1024 * 1024, image: 1024 * 1024, audio: 1024 },
    maxArchiveEntries: 100,
    maxArchiveUncompressedBytes: 1024 * 1024,
    maxArchiveCompressionRatio: 100,
    signedUrlTtlSeconds: 60,
  } as const;
}

function audit() {
  return {
    append: vi.fn(async () => ({ id: crypto.randomUUID(), createdAt: new Date().toISOString() })),
  };
}
