import { S3Client } from "@aws-sdk/client-s3";
import {
  createRuntimeAiRouter,
  EnvironmentAiCredentialSecretResolver,
} from "@evaluation/ai-routing";
import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient } from "@evaluation/database";
import {
  DocumentAnalysisSourceLoader,
  parseDocumentRuntimeConfig,
  ProgressContractDraftSourceReader,
  ProgressDocumentReader,
  S3PrivateStorage,
} from "@evaluation/documents";
import {
  CriteriaReviewReader,
  DocumentResourceReader,
  createProgressContractDraftService,
  createProgressContractService,
  createProjectService,
  createResponsibilityService,
  createWorkstreamService,
  ProgressContractDraftService,
  ProgressContractService,
  ProjectService,
  ResponsibilityService,
  WorkstreamService,
} from "@evaluation/projects";
import { Module } from "@nestjs/common";

import { createDeferredRuntimeAiRouter } from "../ai-routing/deferred-runtime-ai-router.js";
import { resolveSystemAiScopeId } from "../ai-routing/system-ai-scope.js";
import { AuthModule } from "../auth/auth.module.js";
import { PROJECTS_POLICY_DATABASE, ProjectPolicyGuard } from "./project-policy-loaders.js";
import { ProgressContractDraftsController } from "./progress-contract-drafts.controller.js";
import { ProjectsAuthenticationGuard } from "./projects-authentication.guard.js";
import { ProjectsController } from "./projects.controller.js";
import { ResponsibilitiesController } from "./responsibilities.controller.js";
import { WorkstreamsController } from "./workstreams.controller.js";

const PROJECTS_DATABASE = Symbol("PROJECTS_DATABASE");
const PROJECTS_DATABASE_LIFECYCLE = Symbol("PROJECTS_DATABASE_LIFECYCLE");
const PROJECTS_DOCUMENT_CONFIG = Symbol("PROJECTS_DOCUMENT_CONFIG");
const PROJECTS_DOCUMENT_S3 = Symbol("PROJECTS_DOCUMENT_S3");
const PROJECTS_DOCUMENT_S3_LIFECYCLE = Symbol("PROJECTS_DOCUMENT_S3_LIFECYCLE");
const PROJECTS_DRAFT_SOURCE_READER = Symbol("PROJECTS_DRAFT_SOURCE_READER");
const PROJECTS_DRAFT_AI_RUNTIME = Symbol("PROJECTS_DRAFT_AI_RUNTIME");

function requiredDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (value === undefined || value.length === 0) throw new Error("DATABASE_URL must be configured");
  return value;
}

export class ProjectsModule {}

Module({
  imports: [AuthModule],
  controllers: [
    ProjectsController,
    WorkstreamsController,
    ResponsibilitiesController,
    ProgressContractDraftsController,
  ],
  providers: [
    {
      provide: PROJECTS_DATABASE,
      useFactory: () => createDatabaseClient(requiredDatabaseUrl()),
    },
    {
      provide: PROJECTS_POLICY_DATABASE,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) => client,
      inject: [PROJECTS_DATABASE],
    },
    {
      provide: PROJECTS_DATABASE_LIFECYCLE,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) => ({
        onModuleDestroy: () => client.$disconnect(),
      }),
      inject: [PROJECTS_DATABASE],
    },
    {
      provide: PROJECTS_DOCUMENT_CONFIG,
      useFactory: () => parseDocumentRuntimeConfig(process.env),
    },
    {
      provide: PROJECTS_DOCUMENT_S3,
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
      inject: [PROJECTS_DOCUMENT_CONFIG],
    },
    {
      provide: PROJECTS_DOCUMENT_S3_LIFECYCLE,
      useFactory: (client: S3Client) => ({ onModuleDestroy: () => client.destroy() }),
      inject: [PROJECTS_DOCUMENT_S3],
    },
    {
      provide: PROJECTS_DRAFT_SOURCE_READER,
      useFactory: (
        client: ReturnType<typeof createDatabaseClient>,
        s3: S3Client,
        config: ReturnType<typeof parseDocumentRuntimeConfig>,
      ) => {
        const maxSourceBytes = Math.max(
          config.policy.maxBytesByClass.text,
          config.policy.maxBytesByClass.office,
        );
        const extractionPolicy = {
          maxSourceBytes,
          maxArchiveEntries: config.policy.maxArchiveEntries,
          maxArchiveUncompressedBytes: config.policy.maxArchiveUncompressedBytes,
          maxArchiveCompressionRatio: config.policy.maxArchiveCompressionRatio,
          maxQuotedCharacters: maxSourceBytes,
        };
        const storage = new S3PrivateStorage(s3, config.storage.bucket);
        return new ProgressContractDraftSourceReader(
          client,
          new DocumentResourceReader(client),
          new DocumentAnalysisSourceLoader(client, storage, extractionPolicy),
          extractionPolicy,
        );
      },
      inject: [PROJECTS_DATABASE, PROJECTS_DOCUMENT_S3, PROJECTS_DOCUMENT_CONFIG],
    },
    {
      provide: PROJECTS_DRAFT_AI_RUNTIME,
      useFactory: async (client: ReturnType<typeof createDatabaseClient>) => {
        return {
          router: createDeferredRuntimeAiRouter(() =>
            createRuntimeAiRouter({
              database: client,
              secretResolver: new EnvironmentAiCredentialSecretResolver(),
            }),
          ),
          systemId: await resolveSystemAiScopeId(client, "project.progress-contract.draft"),
        };
      },
      inject: [PROJECTS_DATABASE],
    },
    {
      provide: ProjectService,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) =>
        createProjectService(client, databaseAuditWriter as never),
      inject: [PROJECTS_DATABASE],
    },
    {
      provide: WorkstreamService,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) =>
        createWorkstreamService(client, databaseAuditWriter as never),
      inject: [PROJECTS_DATABASE],
    },
    {
      provide: ResponsibilityService,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) =>
        createResponsibilityService(client, databaseAuditWriter as never),
      inject: [PROJECTS_DATABASE],
    },
    {
      provide: ProgressContractService,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) =>
        createProgressContractService(
          client,
          new ProgressDocumentReader(client),
          new CriteriaReviewReader(client),
          databaseAuditWriter as never,
        ),
      inject: [PROJECTS_DATABASE],
    },
    {
      provide: ProgressContractDraftService,
      useFactory: (
        client: ReturnType<typeof createDatabaseClient>,
        sourceReader: ProgressContractDraftSourceReader,
        runtime: Readonly<{
          router: Awaited<ReturnType<typeof createRuntimeAiRouter>>;
          systemId: string;
        }>,
        progressContracts: ProgressContractService,
      ) =>
        createProgressContractDraftService(
          client,
          sourceReader,
          new CriteriaReviewReader(client),
          runtime.router,
          progressContracts,
          { systemId: runtime.systemId, timeoutMs: 60_000 },
          databaseAuditWriter as never,
        ),
      inject: [
        PROJECTS_DATABASE,
        PROJECTS_DRAFT_SOURCE_READER,
        PROJECTS_DRAFT_AI_RUNTIME,
        ProgressContractService,
      ],
    },
    ProjectsAuthenticationGuard,
    ProjectPolicyGuard,
  ],
  exports: [ProjectService],
})(ProjectsModule);
