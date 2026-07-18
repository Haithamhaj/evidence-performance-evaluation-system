import {
  createRuntimeAiRouter,
  EnvironmentAiCredentialSecretResolver,
} from "@evaluation/ai-routing";
import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient } from "@evaluation/database";
import {
  ActivityReader,
  AiRouterUpdateStructurer,
  EvidenceService,
  PrismaEvidenceScopeReader,
  PrismaSafeEvidenceUploadReader,
  PrismaUpdateScopeReader,
  UpdateService,
} from "@evaluation/updates-evidence";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { EvidenceController } from "./evidence.controller.js";
import { TimelineController, UpdatesController } from "./updates.controller.js";
import { UpdatesEvidencePolicyGuard } from "./updates-evidence-policy.guard.js";

const UPDATES_EVIDENCE_DATABASE = Symbol("UPDATES_EVIDENCE_DATABASE");
const UPDATES_EVIDENCE_STRUCTURER = Symbol("UPDATES_EVIDENCE_STRUCTURER");
const UPDATES_EVIDENCE_DATABASE_LIFECYCLE = Symbol(
  "UPDATES_EVIDENCE_DATABASE_LIFECYCLE",
);

export class UpdatesEvidenceModule {}

Module({
  imports: [AuthModule],
  controllers: [UpdatesController, EvidenceController, TimelineController],
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
        const route = await client.aiRoute.findFirst({
          where: { routeKey: "update.structure", level: "system" },
          orderBy: { createdAt: "desc" },
          select: { scopeId: true },
        });
        if (route === null) throw new Error("The update.structure system route is not configured");
        const router = await createRuntimeAiRouter({
          database: client,
          secretResolver: new EnvironmentAiCredentialSecretResolver(),
        });
        return new AiRouterUpdateStructurer(router, client, {
          systemId: route.scopeId,
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
      useFactory: (client: ReturnType<typeof createDatabaseClient>) =>
        new ActivityReader(client),
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
