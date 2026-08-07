/* eslint-disable no-unused-vars */
import { S3Client } from "@aws-sdk/client-s3";
import { Module } from "@nestjs/common";

import { AdminCommandService, AdminHealthComposition } from "@evaluation/administration";
import { createDatabaseClient } from "@evaluation/database";
import {
  NotificationIntentService,
  NotificationPreferenceService,
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
import { ExportsController } from "./exports.controller.js";
import { createExportQueueProducer, ExportQueueProducer } from "./export-queue-producer.js";
import { NotificationsController } from "./notifications.controller.js";
import { OPERATIONS_POLICY_DATABASE, OperationsPolicyGuard } from "./operations-policy.guard.js";
import { S3ReportStorage } from "./s3-report-storage.js";
import { OperationsTargetAuthorizer } from "./target-authorizer.js";

export const OPERATIONS_DATABASE = Symbol("OPERATIONS_DATABASE");
export const REPORT_STORAGE = Symbol("REPORT_STORAGE");
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
      useFactory: () => createExportQueueProducer(requiredEnvironment("REDIS_URL")),
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
      useFactory: () =>
        new S3ReportStorage(
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
          process.env.DOCUMENT_STORAGE_BUCKET ?? "",
        ),
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
      inject: [OPERATIONS_DATABASE, REPORT_STORAGE],
      useFactory: (database: Database, storage: ReportObjectStorage) =>
        new ArtifactAccessService(database, storage),
    },
    {
      provide: OperationsTargetAuthorizer,
      inject: [OPERATIONS_DATABASE],
      useFactory: (database: Database) => new OperationsTargetAuthorizer(database),
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
      inject: [OPERATIONS_DATABASE],
      useFactory: (database: Database) => operationsHealth(database),
    },
    OperationsPolicyGuard,
  ],
})(OperationsModule);

function operationsHealth(database: Database) {
  return new AdminHealthComposition([
    { dependency: "API", check: async () => ({ state: "HEALTHY", nextActionKey: null }) },
    {
      dependency: "WORKER",
      check: async () => ({ state: "DEGRADED", nextActionKey: "admin.health.verifyWorker" }),
    },
    {
      dependency: "DATABASE",
      check: async () => {
        await database.$queryRaw`SELECT 1`;
        return { state: "HEALTHY", nextActionKey: null };
      },
    },
    {
      dependency: "QUEUE",
      check: async () => ({
        state: process.env.REDIS_URL ? "HEALTHY" : "ACTION_REQUIRED",
        nextActionKey: process.env.REDIS_URL ? null : "admin.health.configureQueue",
      }),
    },
    {
      dependency: "OBJECT_STORAGE",
      check: async () => ({
        state: process.env.DOCUMENT_STORAGE_BUCKET ? "HEALTHY" : "ACTION_REQUIRED",
        nextActionKey: process.env.DOCUMENT_STORAGE_BUCKET
          ? null
          : "admin.health.configureObjectStorage",
      }),
    },
    {
      dependency: "OIDC",
      check: async () => ({
        state: process.env.OIDC_ISSUER ? "HEALTHY" : "ACTION_REQUIRED",
        nextActionKey: process.env.OIDC_ISSUER ? null : "admin.health.configureOidc",
      }),
    },
    { dependency: "AI_ROUTE", check: async () => ({ state: "HEALTHY", nextActionKey: null }) },
    { dependency: "CONNECTOR", check: async () => ({ state: "HEALTHY", nextActionKey: null }) },
    {
      dependency: "EMAIL",
      check: async () => ({ state: "DEGRADED", nextActionKey: "admin.health.configureEmail" }),
    },
    {
      dependency: "BACKUP",
      check: async () => ({ state: "ACTION_REQUIRED", nextActionKey: "admin.health.verifyBackup" }),
    },
  ]);
}

function databaseUrl() {
  return requiredEnvironment("DATABASE_URL");
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
