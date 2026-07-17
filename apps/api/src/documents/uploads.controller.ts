import { AppError, StageUploadMetadataSchema } from "@evaluation/contracts";
import { UploadService } from "@evaluation/documents";
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

export class UploadsController {
  private readonly uploads: UploadService;

  constructor(uploads: UploadService) {
    this.uploads = uploads;
  }

  upload(request: UploadRequest) {
    const metadata = parse(StageUploadMetadataSchema, {
      kind: header(request, "x-document-kind"),
      resourceId: header(request, "x-document-resource-id"),
      filename: header(request, "x-document-filename"),
      declaredMime: header(request, "content-type"),
      reason: header(request, "x-document-reason"),
    });
    return this.uploads.stage(
      {
        actor: actor(request),
        correlationId: request.correlationId,
        metadata,
      },
      request,
    );
  }

  signRead(request: AuthenticatedRequest, uploadedSourceId: string) {
    return this.uploads.signRead({
      actor: actor(request),
      correlationId: request.correlationId,
      uploadedSourceId: parse(z.string().uuid(), uploadedSourceId),
    });
  }
}

function actor(request: AuthenticatedRequest) {
  return { userId: request.principal.userId, active: request.principal.active } as const;
}

function header(request: UploadRequest, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === "string" ? value : undefined;
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

Controller("api/v1/documents/uploads")(UploadsController);
UseGuards(DocumentsAuthenticationGuard)(UploadsController);
Inject(UploadService)(UploadsController, undefined, 0);

const uploadDescriptor = Object.getOwnPropertyDescriptor(UploadsController.prototype, "upload")!;
Req()(UploadsController.prototype, "upload", 0);
Post()(UploadsController.prototype, "upload", uploadDescriptor);

const signedReadDescriptor = Object.getOwnPropertyDescriptor(
  UploadsController.prototype,
  "signRead",
)!;
Req()(UploadsController.prototype, "signRead", 0);
Param("uploadedSourceId")(UploadsController.prototype, "signRead", 1);
Post(":uploadedSourceId/signed-read")(
  UploadsController.prototype,
  "signRead",
  signedReadDescriptor,
);
