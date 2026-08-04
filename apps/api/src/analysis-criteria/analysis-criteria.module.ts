import { databaseAuditWriter } from "@evaluation/audit";
import {
  ActivationService,
  CriteriaVersionResolver,
  CriteriaWorkspaceQueryService,
  ProposalService,
  RevisionService,
  WorkstreamReviewService,
} from "@evaluation/criteria";
import { createDatabaseClient } from "@evaluation/database";
import { ComparisonService, CriteriaDocumentReader, ReadinessService } from "@evaluation/documents";
import { decide } from "@evaluation/permissions";
import { CriteriaReviewReader, DocumentResourceReader } from "@evaluation/projects";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { AnalysisCriteriaAuthenticationGuard } from "./analysis-criteria-authentication.guard.js";
import {
  ANALYSIS_CRITERIA_POLICY_DATABASE,
  AnalysisCriteriaPolicyGuard,
} from "./analysis-criteria-policy.guard.js";
import { createAnalysisQueueProducer } from "./analysis-queue-producer.js";
import { AnalysisJobEnqueuer } from "./analysis-job-enqueuer.js";
import {
  AnalysisOutboxDispatcher,
  AnalysisOutboxDispatcherLifecycle,
  analysisOutboxReconcileInterval,
} from "./analysis-outbox-dispatcher.js";
import { CriteriaController } from "./criteria.controller.js";
import { DocumentAnalysisController } from "./document-analysis.controller.js";

export const ANALYSIS_CRITERIA_DATABASE = Symbol("ANALYSIS_CRITERIA_DATABASE");
export const ANALYSIS_CRITERIA_QUEUE = Symbol("ANALYSIS_CRITERIA_QUEUE");
const ANALYSIS_CRITERIA_LIFECYCLE = Symbol("ANALYSIS_CRITERIA_LIFECYCLE");

type Database = ReturnType<typeof createDatabaseClient>;
type AnalysisQueue = ReturnType<typeof createAnalysisQueueProducer>;

