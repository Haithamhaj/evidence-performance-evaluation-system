import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants.js";
import { describe, expect, it, vi } from "vitest";

import { DocumentsAuthenticationGuard } from "./documents-authentication.guard.js";
import { DocumentsController } from "./documents.controller.js";

const actorId = "00000000-0000-4000-8000-000000000001";
const correlationId = "00000000-0000-4000-8000-000000000002";
const projectId = "00000000-0000-4000-8000-000000000003";
const documentId = "00000000-0000-4000-8000-000000000004";
const uploadedSourceId = "00000000-0000-4000-8000-000000000005";

const request = {
  principal: {
    userId: actorId,
    oidcSubject: "employee",
    email: "employee@example.invalid",
    roles: ["employee"],
    active: true,
  },
  correlationId,
} as const;

function createInput() {
  return {
    kind: "project",
    resourceId: projectId,
    expectedVersion: 0,
    sources: [{ sourceType: "upload", uploadedSourceId }],
    reason: "Initial governed document",
  } as const;
}

function appendInput() {
  return {
    expectedVersion: 1,
    sources: [{ sourceType: "external_link", url: "https://example.invalid/source" }],
    reason: "Approved document update",
  } as const;
}

describe("DocumentsController", () => {
  it("passes strict create and append commands to DocumentService", async () => {
    const service = {
      create: vi.fn(async (value: unknown) => value),
      get: vi.fn(),
      appendVersion: vi.fn(async (value: unknown) => value),
    };
    const controller = new DocumentsController(service as never);

    await controller.create(request, createInput());
    expect(service.create).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true },
      correlationId,
      input: createInput(),
    });

    await controller.appendVersion(request, documentId, appendInput());
    expect(service.appendVersion).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true },
      correlationId,
      documentId,
      input: appendInput(),
    });

    expect(() => controller.create(request, { ...createInput(), unknown: true })).toThrowError(
      expect.objectContaining({ code: "DOCUMENT_INPUT_INVALID" }),
    );
    expect(() =>
      controller.appendVersion(request, documentId, { ...appendInput(), unknown: true }),
    ).toThrowError(expect.objectContaining({ code: "DOCUMENT_INPUT_INVALID" }));
    expect(service.create).toHaveBeenCalledTimes(1);
    expect(service.appendVersion).toHaveBeenCalledTimes(1);
  });

  it("validates the document identifier and delegates read authorization to the service", async () => {
    const service = {
      create: vi.fn(),
      get: vi.fn(async (value: unknown) => value),
      appendVersion: vi.fn(),
    };
    const controller = new DocumentsController(service as never);

    await controller.get(request, documentId);
    expect(service.get).toHaveBeenCalledWith({
      actor: { userId: actorId, active: true },
      correlationId,
      documentId,
    });
    expect(() => controller.get(request, "not-a-uuid")).toThrowError(
      expect.objectContaining({ code: "DOCUMENT_INPUT_INVALID" }),
    );
    expect(service.get).toHaveBeenCalledTimes(1);
  });

  it("declares only the authenticated document REST surface", () => {
    expect(Reflect.getMetadata(PATH_METADATA, DocumentsController)).toBe("api/v1/documents");
    expect(Reflect.getMetadata(GUARDS_METADATA, DocumentsController)).toEqual([
      DocumentsAuthenticationGuard,
    ]);
    expect(Reflect.getMetadata(METHOD_METADATA, DocumentsController.prototype.create)).toBe(1);
    expect(Reflect.getMetadata(PATH_METADATA, DocumentsController.prototype.create)).toBe("/");
    expect(Reflect.getMetadata(METHOD_METADATA, DocumentsController.prototype.get)).toBe(0);
    expect(Reflect.getMetadata(PATH_METADATA, DocumentsController.prototype.get)).toBe(
      ":documentId",
    );
    expect(Reflect.getMetadata(METHOD_METADATA, DocumentsController.prototype.appendVersion)).toBe(
      1,
    );
    expect(Reflect.getMetadata(PATH_METADATA, DocumentsController.prototype.appendVersion)).toBe(
      ":documentId/versions",
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, DocumentsController.prototype.create)).toBe(
      undefined,
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, DocumentsController.prototype.get)).toBe(undefined);
    expect(Reflect.getMetadata(GUARDS_METADATA, DocumentsController.prototype.appendVersion)).toBe(
      undefined,
    );
  });
});
