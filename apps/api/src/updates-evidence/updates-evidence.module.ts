import {
  createRuntimeAiRouter,
  EnvironmentAiCredentialSecretResolver,
} from "@evaluation/ai-routing";
import { databaseAuditWriter } from "@evaluation/audit";
import { parseDocumentRuntimeConfig, S3PrivateStorage } from "@evaluation/documents";
import { createDatabaseClient } from "@evaluation/database";
import {
  ActivityReader,
  AiRouterUpdateStructurer,
  EvidenceService,
  PrismaEvidenceScopeReader,
  PrismaSafeEvidenceUploadReader,
  PrismaUpdateScopeReader,
  UpdateService,
  VoiceUpdateService,
  AiRouterVoiceTranscriber,
  PrivateVoiceMediaResolver,
} from "@evaluation/updates-evidence";
import { S3Client } from "@aws-sdk/client-s3";
import { Module } from "@nestjs/common";

import { createDeferredRuntimeAiRouter } from "../ai-routing/deferred-runtime-ai-router.js";
import { resolveSystemAiScopeId } from "../ai-routing/system-ai-scope.js";
import { AuthModule } from "../auth/auth.module.js";
import { EvidenceController } from "./evidence.controller.js";
import { TimelineController, UpdatesController } from "./updates.controller.js";
import { UpdatesEvidencePolicyGuard } from "./updates-evidence-policy.guard.js";
import { VoiceUpdatesController } from "./voice.controller.js";

const UPDATES_EVIDENCE_DATABASE = Symbol("UPDATES_EVIDENCE_DATABASE");
const UPDATES_EVIDENCE_STRUCTURER = Symbol("UPDATES_EVIDENCE_STRUCTURER");
const UPDATES_EVIDENCE_DATABASE_LIFECYCLE = Symbol("UPDATES_EVIDENCE_DATABASE_LIFECYCLE");
const VOICE_PRIVATE_MEDIA_RESOLVER = Symbol("VOICE_PRIVATE_MEDIA_RESOLVER");

export class UpdatesEvidenceModule {}

Module({
  imports: [AuthModule],
  controllers: [UpdatesController, EvidenceController, TimelineController, VoiceUpdatesController],
  providers: [
    {
      provide: UPDATES_EVIDENCE_DATABASE,
      useFactory: () => {
        const url = process.env.DATABASE_URL?.trim();
        if (!url) throw new Error("DATABASE_URL must be configured");
        return createDatabaseClient(url);
      },
    },
    {
      provide: UPDATES_EVIDENCE_STRUCTURER,
      useFactory: async (client: ReturnType<typeof createDatabaseClient>) => {
        const router = createDeferredRuntimeAiRouter(() =>
          createRuntimeAiRouter({
            database: client,
            secretResolver: new EnvironmentAiCredentialSecretResolver(),
          }),
        );
        return new AiRouterUpdateStructurer(router, client, {
          systemId: await resolveSystemAiScopeId(client, "update.structure"),
          timeoutMs: 60_000,
        });
      },
      inject: [UPDATES_EVIDENCE_DATABASE],
    },
    {
      provide: UpdateService,
      useFactory: (
        client: ReturnType<typeof createDatabaseClient>,
        structurer: AiRouterUpdateStructurer,
      ) =>
        new UpdateService(
          client,
          new PrismaUpdateScopeReader(),
          structurer,
          databaseAuditWriter as never,
        ),
      inject: [UPDATES_EVIDENCE_DATABASE, UPDATES_EVIDENCE_STRUCTURER],
    },
    {
      provide: VOICE_PRIVATE_MEDIA_RESOLVER,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) => {
        const config = parseDocumentRuntimeConfig(process.env);
        const s3 = new S3Client({
          credentials: { accessKeyId: config.storage.accessKeyId, secretAccessKey: config.storage.secretAccessKey },
          endpoint: config.storage.endpoint,
          forcePathStyle: true,
          region: config.storage.region,
        });
        return { resolver: new PrivateVoiceMediaResolver(client, new S3PrivateStorage(s3, config.storage.bucket)), s3 };
      },
      inject: [UPDATES_EVIDENCE_DATABASE],
    },
    {
      provide: VoiceUpdateService,
      useFactory: async (client: ReturnType<typeof createDatabaseClient>, media: { resolver: PrivateVoiceMediaResolver }) => {
        const router = createDeferredRuntimeAiRouter(() =>
          createRuntimeAiRouter({ database: client, secretResolver: new EnvironmentAiCredentialSecretResolver(), privateMediaResolver: media.resolver }),
        );
        return new VoiceUpdateService(
          client,
          new PrismaUpdateScopeReader(),
          new AiRouterVoiceTranscriber(router, client, { systemId: await resolveSystemAiScopeId(client, "update.transcribe"), timeoutMs: 60_000 }),
        );
      },
      inject: [UPDATES_EVIDENCE_DATABASE, VOICE_PRIVATE_MEDIA_RESOLVER],
    },
    {
      provide: EvidenceService,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) =>
        new EvidenceService(
          client,
          new PrismaEvidenceScopeReader(),
          new PrismaSafeEvidenceUploadReader(),
          databaseAuditWriter as never,
        ),
      inject: [UPDATES_EVIDENCE_DATABASE],
    },
    {
      provide: ActivityReader,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) => new ActivityReader(client),
      inject: [UPDATES_EVIDENCE_DATABASE],
    },
    {
      provide: UPDATES_EVIDENCE_DATABASE_LIFECYCLE,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) => ({
        onModuleDestroy: () => client.$disconnect(),
      }),
      inject: [UPDATES_EVIDENCE_DATABASE],
    },
    UpdatesEvidencePolicyGuard,
  ],
})(UpdatesEvidenceModule);
