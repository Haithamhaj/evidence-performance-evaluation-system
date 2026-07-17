import { AppendDocumentVersionSchema, AppError, CreateDocumentSchema } from "@evaluation/contracts";
import { DocumentService } from "@evaluation/documents";
import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { DocumentsAuthenticationGuard } from "./documents-authentication.guard.js";

type DocumentRequest = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId: string;
}>;

export class DocumentsController {
  private readonly documents: DocumentService;

  constructor(documents: DocumentService) {
    this.documents = documents;
  }

  create(request: DocumentRequest, body: unknown) {
    return this.documents.create({
      actor: actor(request),
      correlationId: request.correlationId,
      input: parse(CreateDocumentSchema, body),
    });
  }

  get(request: DocumentRequest, documentId: string) {
    return this.documents.get({
      actor: actor(request),
      correlationId: request.correlationId,
      documentId: parse(z.string().uuid(), documentId),
    });
  }

  appendVersion(request: DocumentRequest, documentId: string, body: unknown) {
    return this.documents.appendVersion({
      actor: actor(request),
      correlationId: request.correlationId,
      documentId: parse(z.string().uuid(), documentId),
      input: parse(AppendDocumentVersionSchema, body),
    });
  }
}

function actor(request: DocumentRequest) {
  return { userId: request.principal.userId, active: request.principal.active } as const;
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

Controller("api/v1/documents")(DocumentsController);
UseGuards(DocumentsAuthenticationGuard)(DocumentsController);
Inject(DocumentService)(DocumentsController, undefined, 0);

const createDescriptor = Object.getOwnPropertyDescriptor(DocumentsController.prototype, "create")!;
Req()(DocumentsController.prototype, "create", 0);
Body()(DocumentsController.prototype, "create", 1);
Post()(DocumentsController.prototype, "create", createDescriptor);

const getDescriptor = Object.getOwnPropertyDescriptor(DocumentsController.prototype, "get")!;
Req()(DocumentsController.prototype, "get", 0);
Param("documentId")(DocumentsController.prototype, "get", 1);
Get(":documentId")(DocumentsController.prototype, "get", getDescriptor);

const appendDescriptor = Object.getOwnPropertyDescriptor(
  DocumentsController.prototype,
  "appendVersion",
)!;
Req()(DocumentsController.prototype, "appendVersion", 0);
Param("documentId")(DocumentsController.prototype, "appendVersion", 1);
Body()(DocumentsController.prototype, "appendVersion", 2);
Post(":documentId/versions")(DocumentsController.prototype, "appendVersion", appendDescriptor);
