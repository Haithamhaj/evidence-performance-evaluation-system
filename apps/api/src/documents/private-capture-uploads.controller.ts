import { AppError, PrivateCaptureUploadMetadataSchema } from "@evaluation/contracts";
import { PrivateCaptureUploadService } from "@evaluation/documents";
import { canUsePrivateCapture } from "@evaluation/permissions";
import { Controller, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { DocumentsAuthenticationGuard } from "./documents-authentication.guard.js";

type UploadRequest = NodeJS.ReadableStream &
  Readonly<{
    principal: import("@evaluation/auth").AuthenticatedPrincipal;
    correlationId: string;
    headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  }>;

type AuthenticatedRequest = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId: string;
}>;

export class PrivateCaptureUploadsController {
  constructor(private readonly uploads: PrivateCaptureUploadService) {}

  upload(request: UploadRequest) {
    assertPrivateCaptureAuthorized(request.principal);
    rejectUnexpectedHeaders(request);
    return this.uploads.stage(
      {
        actor: actor(request),
        correlationId: request.correlationId,
        metadata: parse(PrivateCaptureUploadMetadataSchema, {
          filename: header(request, "x-capture-filename"),
          declaredMime: header(request, "content-type"),
        }),
      },
      request,
    );
  }

  signRead(request: AuthenticatedRequest, privateCaptureUploadId: string) {
    assertPrivateCaptureAuthorized(request.principal);
    return this.uploads.signRead({
      actor: actor(request),
      correlationId: request.correlationId,
      privateCaptureUploadId: parse(z.string().uuid(), privateCaptureUploadId),
    });
  }
}

function actor(request: AuthenticatedRequest) {
  return {
    userId: request.principal.userId,
    active: request.principal.active,
    roles: request.principal.roles,
  } as const;
}

function assertPrivateCaptureAuthorized(principal: import("@evaluation/auth").AuthenticatedPrincipal) {
  if (!canUsePrivateCapture(principal)) {
    throw new AppError("PRIVATE_CAPTURE_FORBIDDEN", "errors.privateCapture.forbidden", 403);
  }
}

function header(request: UploadRequest, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === "string" ? value : undefined;
}

function rejectUnexpectedHeaders(request: UploadRequest): void {
  if (
    Object.keys(request.headers).some(
      (name) => name.startsWith("x-capture-") && name !== "x-capture-filename",
    )
  ) {
    throw new AppError("DOCUMENT_INPUT_INVALID", "errors.documents.inputInvalid", 400);
  }
}

function parse<T>(schema: { parse(value: unknown): T }, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      throw new AppError("DOCUMENT_INPUT_INVALID", "errors.documents.inputInvalid", 400);
    }
    throw error;
  }
}

Controller("api/v1/private-captures/uploads")(PrivateCaptureUploadsController);
UseGuards(DocumentsAuthenticationGuard)(PrivateCaptureUploadsController);
Inject(PrivateCaptureUploadService)(PrivateCaptureUploadsController, undefined, 0);

const uploadDescriptor = Object.getOwnPropertyDescriptor(
  PrivateCaptureUploadsController.prototype,
  "upload",
)!;
Req()(PrivateCaptureUploadsController.prototype, "upload", 0);
Post()(PrivateCaptureUploadsController.prototype, "upload", uploadDescriptor);

const signedReadDescriptor = Object.getOwnPropertyDescriptor(
  PrivateCaptureUploadsController.prototype,
  "signRead",
)!;
Req()(PrivateCaptureUploadsController.prototype, "signRead", 0);
Param("privateCaptureUploadId")(PrivateCaptureUploadsController.prototype, "signRead", 1);
Post(":privateCaptureUploadId/signed-read")(
  PrivateCaptureUploadsController.prototype,
  "signRead",
  signedReadDescriptor,
);
