import { S3Client } from "@aws-sdk/client-s3";
import { Injectable, Inject, Module } from "@nestjs/common";

import { databaseAuditWriter } from "@evaluation/audit";
import { AppError } from "@evaluation/contracts";
import { ProposalService } from "@evaluation/criteria";
import { createDatabaseClient } from "@evaluation/database";
import {
  ComparisonService,
  CriteriaDocumentReader,
  DocumentAnalysisSourceLoader,
  ReadinessService,
  S3PrivateStorage,
  extractSafeSources,
  parseDocumentRuntimeConfig,
} from "@evaluation/documents";
import { CriteriaReviewReader, DocumentResourceReader } from "@evaluation/projects";

import { AnalysisCriteriaProcessor } from "./analysis-criteria.processor.js";
import { createAnalysisCriteriaQueueRuntime } from "./analysis-criteria-queue-runtime.js";
import { CriteriaAnalysisPhaseHandler } from "./criteria-analysis-phase-handler.js";
import { PrismaCriteriaPhaseSnapshotReader } from "./criteria-phase-snapshot-reader.js";
import {
  createWorkerRuntimeAiRouter,
  WorkerEnvironmentAiCredentialSecretResolver,
} from "./runtime-ai-router.provider.js";

type Database = ReturnType<typeof createDatabaseClient>;
type Environment = Readonly<Record<string, string | undefined>>;

export type AnalysisCriteriaWorkerConfiguration = Readonly<{
  databaseUrl: string;
  redisUrl: string;
  environment: Environment;
}>;

export type AnalysisCriteriaWorkerComposition = Readonly<{
  start(): Promise<void>;
  close(): Promise<void>;
  isHealthy(): boolean;
}>;

export const ANALYSIS_CRITERIA_WORKER_CONFIGURATION = Symbol(
  "ANALYSIS_CRITERIA_WORKER_CONFIGURATION",
);
export const ANALYSIS_CRITERIA_WORKER_FACTORY = Symbol("ANALYSIS_CRITERIA_WORKER_FACTORY");

export type AnalysisCriteriaWorkerFactory = (
  configuration: AnalysisCriteriaWorkerConfiguration,
) => Promise<AnalysisCriteriaWorkerComposition>;

export function createAnalysisCriteriaWorkerConfiguration(
  environment: Environment = process.env,
): AnalysisCriteriaWorkerConfiguration | undefined {
  const databaseUrl = environment.DATABASE_URL?.trim();
  const redisUrl = environment.REDIS_URL?.trim();
  if (!databaseUrl || !redisUrl || environment.WORKER_JOB_TYPE !== "analysis-criteria.process")
    return undefined;
  return { databaseUrl, redisUrl, environment };
}

export async function createAnalysisCriteriaWorkerComposition(
  configuration: AnalysisCriteriaWorkerConfiguration,
): Promise<AnalysisCriteriaWorkerComposition> {
  const database = createDatabaseClient(configuration.databaseUrl);
  const documentConfig = parseDocumentRuntimeConfig(configuration.environment);
  const s3 = new S3Client({
    credentials: {
      accessKeyId: documentConfig.storage.accessKeyId,
      secretAccessKey: documentConfig.storage.secretAccessKey,
    },
    endpoint: documentConfig.storage.endpoint,
    forcePathStyle: true,
    region: documentConfig.storage.region,
  });
  try {
    const router = await createWorkerRuntimeAiRouter(
      database,
      new WorkerEnvironmentAiCredentialSecretResolver(configuration.environment),
    );
    const extractionPolicy = {
      maxSourceBytes: Math.max(
        documentConfig.policy.maxBytesByClass.text,
        documentConfig.policy.maxBytesByClass.office,
      ),
      maxArchiveEntries: documentConfig.policy.maxArchiveEntries,
      maxArchiveUncompressedBytes: documentConfig.policy.maxArchiveUncompressedBytes,
      maxArchiveCompressionRatio: documentConfig.policy.maxArchiveCompressionRatio,
    };
    const storage = new S3PrivateStorage(s3, documentConfig.storage.bucket);
    const canonicalLoader = new DocumentAnalysisSourceLoader(database, storage, extractionPolicy);
    const documentReader = new DocumentResourceReader(database);
    const criteriaDocumentReader = new CriteriaDocumentReader(database);
    const criteriaReviewReader = new CriteriaReviewReader(database);
    const criteriaSourceLoader = new WorkerCriteriaSourceLoader(canonicalLoader, extractionPolicy);
    const execution = {
      heartbeatMs: positiveInteger(configuration.environment, "ANALYSIS_HEARTBEAT_MS", 5_000),
      leaseMs: positiveInteger(configuration.environment, "ANALYSIS_LEASE_MS", 90_000),
      maxAttempts: positiveInteger(configuration.environment, "ANALYSIS_MAX_ATTEMPTS", 3),
    };
    const timeoutMs = positiveInteger(
      configuration.environment,
      "ANALYSIS_ROUTER_TIMEOUT_MS",
      30_000,
    );
    const systemId = required(configuration.environment, "SYSTEM_ID");
    const noEnqueue = async () => undefined;
    const readiness = new ReadinessService(
      database,
      documentReader,
      canonicalLoader,
      router,
      databaseAuditWriter as never,
      noEnqueue,
      {
        systemId,
        timeoutMs,
        extractionPolicy,
        execution,
      },
    );
    const comparison = new ComparisonService(
      database,
      documentReader,
      canonicalLoader,
      router,
      databaseAuditWriter as never,
      noEnqueue,
      {
        systemId,
        timeoutMs,
        extractionPolicy,
        execution,
      },
    );
    const proposal = new ProposalService(
      database,
      criteriaDocumentReader,
      criteriaReviewReader,
      criteriaSourceLoader,
      router as never,
      databaseAuditWriter as never,
      { append: async () => undefined },
      { publish: async () => unsupportedReviewAction() } as never,
      { systemId, timeoutMs },
    );
    const criteria = new CriteriaAnalysisPhaseHandler(
      database,
      proposal,
      router,
      new PrismaCriteriaPhaseSnapshotReader(criteriaDocumentReader, criteriaReviewReader),
      { systemId, timeoutMs, execution },
    );
    const processor = new AnalysisCriteriaProcessor(database, {
      readiness,
      comparison,
      criteria,
    });
    const queue = createAnalysisCriteriaQueueRuntime({
      redisUrl: configuration.redisUrl,
      processor,
    });
    return lifecycle(queue, database, s3);
  } catch (error) {
    s3.destroy();
    await database.$disconnect();
    throw error;
  }
}

