import { Inject, Injectable, Module } from "@nestjs/common";

import { createDatabaseClient } from "@evaluation/database";

import { ExperienceDeliveryProcessor } from "./experience-delivery.processor.js";
import { createExperienceQueueRuntime } from "./experience-queue-runtime.js";

type Environment = Readonly<Record<string, string | undefined>>;
export const EXPERIENCE_WORKER_CONFIGURATION = Symbol("EXPERIENCE_WORKER_CONFIGURATION");
export const EXPERIENCE_WORKER_FACTORY = Symbol("EXPERIENCE_WORKER_FACTORY");

export function createExperienceWorkerConfiguration(environment: Environment = process.env) {
  const databaseUrl = environment.DATABASE_URL?.trim();
  const redisUrl = environment.REDIS_URL?.trim();
  if (!databaseUrl || !redisUrl || environment.WORKER_JOB_TYPE !== "experience.deliver") {
    return undefined;
  }
  return { databaseUrl, redisUrl };
}

export async function createExperienceWorkerComposition(
  configuration: NonNullable<ReturnType<typeof createExperienceWorkerConfiguration>>,
) {
  const database = createDatabaseClient(configuration.databaseUrl);
  const runtime = createExperienceQueueRuntime({
    redisUrl: configuration.redisUrl,
    processor: new ExperienceDeliveryProcessor(database),
  });
  return {
    start: () => runtime.start(),
    async close() {
      await runtime.close();
      await database.$disconnect();
    },
  };
}

export class ExperienceWorkerLifecycle {
  private runtime: Awaited<ReturnType<typeof createExperienceWorkerComposition>> | undefined;
  private readonly configuration: ReturnType<typeof createExperienceWorkerConfiguration>;
  private readonly factory: typeof createExperienceWorkerComposition;

  constructor(
    configuration: ReturnType<typeof createExperienceWorkerConfiguration>,
    factory: typeof createExperienceWorkerComposition,
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

Inject(EXPERIENCE_WORKER_CONFIGURATION)(ExperienceWorkerLifecycle, undefined, 0);
Inject(EXPERIENCE_WORKER_FACTORY)(ExperienceWorkerLifecycle, undefined, 1);
Injectable()(ExperienceWorkerLifecycle);

export class ExperienceEventsWorkerModule {}

Module({
  providers: [
    { provide: EXPERIENCE_WORKER_CONFIGURATION, useFactory: createExperienceWorkerConfiguration },
    { provide: EXPERIENCE_WORKER_FACTORY, useValue: createExperienceWorkerComposition },
    ExperienceWorkerLifecycle,
  ],
  exports: [ExperienceWorkerLifecycle],
})(ExperienceEventsWorkerModule);