function requiredEnvironment(name: "DATABASE_URL" | "REDIS_URL"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured`);
  return value;
}

function unavailableProcessingDependency(): never {
  throw new Error("AI processing dependencies are available only in the worker");
}

function analysisOptions() {
  return {
    systemId: "00000000-0000-4000-8000-000000000000",
    timeoutMs: 30_000,
    extractionPolicy: {
      maxSourceBytes: 1,
      maxArchiveEntries: 1,
      maxArchiveUncompressedBytes: 1,
      maxArchiveCompressionRatio: 1,
    },
    execution: { heartbeatMs: 5_000, leaseMs: 90_000, maxAttempts: 3 },
  } as const;
}

export function createTransactionalAnalysisOutbox() {
  return {
    append(
      transaction: Readonly<{
        operationEffectReceipt: {
          create(input: unknown): Promise<unknown>;
        };
      }>,
      input: Readonly<{
        operationId: string;
        idempotencyKey: string;
        jobType: string;
      }>,
    ) {
      return transaction.operationEffectReceipt.create({
        data: {
          operationId: input.operationId,
          effectName: "outbox-enqueued",
          idempotencyKey: `outbox:${input.idempotencyKey}`,
          receiptReference: `${input.jobType}:${input.operationId}`,
        },
      });
    },
  };
}

class ApiCriteriaPolicyAuthorizer {
  private readonly database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  async authorize(
    input: Readonly<{
      actor: Readonly<{ userId: string; active: boolean }>;
      action: "criteria.contributor.respond" | "criteria.manager.resolve";
      resource: Readonly<Record<string, unknown>>;
    }>,
  ): Promise<boolean> {
    const roles = await this.database.roleAssignment.findMany({
      where: { userId: input.actor.userId },
      select: { role: true, scopeType: true, scopeId: true },
    });
    let resource = input.resource;
    if (input.action === "criteria.manager.resolve") {
      const departmentId = String(input.resource.departmentId);
      const scope = await this.database.authorizationScope.findFirst({
        where: { departmentId, scopeType: "department" },
        select: { id: true },
      });
      if (scope === null) return false;
      resource = { ...input.resource, departmentId: scope.id };
    }
    return decide(
      { subjectId: input.actor.userId, active: input.actor.active, roles },
      input.action,
      resource as import("@evaluation/permissions").PolicyResource,
      { now: new Date().toISOString(), responsibilityWindows: [] },
    ).allowed;
  }
}

class ApiCriteriaWorkspacePolicy {
  private readonly database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  async allows(
    input: Parameters<import("@evaluation/criteria").CriteriaWorkspacePolicy["allows"]>[0],
  ): Promise<boolean> {
    const now = new Date();
    const [user, roles, departmentScope, windows] = await Promise.all([
      this.database.user.findUnique({
        where: { id: input.actor.userId },
        select: { active: true },
      }),
      this.database.roleAssignment.findMany({
        where: { userId: input.actor.userId },
        select: { role: true, scopeType: true, scopeId: true },
      }),
      this.database.authorizationScope.findFirst({
        where: { departmentId: input.identity.departmentId, scopeType: "department" },
        select: { id: true },
      }),
      this.database.responsibilityWindow.findMany({
        where: {
          employeeId: input.actor.userId,
          OR: [
            { projectId: input.identity.projectId },
            ...(input.identity.kind === "workstream"
              ? [{ workstreamId: input.identity.resourceId }]
              : []),
          ],
        },
        select: {
          projectId: true,
          workstreamId: true,
          responsibilityType: true,
          startsAt: true,
          endsAt: true,
        },
      }),
    ]);
    if (user === null || !user.active || !input.actor.active || departmentScope === null) {
      return false;
    }
    const resource =
      input.action === "criteria.contributor.respond" && input.reviewSnapshotId !== null
        ? {
            kind: "criteriaReviewSnapshot" as const,
            reviewSnapshotId: input.reviewSnapshotId,
            workstreamId: input.identity.resourceId,
            projectId: input.identity.projectId,
            departmentId: departmentScope.id,
          }
        : input.identity.kind === "project"
          ? {
              kind: "project" as const,
              projectId: input.identity.resourceId,
              departmentId: departmentScope.id,
            }
          : {
              kind: "workstream" as const,
              workstreamId: input.identity.resourceId,
              projectId: input.identity.projectId,
              departmentId: departmentScope.id,
            };
    return decide({ subjectId: input.actor.userId, active: true, roles }, input.action, resource, {
      now: now.toISOString(),
      responsibilityWindows: windows.map((window) => ({
        subjectId: input.actor.userId,
        scopeType: window.workstreamId === null ? ("project" as const) : ("workstream" as const),
        scopeId: window.workstreamId ?? window.projectId!,
        ...(window.workstreamId === null ? {} : { projectId: input.identity.projectId }),
        responsibilityType: window.responsibilityType,
        startsAt: window.startsAt.toISOString(),
        endsAt: window.endsAt?.toISOString() ?? null,
      })),
    }).allowed;
  }
}

export function createAnalysisCriteriaApiServices(
  database: Database,
  queue: Pick<AnalysisQueue, "enqueue">,
) {
  const documentReader = new DocumentResourceReader(database);
  const criteriaDocumentReader = new CriteriaDocumentReader(database);
  const criteriaReviewReader = new CriteriaReviewReader(database);
  const jobs = new AnalysisJobEnqueuer(database as never, queue);
  const dispatcher = new AnalysisOutboxDispatcher(database as never, jobs);
  const enqueue = (receipt: Readonly<{ requestId: string; operationId: string }>) =>
    jobs.enqueueAfterCommit(receipt);
  const processingOnly = {
    load: async () => unavailableProcessingDependency(),
    run: async () => unavailableProcessingDependency(),
  };
  const options = analysisOptions();
  const reviews = new WorkstreamReviewService(
    database,
    databaseAuditWriter as never,
    new ApiCriteriaPolicyAuthorizer(database),
    criteriaDocumentReader,
  );
  const outbox = createTransactionalAnalysisOutbox();
  return {
    jobs,
    dispatcher,
    readiness: new ReadinessService(
      database,
      documentReader,
      processingOnly as never,
      processingOnly as never,
      databaseAuditWriter as never,
      enqueue,
      options,
    ),
    comparisons: new ComparisonService(
      database,
      documentReader,
      processingOnly as never,
      processingOnly as never,
      databaseAuditWriter as never,
      enqueue,
      options,
    ),
    proposals: new ProposalService(
      database,
      criteriaDocumentReader,
      criteriaReviewReader,
      processingOnly as never,
      processingOnly as never,
      databaseAuditWriter as never,
      outbox,
      reviews,
      options,
    ),
    reviews,
    activation: new ActivationService(
      database,
      databaseAuditWriter as never,
      criteriaDocumentReader,
      criteriaReviewReader,
    ),
    revisions: new RevisionService(
      database,
      criteriaDocumentReader,
      criteriaReviewReader,
      databaseAuditWriter as never,
      outbox,
    ),
    versions: new CriteriaVersionResolver(database),
    workspace: new CriteriaWorkspaceQueryService(
      database,
      documentReader,
      criteriaDocumentReader,
      new ApiCriteriaWorkspacePolicy(database),
    ),
  };
}

export function createAnalysisCriteriaApiLifecycle(
  database: Pick<Database, "$disconnect">,
  queue: Pick<AnalysisQueue, "close">,
  dispatcher: Pick<AnalysisOutboxDispatcher, "scanOnce">,
  intervalMs = analysisOutboxReconcileInterval(),
  timers?: import("./analysis-outbox-dispatcher.js").TimerPort,
) {
  const reconciliation = new AnalysisOutboxDispatcherLifecycle(dispatcher, intervalMs, timers);
  return {
    onApplicationBootstrap: () => reconciliation.onApplicationBootstrap(),
    async onApplicationShutdown() {
      reconciliation.onApplicationShutdown();
      await queue.close();
      await database.$disconnect();
    },
  };
}

const ANALYSIS_CRITERIA_SERVICES = Symbol("ANALYSIS_CRITERIA_SERVICES");

export class AnalysisCriteriaModule {}

Module({
  imports: [AuthModule],
  controllers: [DocumentAnalysisController, CriteriaController],
  providers: [
    {
      provide: ANALYSIS_CRITERIA_DATABASE,
      useFactory: () => createDatabaseClient(requiredEnvironment("DATABASE_URL")),
    },
    {
      provide: ANALYSIS_CRITERIA_POLICY_DATABASE,
      useFactory: (database: Database) => database,
      inject: [ANALYSIS_CRITERIA_DATABASE],
    },
    {
      provide: ANALYSIS_CRITERIA_QUEUE,
      useFactory: () => createAnalysisQueueProducer(requiredEnvironment("REDIS_URL")),
    },
    {
      provide: ANALYSIS_CRITERIA_SERVICES,
      useFactory: (database: Database, queue: AnalysisQueue) =>
        createAnalysisCriteriaApiServices(database, queue),
      inject: [ANALYSIS_CRITERIA_DATABASE, ANALYSIS_CRITERIA_QUEUE],
    },
    serviceProvider(AnalysisJobEnqueuer, "jobs"),
    serviceProvider(AnalysisOutboxDispatcher, "dispatcher"),
    serviceProvider(ReadinessService, "readiness"),
    serviceProvider(ComparisonService, "comparisons"),
    serviceProvider(ProposalService, "proposals"),
    serviceProvider(WorkstreamReviewService, "reviews"),
    serviceProvider(ActivationService, "activation"),
    serviceProvider(RevisionService, "revisions"),
    serviceProvider(CriteriaVersionResolver, "versions"),
    serviceProvider(CriteriaWorkspaceQueryService, "workspace"),
    {
      provide: ANALYSIS_CRITERIA_LIFECYCLE,
      useFactory: (
        database: Database,
        queue: AnalysisQueue,
        dispatcher: AnalysisOutboxDispatcher,
      ) => createAnalysisCriteriaApiLifecycle(database, queue, dispatcher),
      inject: [ANALYSIS_CRITERIA_DATABASE, ANALYSIS_CRITERIA_QUEUE, AnalysisOutboxDispatcher],
    },
    AnalysisCriteriaAuthenticationGuard,
    AnalysisCriteriaPolicyGuard,
  ],
})(AnalysisCriteriaModule);

function serviceProvider(
  provide: import("@nestjs/common").InjectionToken,
  key: string,
): import("@nestjs/common").FactoryProvider {
  return {
    provide,
    useFactory: (services: Record<string, unknown>) => services[key],
    inject: [ANALYSIS_CRITERIA_SERVICES],
  };
}
