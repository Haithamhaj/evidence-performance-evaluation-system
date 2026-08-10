import { S3Client } from "@aws-sdk/client-s3";
import { Inject, Injectable, Module } from "@nestjs/common";

import { createDatabaseClient } from "@evaluation/database";
import {
  createNotificationDeliveryQueue,
  NotificationEventProducer,
  NotificationIntentService,
} from "@evaluation/notifications";
import { createEvaluationProjectionRegistry, ExportService } from "@evaluation/reporting";

import { ExportProcessor } from "./export.processor.js";
import { createReportingQueueRuntime } from "./reporting-queue-runtime.js";
import { S3ReportWriteStorage } from "./s3-write-storage.js";

type Environment = Readonly<Record<string, string | undefined>>;
export const REPORTING_WORKER_CONFIGURATION = Symbol("REPORTING_WORKER_CONFIGURATION");
export const REPORTING_WORKER_FACTORY = Symbol("REPORTING_WORKER_FACTORY");

export function createReportingWorkerConfiguration(environment: Environment = process.env) {
  const databaseUrl = environment.DATABASE_URL?.trim();
  const redisUrl = environment.REDIS_URL?.trim();
  const bucket = environment.DOCUMENT_STORAGE_BUCKET?.trim();
  if (
    !databaseUrl ||
    !redisUrl ||
    !bucket ||
    environment.WORKER_JOB_TYPE !== "reporting.generate"
  ) {
    return undefined;
  }
  return { databaseUrl, redisUrl, bucket, environment };
}

export async function createReportingWorkerComposition(
  configuration: NonNullable<ReturnType<typeof createReportingWorkerConfiguration>>,
) {
  const database = createDatabaseClient(configuration.databaseUrl);
  const client = new S3Client({
    ...(configuration.environment.S3_ENDPOINT
      ? { endpoint: configuration.environment.S3_ENDPOINT }
      : {}),
    region: configuration.environment.S3_REGION ?? "us-east-1",
    forcePathStyle: true,
    ...(configuration.environment.S3_ACCESS_KEY_ID && configuration.environment.S3_SECRET_ACCESS_KEY
      ? {
          credentials: {
            accessKeyId: configuration.environment.S3_ACCESS_KEY_ID,
            secretAccessKey: configuration.environment.S3_SECRET_ACCESS_KEY,
          },
        }
      : {}),
  });
  const exports = new ExportService(
    database,
    createEvaluationProjectionRegistry(database),
    new S3ReportWriteStorage(client, configuration.bucket),
  );
  const notificationQueue = createNotificationDeliveryQueue(configuration.redisUrl);
  const notificationEvents = new NotificationEventProducer(
    new NotificationIntentService(database),
    notificationQueue,
  );
  const queue = createReportingQueueRuntime({
    redisUrl: configuration.redisUrl,
    processor: new ExportProcessor(exports, ({ requestId, requesterId, artifactId }) =>
      notificationEvents.publish({
        type: "EXPORT_READY",
        eventId: `export:${requestId}`,
        eventVersion: 1,
        recipientId: requesterId,
        artifactId,
        occurredAt: new Date().toISOString(),
      }),
    ),
  });
  return {
    start: () => queue.start(),
    async close() {
      await queue.close();
      await notificationQueue.close();
      client.destroy();
      await database.$disconnect();
    },
  };
}

export class ReportingWorkerLifecycle {
  private runtime: Awaited<ReturnType<typeof createReportingWorkerComposition>> | undefined;
  private readonly configuration: ReturnType<typeof createReportingWorkerConfiguration>;
  private readonly factory: typeof createReportingWorkerComposition;

  constructor(
    configuration: ReturnType<typeof createReportingWorkerConfiguration>,
    factory: typeof createReportingWorkerComposition,
  ) {
    this.configuration = configuration;
    this.factory = factory;
  }
  async onApplicationBootstrap() {
    if (!this.configuration) return;
    this.runtime = await this.factory(this.configuration);
    await this.runtime.start();
  }
  async onApplicationShutdown() {
    await this.runtime?.close();
  }
}
Inject(REPORTING_WORKER_CONFIGURATION)(ReportingWorkerLifecycle, undefined, 0);
Inject(REPORTING_WORKER_FACTORY)(ReportingWorkerLifecycle, undefined, 1);
Injectable()(ReportingWorkerLifecycle);

export class ReportingWorkerModule {}

Module({
  providers: [
    { provide: REPORTING_WORKER_CONFIGURATION, useFactory: createReportingWorkerConfiguration },
    { provide: REPORTING_WORKER_FACTORY, useValue: createReportingWorkerComposition },
    ReportingWorkerLifecycle,
  ],
  exports: [ReportingWorkerLifecycle],
})(ReportingWorkerModule);
