import { databaseAuditWriter } from "@evaluation/audit";
import { S3Client } from "@aws-sdk/client-s3";
import { createDatabaseClient } from "@evaluation/database";
import {
  ClamAvScanner,
  parseDocumentRuntimeConfig,
  S3PrivateStorage,
  TemplateService,
  UploadService,
} from "@evaluation/documents";
import { DocumentResourceReader } from "@evaluation/projects";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import {
  DOCUMENTS_POLICY_DATABASE,
  DocumentTemplatePolicyGuard,
} from "./document-template-policy.guard.js";
import { DocumentTemplatesController } from "./document-templates.controller.js";
import { DocumentsAuthenticationGuard } from "./documents-authentication.guard.js";
import { UploadsController } from "./uploads.controller.js";

const DOCUMENTS_DATABASE = Symbol("DOCUMENTS_DATABASE");
const DOCUMENTS_DATABASE_LIFECYCLE = Symbol("DOCUMENTS_DATABASE_LIFECYCLE");
const DOCUMENTS_RUNTIME_CONFIG = Symbol("DOCUMENTS_RUNTIME_CONFIG");
const DOCUMENTS_S3_CLIENT = Symbol("DOCUMENTS_S3_CLIENT");
const DOCUMENTS_S3_LIFECYCLE = Symbol("DOCUMENTS_S3_LIFECYCLE");

function databaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL must be configured");
  return value;
}

export class DocumentsModule {}

Module({
  imports: [AuthModule],
  controllers: [DocumentTemplatesController, UploadsController],
  providers: [
    { provide: DOCUMENTS_DATABASE, useFactory: () => createDatabaseClient(databaseUrl()) },
    {
      provide: DOCUMENTS_RUNTIME_CONFIG,
      useFactory: () => parseDocumentRuntimeConfig(process.env),
    },
    {
      provide: DOCUMENTS_S3_CLIENT,
      useFactory: (config: ReturnType<typeof parseDocumentRuntimeConfig>) =>
        new S3Client({
          credentials: {
            accessKeyId: config.storage.accessKeyId,
            secretAccessKey: config.storage.secretAccessKey,
          },
          endpoint: config.storage.endpoint,
          forcePathStyle: true,
          region: config.storage.region,
        }),
      inject: [DOCUMENTS_RUNTIME_CONFIG],
    },
    {
      provide: DOCUMENTS_S3_LIFECYCLE,
      useFactory: (client: S3Client) => ({ onModuleDestroy: () => client.destroy() }),
      inject: [DOCUMENTS_S3_CLIENT],
    },
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
    {
      provide: DocumentResourceReader,
      useFactory: (database: ReturnType<typeof createDatabaseClient>) =>
        new DocumentResourceReader(database),
      inject: [DOCUMENTS_DATABASE],
    },
    {
      provide: S3PrivateStorage,
      useFactory: (client: S3Client, config: ReturnType<typeof parseDocumentRuntimeConfig>) =>
        new S3PrivateStorage(client, config.storage.bucket),
      inject: [DOCUMENTS_S3_CLIENT, DOCUMENTS_RUNTIME_CONFIG],
    },
    {
      provide: ClamAvScanner,
      useFactory: (config: ReturnType<typeof parseDocumentRuntimeConfig>) =>
        new ClamAvScanner(config.scanner),
      inject: [DOCUMENTS_RUNTIME_CONFIG],
    },
    {
      provide: UploadService,
      useFactory: (
        database: ReturnType<typeof createDatabaseClient>,
        reader: DocumentResourceReader,
        storage: S3PrivateStorage,
        scanner: ClamAvScanner,
        config: ReturnType<typeof parseDocumentRuntimeConfig>,
      ) =>
        new UploadService(
          database,
          reader,
          storage,
          scanner,
          config.policy,
          databaseAuditWriter as never,
        ),
      inject: [
        DOCUMENTS_DATABASE,
        DocumentResourceReader,
        S3PrivateStorage,
        ClamAvScanner,
        DOCUMENTS_RUNTIME_CONFIG,
      ],
    },
    DocumentsAuthenticationGuard,
    DocumentTemplatePolicyGuard,
  ],
})(DocumentsModule);
