import { Inject, Injectable, Module } from "@nestjs/common";

import { PreparedExperienceCompositionSchema } from "@evaluation/contracts";
import { createDatabaseClient } from "@evaluation/database";

import { createExperienceOrchestrationQueueRuntime } from "./experience-orchestration-queue-runtime.js";
import { ExperienceOrchestrationProcessor } from "./experience-orchestration.processor.js";

type Environment = Readonly<Record<string, string | undefined>>;
type Database = ReturnType<typeof createDatabaseClient>;
export const EXPERIENCE_ORCHESTRATION_WORKER_CONFIGURATION = Symbol(
  "EXPERIENCE_ORCHESTRATION_WORKER_CONFIGURATION",
);
export const EXPERIENCE_ORCHESTRATION_WORKER_FACTORY = Symbol(
  "EXPERIENCE_ORCHESTRATION_WORKER_FACTORY",
);

export function createExperienceOrchestrationWorkerConfiguration(
  environment: Environment = process.env,
) {
  const databaseUrl = environment.DATABASE_URL?.trim();
  const redisUrl = environment.REDIS_URL?.trim();
  if (!databaseUrl || !redisUrl || environment.WORKER_JOB_TYPE !== "experience.prepare-next") {
    return undefined;
  }
  return { databaseUrl, redisUrl };
}

export async function createExperienceOrchestrationWorkerComposition(
  configuration: NonNullable<ReturnType<typeof createExperienceOrchestrationWorkerConfiguration>>,
) {
  const database = createDatabaseClient(configuration.databaseUrl);
  const processor = new ExperienceOrchestrationProcessor({
    compose: (input) =>
      readDeterministicPreparedComposition(database, input.employeeId, input.idempotencyKey),
  });
  const runtime = createExperienceOrchestrationQueueRuntime({
    redisUrl: configuration.redisUrl,
    processor,
  });
  return {
    start: () => runtime.start(),
    async close() {
      await runtime.close();
      await database.$disconnect();
    },
  };
}

async function readDeterministicPreparedComposition(
  database: Database,
  employeeId: string,
  idempotencyKey: string,
) {
  const row = await database.experiencePreparedItem.findFirst({
    where: { employeeId, idempotencyKey, assistanceMode: "deterministic" },
  });
  if (row === null) return { state: "unavailable", items: [] } as const;
  const item = {
    id: row.id,
    schemaVersion: row.schemaVersion,
    state: row.state,
    kind: row.kind,
    sourceReferences: row.sourceReferences,
    why: row.why,
    freshness: row.freshness,
    consequence: row.consequence,
    editableDraft: row.editableDraft,
    assistance: {
      mode: "deterministic" as const,
      label: row.assistanceLabel,
      routeTrace: null,
    },
    correlationId: row.correlationId,
  };
  return PreparedExperienceCompositionSchema.parse({ state: row.state, items: [item] });
}

export class ExperienceOrchestrationWorkerLifecycle {
  private runtime:
    Awaited<ReturnType<typeof createExperienceOrchestrationWorkerComposition>> | undefined;
  private readonly configuration: ReturnType<
    typeof createExperienceOrchestrationWorkerConfiguration
  >;
  private readonly factory: typeof createExperienceOrchestrationWorkerComposition;

  constructor(
    configuration: ReturnType<typeof createExperienceOrchestrationWorkerConfiguration>,
    factory: typeof createExperienceOrchestrationWorkerComposition,
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

Inject(EXPERIENCE_ORCHESTRATION_WORKER_CONFIGURATION)(
  ExperienceOrchestrationWorkerLifecycle,
  undefined,
  0,
);
Inject(EXPERIENCE_ORCHESTRATION_WORKER_FACTORY)(
  ExperienceOrchestrationWorkerLifecycle,
  undefined,
  1,
);
Injectable()(ExperienceOrchestrationWorkerLifecycle);

export class ExperienceOrchestrationWorkerModule {}

Module({
  providers: [
    {
      provide: EXPERIENCE_ORCHESTRATION_WORKER_CONFIGURATION,
      useFactory: createExperienceOrchestrationWorkerConfiguration,
    },
    {
      provide: EXPERIENCE_ORCHESTRATION_WORKER_FACTORY,
      useValue: createExperienceOrchestrationWorkerComposition,
    },
    ExperienceOrchestrationWorkerLifecycle,
  ],
  exports: [ExperienceOrchestrationWorkerLifecycle],
})(ExperienceOrchestrationWorkerModule);
