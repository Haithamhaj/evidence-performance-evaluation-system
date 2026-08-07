/* eslint-disable no-unused-vars */
import { S3Client } from "@aws-sdk/client-s3";
import { Module } from "@nestjs/common";

import { AdminCommandService, AdminHealthComposition } from "@evaluation/administration";
import { createDatabaseClient } from "@evaluation/database";
import {
  createNotificationDeliveryQueue,
  NotificationEventProducer,
  NotificationIntentService,
  NotificationPreferenceService,
  type NotificationDeliveryQueue,
} from "@evaluation/notifications";
import {
  ArtifactAccessService,
  createEvaluationProjectionRegistry,
  ExportService,
  ProjectionRegistry,
  type ReportObjectStorage,
} from "@evaluation/reporting";

import { AiRouteManagementService, AiRoutingModule } from "../ai-routing/ai-routing.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AdministrationController } from "./administration.controller.js";
import { AuthoritativeOperationsEventPublisher } from "./authoritative-event-publisher.js";
import { ExportsController } from "./exports.controller.js";
import { createExportQueueProducer, ExportQueueProducer } from "./export-queue-producer.js";
import { NotificationsController } from "./notifications.controller.js";
import { OPERATIONS_POLICY_DATABASE, OperationsPolicyGuard } from "./operations-policy.guard.js";
import { createOperationsHealthProbes } from "./operations-health-probes.js";
import { S3ReportStorage } from "./s3-report-storage.js";
import { OperationsTargetAuthorizer } from "./target-authorizer.js";

export const OPERATIONS_DATABASE = Symbol("OPERATIONS_DATABASE");
export const REPORT_STORAGE = Symbol("REPORT_STORAGE");
const OPERATIONS_NOTIFICATION_QUEUE = Symbol("OPERATIONS_NOTIFICATION_QUEUE");
const OPERATIONS_LIFECYCLE = Symbol("OPERATIONS_LIFECYCLE");
const EXPORT_QUEUE_LIFECYCLE = Symbol("EXPORT_QUEUE_LIFECYCLE");
type Database = ReturnType<typeof createDatabaseClient>;

export class OperationsModule {}

Module({
  imports: [AuthModule, AiRoutingModule],
  controllers: [NotificationsController, ExportsController, AdministrationController],
  providers: [
    { provide: OPERATIONS_DATABASE, useFactory: () => createDatabaseClient(databaseUrl()) },
    { provide: OPERATIONS_POLICY_DATABASE, useExisting: OPERATIONS_DATABASE },
    {
      provide: OPERATIONS_LIFECYCLE,
      inject: [OPERATIONS_DATABASE],
      useFactory: (database: Database) => ({ onModuleDestroy: () => database.$disconnect() }),
    },
    {
      provide: ExportQueueProducer,
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL?.trim();
        return redisUrl
          ? createExportQueueProducer(redisUrl)
          : new ExportQueueProducer({
              add: async (_name, data) => ({ id: data.requestId }),
              close: async () => undefined,
            });
      },
    },
    {
      provide: EXPORT_QUEUE_LIFECYCLE,
      inject: [ExportQueueProducer],
      useFactory: (queue: ExportQueueProducer) => ({ onModuleDestroy: () => queue.close() }),
    },
    {
      provide: NotificationIntentService,
      inject: [OPERATIONS_DATABASE],
      useFactory: (database: Database) => new NotificationIntentService(database),
    },
    {
      provide: OPERATIONS_NOTIFICATION_QUEUE,
      useFactory: (): NotificationDeliveryQueue => {
        const redisUrl = process.env.REDIS_URL?.trim();
        return redisUrl
          ? createNotificationDeliveryQueue(redisUrl)
          : {
              enqueue: async ({ intentId }) => ({ jobId: intentId }),
              close: async () => undefined,
            };
      },
    },
    {
      provide: NotificationEventProducer,
      inject: [NotificationIntentService, OPERATIONS_NOTIFICATION_QUEUE],
      useFactory: (intents: NotificationIntentService, queue: NotificationDeliveryQueue) =>
        new NotificationEventProducer(intents, queue),
    },
    {
      provide: AuthoritativeOperationsEventPublisher,
      inject: [OPERATIONS_DATABASE, NotificationEventProducer],
      useFactory: (database: Database, events: NotificationEventProducer) =>
        new AuthoritativeOperationsEventPublisher(database, events),
    },
    {
      provide: NotificationPreferenceService,
      inject: [OPERATIONS_DATABASE],
      useFactory: (database: Database) => new NotificationPreferenceService(database),
    },
    {
      provide: ProjectionRegistry,
      inject: [OPERATIONS_DATABASE],
      useFactory: (database: Database) => createEvaluationProjectionRegistry(database),
    },
    {
      provide: REPORT_STORAGE,
      useFactory: (): ReportObjectStorage => {
        const bucket = process.env.DOCUMENT_STORAGE_BUCKET?.trim();
        if (!bucket) return unavailableReportStorage();
        return new S3ReportStorage(
          new S3Client({
            ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
            region: process.env.S3_REGION ?? "us-east-1",
            forcePathStyle: true,
            ...(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
              ? {
                  credentials: {
                    accessKeyId: process.env.S3_ACCESS_KEY_ID,
                    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
                  },
                }
              : {}),
          }),
          bucket,
        );
      },
    },
    {
      provide: ExportService,
      inject: [OPERATIONS_DATABASE, ProjectionRegistry, REPORT_STORAGE],
      useFactory: (
        database: Database,
        registry: ProjectionRegistry,
        storage: ReportObjectStorage,
      ) => new ExportService(database, registry, storage),
    },
    {
      provide: ArtifactAccessService,
      inject: [OPERATIONS_DATABASE, REPORT_STORAGE, ProjectionRegistry],
      useFactory: (
        database: Database,
        storage: ReportObjectStorage,
        registry: ProjectionRegistry,
      ) => new ArtifactAccessService(database, storage, registry),
    },
    {
      provide: OperationsTargetAuthorizer,
      inject: [OPERATIONS_DATABASE, ProjectionRegistry],
      useFactory: (database: Database, registry: ProjectionRegistry) =>
        new OperationsTargetAuthorizer(database, registry),
    },
    {
      provide: AdminCommandService,
      inject: [OPERATIONS_DATABASE, AiRouteManagementService],
      useFactory: (database: Database, aiRoutes: AiRouteManagementService) =>
        new AdminCommandService(
          database,
          {
            isSystemAdministrator: async (actorId) =>
              Boolean(
                await database.roleAssignment.findFirst({
                  where: { userId: actorId, role: "system_administrator", scopeType: "system" },
                  select: { id: true },
                }),
              ),
          },
          {
            AI_ROUTES_MANAGE: {
              execute: (command) => aiRoutes.executeAdminCommand(command),
            },
          },
        ),
    },
    {
      provide: AdminHealthComposition,
      inject: [OPERATIONS_DATABASE, REPORT_STORAGE],
      useFactory: (database: Database, storage: ReportObjectStorage) =>
        new AdminHealthComposition(createOperationsHealthProbes({ database, storage })),
    },
    OperationsPolicyGuard,
  ],
  exports: [AuthoritativeOperationsEventPublisher],
})(OperationsModule);

function unavailableReportStorage(): ReportObjectStorage {
  return {
    put: async () => {
      throw new Error("REPORT_STORAGE_UNAVAILABLE");
    },
    signGet: async () => {
      throw new Error("REPORT_STORAGE_UNAVAILABLE");
    },
  };
}

function databaseUrl() {
  return requiredEnvironment("DATABASE_URL");
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
