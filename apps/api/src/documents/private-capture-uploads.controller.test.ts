import { Readable } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import { PrivateCaptureUploadsController } from "./private-capture-uploads.controller.js";

const ownerId = "00000000-0000-4000-8000-000000000001";
const uploadId = "00000000-0000-4000-8000-000000000002";

function request(headers: Record<string, string> = {}) {
  return Object.assign(Readable.from([Buffer.from("%PDF-1.7\nprivate")]), {
    principal: { userId: ownerId, active: true },
    correlationId: "00000000-0000-4000-8000-000000000003",
    headers: { "content-type": "application/pdf", "x-capture-filename": "private.pdf", ...headers },
  });
}

describe("PrivateCaptureUploadsController", () => {
  it("derives the owner from the authenticated principal without accepting an object key", async () => {
    const uploads = { stage: vi.fn(async () => ({ id: uploadId })), signRead: vi.fn() };
    const controller = new PrivateCaptureUploadsController(uploads as never);
    const stream = request();

    await controller.upload(stream as never);

    expect(uploads.stage).toHaveBeenCalledWith(
      {
        actor: { userId: ownerId, active: true },
        correlationId: "00000000-0000-4000-8000-000000000003",
        metadata: { filename: "private.pdf", declaredMime: "application/pdf" },
      },
      stream,
    );
    expect(() =>
      controller.upload(request({ "x-capture-object-key": "forbidden" }) as never),
    ).toThrow();
  });

  it("uses the current principal for signed reads", async () => {
    const uploads = {
      stage: vi.fn(),
      signRead: vi.fn(async () => ({ url: "signed", expiresAt: "2026-08-12T08:01:00.000Z" })),
    };
    const controller = new PrivateCaptureUploadsController(uploads as never);

    await controller.signRead(request() as never, uploadId);

    expect(uploads.signRead).toHaveBeenCalledWith({
      actor: { userId: ownerId, active: true },
      correlationId: "00000000-0000-4000-8000-000000000003",
      privateCaptureUploadId: uploadId,
    });
  });
});
