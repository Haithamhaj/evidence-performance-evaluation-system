import {
  ActivateDocumentTemplateVersionSchema,
  AppError,
  CreateDocumentTemplateVersionSchema,
} from "@evaluation/contracts";
import { TemplateService } from "@evaluation/documents";
import { Body, Controller, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { DocumentTemplatePolicyGuard } from "./document-template-policy.guard.js";
import { DocumentsAuthenticationGuard } from "./documents-authentication.guard.js";

type Request = Readonly<{
  principal: import("@evaluation/auth").AuthenticatedPrincipal;
  correlationId: string;
}>;

export class DocumentTemplatesController {
  private readonly templates: TemplateService;

  constructor(templates: TemplateService) {
    this.templates = templates;
  }

  createVersion(request: Request, body: unknown) {
    return this.templates.createVersion({
      actor: actor(request),
      correlationId: request.correlationId,
      input: parse(CreateDocumentTemplateVersionSchema, body),
    });
  }

  activate(request: Request, templateId: string, versionId: string, body: unknown) {
    return this.templates.activate({
      actor: actor(request),
      correlationId: request.correlationId,
      templateId: parse(z.string().uuid(), templateId),
      versionId: parse(z.string().uuid(), versionId),
      input: parse(ActivateDocumentTemplateVersionSchema, body),
    });
  }
}

function actor(request: Request) {
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

Controller("api/v1/document-templates")(DocumentTemplatesController);
UseGuards(DocumentsAuthenticationGuard, DocumentTemplatePolicyGuard)(DocumentTemplatesController);
Inject(TemplateService)(DocumentTemplatesController, undefined, 0);

const createDescriptor = Object.getOwnPropertyDescriptor(
  DocumentTemplatesController.prototype,
  "createVersion",
)!;
Req()(DocumentTemplatesController.prototype, "createVersion", 0);
Body()(DocumentTemplatesController.prototype, "createVersion", 1);
Post()(DocumentTemplatesController.prototype, "createVersion", createDescriptor);

const activateDescriptor = Object.getOwnPropertyDescriptor(
  DocumentTemplatesController.prototype,
  "activate",
)!;
Req()(DocumentTemplatesController.prototype, "activate", 0);
Param("templateId")(DocumentTemplatesController.prototype, "activate", 1);
Param("versionId")(DocumentTemplatesController.prototype, "activate", 2);
Body()(DocumentTemplatesController.prototype, "activate", 3);
Post(":templateId/versions/:versionId/activate")(
  DocumentTemplatesController.prototype,
  "activate",
  activateDescriptor,
);
