import { Readable } from "node:stream";

import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants.js";
import { describe, expect, it, vi } from "vitest";

import { DocumentsAuthenticationGuard } from "./documents-authentication.guard.js";
import { UploadsController } from "./uploads.controller.js";

const actorId = "00000000-0000-4000-8000-000000000001";
const projectId = "00000000-0000-4000-8000-000000000002";
const sourceId = "00000000-0000-4000-8000-000000000003";
const correlationId = "00000000-0000-4000-8000-000000000004";

function request(headers: Record<string, string> = {}) {
  return Object.assign(Readable.from([Buffer.from("%PDF-1.7\nsource\n")]), {
    principal: { userId: actorId, active: true },
    correlationId,
    headers: {
      "content-type": "application/pdf",
      "x-document-kind": "project",
      "x-document-resource-id": projectId,
      "x-document-filename": "report.pdf",
      "x-document-reason": "Approved source",
      ...headers,
    },
  });
}

describe("UploadsController", () => {
  it("passes the untouched request stream and strict header metadata to the service", async () => {
    const uploads = {
      stage: vi.fn(async () => ({ id: sourceId })),
      signRead: vi.fn(),
    };
    const controller = new UploadsController(uploads as never);
    const stream = request();
    await expect(controller.upload(stream as never)).resolves.toEqual({ id: sourceId });
    expect(uploads.stage).toHaveBeenCalledWith(
      {
        actor: { userId: actorId, active: true },
        correlationId,
        metadata: {
          kind: "project",
          resourceId: projectId,
          filename: "report.pdf",
          declaredMime: "application/pdf",
          reason: "Approved source",
        },
      },
      stream,
    );
  });

  it("rejects malformed or extra upload header values before invoking storage", async () => {
    const uploads = { stage: vi.fn(), signRead: vi.fn() };
    const controller = new UploadsController(uploads as never);
    expect(() =>
      controller.upload(request({ "x-document-kind": "department" }) as never),
    ).toThrowError("DOCUMENT_INPUT_INVALID");
    expect(uploads.stage).not.toHaveBeenCalled();
  });

  it("delegates signed reads with the current authenticated actor", async () => {
    const uploads = {
      stage: vi.fn(),
      signRead: vi.fn(async () => ({
        url: "http://127.0.0.1/signed",
        expiresAt: "2026-07-17T12:01:00.000Z",
      })),
    };
    const controller = new UploadsController(uploads as never);
    const stream = request();
    await controller.signRead(stream as never, sourceId);
    expect(uploads.signRead).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true },
      correlationId,
      uploadedSourceId: sourceId,
    });
  });

  it("exposes only authenticated versioned upload and signed-read routes", () => {
    expect(Reflect.getMetadata(PATH_METADATA, UploadsController)).toBe("api/v1/documents/uploads");
    expect(Reflect.getMetadata(GUARDS_METADATA, UploadsController)).toContain(
      DocumentsAuthenticationGuard,
    );
    expect(Reflect.getMetadata(METHOD_METADATA, UploadsController.prototype.upload)).toBe(1);
    expect(Reflect.getMetadata(PATH_METADATA, UploadsController.prototype.signRead)).toBe(
      ":uploadedSourceId/signed-read",
    );
  });
});
