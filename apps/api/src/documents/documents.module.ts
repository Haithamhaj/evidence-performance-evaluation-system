import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient } from "@evaluation/database";
import { TemplateService } from "@evaluation/documents";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import {
  DOCUMENTS_POLICY_DATABASE,
  DocumentTemplatePolicyGuard,
} from "./document-template-policy.guard.js";
import { DocumentTemplatesController } from "./document-templates.controller.js";
import { DocumentsAuthenticationGuard } from "./documents-authentication.guard.js";

const DOCUMENTS_DATABASE = Symbol("DOCUMENTS_DATABASE");
const DOCUMENTS_DATABASE_LIFECYCLE = Symbol("DOCUMENTS_DATABASE_LIFECYCLE");

function databaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL must be configured");
  return value;
}

export class DocumentsModule {}

Module({
  imports: [AuthModule],
  controllers: [DocumentTemplatesController],
  providers: [
    { provide: DOCUMENTS_DATABASE, useFactory: () => createDatabaseClient(databaseUrl()) },
    {
      provide: DOCUMENTS_POLICY_DATABASE,
      useFactory: (database: ReturnType<typeof createDatabaseClient>) => database,
      inject: [DOCUMENTS_DATABASE],
    },
    {
      provide: DOCUMENTS_DATABASE_LIFECYCLE,
      useFactory: (database: ReturnType<typeof createDatabaseClient>) => ({
        onModuleDestroy: () => database.$disconnect(),
      }),
      inject: [DOCUMENTS_DATABASE],
    },
    {
      provide: TemplateService,
      useFactory: (database: ReturnType<typeof createDatabaseClient>) =>
        new TemplateService(database, databaseAuditWriter as never),
      inject: [DOCUMENTS_DATABASE],
    },
    DocumentsAuthenticationGuard,
    DocumentTemplatePolicyGuard,
  ],
})(DocumentsModule);