class WorkerCriteriaSourceLoader {
  private readonly loader: DocumentAnalysisSourceLoader;
  private readonly policy: {
    maxSourceBytes: number;
    maxArchiveEntries: number;
    maxArchiveUncompressedBytes: number;
    maxArchiveCompressionRatio: number;
  };

  constructor(
    loader: DocumentAnalysisSourceLoader,
    policy: {
      maxSourceBytes: number;
      maxArchiveEntries: number;
      maxArchiveUncompressedBytes: number;
      maxArchiveCompressionRatio: number;
    },
  ) {
    this.loader = loader;
    this.policy = policy;
  }

  async load(input: Readonly<{ documentVersionId: string }>) {
    const canonical = await this.loader.load(input);
    const extracted = await extractSafeSources({
      policy: this.policy,
      sources: canonical.sources,
    });
    if (
      extracted.coverage !== "complete" ||
      extracted.sources.some(
        (source) => source.coverage !== "complete" || source.contentBase64 === undefined,
      )
    ) {
      throw new AppError(
        "DOCUMENT_EXTRACTION_INCOMPLETE",
        "errors.documents.extractionIncomplete",
        409,
      );
    }
    return {
      sources: extracted.sources.map((source) => ({
        reference: source.reference,
        mediaType: source.mediaType,
        contentBase64: source.contentBase64!,
      })),
    };
  }
}

function lifecycle(
  queue: import("./analysis-criteria-queue-runtime.js").AnalysisCriteriaQueueRuntime,
  database: Database,
  s3: S3Client,
): AnalysisCriteriaWorkerComposition {
  return {
    start: () => queue.start(),
    isHealthy: () => queue.isHealthy(),
    async close() {
      await queue.close();
      s3.destroy();
      await database.$disconnect();
    },
  };
}

function required(environment: Environment, key: string): string {
  const value = environment[key]?.trim();
  if (!value) throw new Error(`${key} must be configured`);
  return value;
}

function positiveInteger(environment: Environment, key: string, fallback: number): number {
  const raw = environment[key];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error(`${key} must be a positive integer`);
  return value;
}

function unsupportedReviewAction(): never {
  throw new Error("Review actions are not available in the analysis worker");
}

export class AnalysisCriteriaWorkerLifecycle {
  private composition: AnalysisCriteriaWorkerComposition | undefined;
  private readonly configuration: AnalysisCriteriaWorkerConfiguration | undefined;
  private readonly createComposition: AnalysisCriteriaWorkerFactory;

  constructor(
    configuration: AnalysisCriteriaWorkerConfiguration | undefined,
    createComposition: AnalysisCriteriaWorkerFactory,
  ) {
    this.configuration = configuration;
    this.createComposition = createComposition;
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.configuration === undefined) return;
    this.composition = await this.createComposition(this.configuration);
    await this.composition.start();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.composition?.close();
  }

  isHealthy(): boolean {
    return this.configuration === undefined || this.composition?.isHealthy() === true;
  }
}

Inject(ANALYSIS_CRITERIA_WORKER_CONFIGURATION)(AnalysisCriteriaWorkerLifecycle, undefined, 0);
Inject(ANALYSIS_CRITERIA_WORKER_FACTORY)(AnalysisCriteriaWorkerLifecycle, undefined, 1);
Injectable()(AnalysisCriteriaWorkerLifecycle);

export class AnalysisCriteriaWorkerModule {}

Module({
  providers: [
    {
      provide: ANALYSIS_CRITERIA_WORKER_CONFIGURATION,
      useFactory: createAnalysisCriteriaWorkerConfiguration,
    },
    {
      provide: ANALYSIS_CRITERIA_WORKER_FACTORY,
      useValue: createAnalysisCriteriaWorkerComposition,
    },
    AnalysisCriteriaWorkerLifecycle,
  ],
  exports: [AnalysisCriteriaWorkerLifecycle],
})(AnalysisCriteriaWorkerModule);
