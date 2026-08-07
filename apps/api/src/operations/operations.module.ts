/* eslint-disable no-unused-vars */
import { S3Client } from "@aws-sdk/client-s3";
import { Module } from "@nestjs/common";

import { AdminCommandService, AdminHealthComposition } from "@evaluation/administration";
import { createDatabaseClient } from "@evaluation/database";
import { EvaluationReportReader } from "@evaluation/employee-evaluation";
import { NotificationIntentService, NotificationPreferenceService } from "@evaluation/notifications";
import {
  ArtifactAccessService,
  ExportService,
  ProjectionRegistry,
  type ReportObjectStorage,
} from "@evaluation/reporting";

import { AuthModule } from "../auth/auth.module.js";
import { AdministrationController } from "./administration.controller.js";
import { ExportsController } from "./exports.controller.js";
import { NotificationsController } from "./notifications.controller.js";
import {
  OPERATIONS_POLICY_DATABASE,
  OperationsPolicyGuard,
} from "./operations-policy.guard.js";
import { S3ReportStorage } from "./s3-report-storage.js";
import { OperationsTargetAuthorizer } from "./target-authorizer.js";

export const OPERATIONS_DATABASE = Symbol("OPERATIONS_DATABASE");
export const REPORT_STORAGE = Symbol("REPORT_STORAGE");
const OPERATIONS_LIFECYCLE = Symbol("OPERATIONS_LIFECYCLE");
type Database = ReturnType<typeof createDatabaseClient>;

export class OperationsModule {}

Module({
  imports: [AuthModule],
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
      useFactory: (database: Database) => evaluationProjectionRegistry(database),
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
      useFactory: (database: Database, registry: ProjectionRegistry, storage: ReportObjectStorage) =>
        new ExportService(database, registry, storage),
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
      inject: [OPERATIONS_DATABASE],
      useFactory: (database: Database) =>
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
          {},
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

function evaluationProjectionRegistry(database: Database) {
  const reader = new EvaluationReportReader(database);
  const registry = new ProjectionRegistry();
  registry.register({
    reportType: "EMPLOYEE_EVALUATION",
    audience: "EMPLOYEE_SELF",
    source: "employee-evaluation",
    projectionVersion: 2,
    snapshot: async ({ requesterId, cycleId }) => {
      if (!cycleId) throw new Error("EVALUATION_CYCLE_REQUIRED");
      const snapshot = await reader.resolveEmployeeExportSnapshot({
        cycleId,
        employeeId: requesterId,
      });
      return { snapshotId: snapshot.snapshotId, version: snapshot.version };
    },
    read: async (version, { requesterId, cycleId }) => {
      if (!cycleId) throw new Error("EVALUATION_CYCLE_REQUIRED");
      const snapshot = await reader.resolveEmployeeExportSnapshot({
        cycleId,
        employeeId: requesterId,
      });
      if (snapshot.snapshotId !== version.snapshotId || snapshot.version !== version.version) {
        throw new Error("EVALUATION_SNAPSHOT_VERSION_MISMATCH");
      }
      const projection = await reader.readEmployee({
        assignmentId: snapshot.assignmentId,
        requester: { actorId: requesterId, access: "self", active: true },
      });
      return {
        title: "Employee evaluation",
        lines: [
          `Cycle: ${projection.cycleType}`,
          `State: ${projection.state}`,
          ...(projection.finalSnapshot?.entries.map(
            (decision) =>
              `${decision.criterionId}: ${decision.rating} — ${decision.justification}`,
          ) ?? []),
        ],
      };
    },
  });
  return registry;
}

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
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL is required");
  return value;
}
