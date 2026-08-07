import { Inject, Injectable, Module } from "@nestjs/common";

import { createDatabaseClient } from "@evaluation/database";
import {
  InMemoryEmailAdapter,
  NotificationDeliveryService,
  NotificationPreferenceService,
  UnavailableEmailAdapter,
} from "@evaluation/notifications";

import { NotificationDeliveryProcessor } from "./notification-delivery.processor.js";
import { createNotificationQueueRuntime } from "./notification-queue-runtime.js";

type Environment = Readonly<Record<string, string | undefined>>;
export const NOTIFICATION_WORKER_CONFIGURATION = Symbol("NOTIFICATION_WORKER_CONFIGURATION");
export const NOTIFICATION_WORKER_FACTORY = Symbol("NOTIFICATION_WORKER_FACTORY");

export function createNotificationWorkerConfiguration(environment: Environment = process.env) {
  const databaseUrl = environment.DATABASE_URL?.trim();
  const redisUrl = environment.REDIS_URL?.trim();
  if (!databaseUrl || !redisUrl || environment.WORKER_JOB_TYPE !== "notifications.deliver") {
    return undefined;
  }
  return { databaseUrl, redisUrl, allowLocalEmail: environment.EMAIL_PROVIDER === "memory" };
}

export async function createNotificationWorkerComposition(
  configuration: NonNullable<ReturnType<typeof createNotificationWorkerConfiguration>>,
) {
  const database = createDatabaseClient(configuration.databaseUrl);
  const email = configuration.allowLocalEmail
    ? new InMemoryEmailAdapter()
    : new UnavailableEmailAdapter();
  const delivery = new NotificationDeliveryService(
    database,
    new NotificationPreferenceService(database),
    email,
  );
  const runtime = createNotificationQueueRuntime({
    redisUrl: configuration.redisUrl,
    processor: new NotificationDeliveryProcessor(delivery),
  });
  return {
    start: () => runtime.start(),
    async close() {
      await runtime.close();
      await database.$disconnect();
    },
  };
}

export class NotificationWorkerLifecycle {
  private runtime: Awaited<ReturnType<typeof createNotificationWorkerComposition>> | undefined;
  private readonly configuration: ReturnType<typeof createNotificationWorkerConfiguration>;
  private readonly factory: typeof createNotificationWorkerComposition;

  constructor(
    configuration: ReturnType<typeof createNotificationWorkerConfiguration>,
    factory: typeof createNotificationWorkerComposition,
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
Inject(NOTIFICATION_WORKER_CONFIGURATION)(NotificationWorkerLifecycle, undefined, 0);
Inject(NOTIFICATION_WORKER_FACTORY)(NotificationWorkerLifecycle, undefined, 1);
Injectable()(NotificationWorkerLifecycle);

export class NotificationsWorkerModule {}

Module({
  providers: [
    {
      provide: NOTIFICATION_WORKER_CONFIGURATION,
      useFactory: createNotificationWorkerConfiguration,
    },
    { provide: NOTIFICATION_WORKER_FACTORY, useValue: createNotificationWorkerComposition },
    NotificationWorkerLifecycle,
  ],
  exports: [NotificationWorkerLifecycle],
})(NotificationsWorkerModule);
