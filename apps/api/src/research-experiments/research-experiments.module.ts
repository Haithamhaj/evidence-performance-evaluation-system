import { S3Client } from "@aws-sdk/client-s3";
import { AppError } from "@evaluation/contracts";
import {
  createRuntimeAiRouter,
  EnvironmentAiCredentialSecretResolver,
} from "@evaluation/ai-routing";
import { databaseAuditWriter } from "@evaluation/audit";
import { ResearchSourceIntakeReader } from "@evaluation/connected-work-context";
import { ResearchCriterionProposalReader } from "@evaluation/criteria";
import { createDatabaseClient, type DatabaseTransaction } from "@evaluation/database";
import {
  DocumentAnalysisSourceLoader,
  parseDocumentRuntimeConfig,
  ProgressContractDraftSourceLocator,
  ProgressContractDraftSourceReader,
  ResearchDocumentSourceReader,
  S3PrivateStorage,
} from "@evaluation/documents";
import {
  createProjectService,
  DocumentResourceReader,
  ResearchProjectContextReader,
} from "@evaluation/projects";
import {
  AppliedLearningService,
  composeProjectContextSnapshot,
  ExperimentQueryService,
  ExperimentService,
  ResearchAiAssistant,
  ResearchDecisionService,
  ResearchEvidenceLinkService,
  ResearchProposalConfirmationService,
  ResearchQueryService,
  ResearchService,
  ResearchSourceReviewPersistence,
  ResearchSourceReviewService,
  SourceRetriever,
} from "@evaluation/research-experiments";
import {
  ActivityReader,
  ConfirmedResearchEvidenceReader,
  PrismaEvidenceScopeReader,
} from "@evaluation/updates-evidence";
import {
  ConfirmedTaskCreatorAdapter,
  ResearchWorkItemReader,
  WorkItemService,
} from "@evaluation/work-items";
import { Module } from "@nestjs/common";

import { createDeferredRuntimeAiRouter } from "../ai-routing/deferred-runtime-ai-router.js";
import { resolveSystemAiScopeId } from "../ai-routing/system-ai-scope.js";
import { AuthModule } from "../auth/auth.module.js";
import {
  CONNECTED_WORK_PROTECTOR,
  ConnectedWorkContextModule,
} from "../connected-work-context/connected-work-context.module.js";
import { ExperimentsController } from "./experiments.controller.js";
import { ResearchRecordsController } from "./research-records.controller.js";
import { ResearchExperimentsPolicyGuard } from "./research-experiments-policy.guard.js";
import { SourceReviewsController } from "./source-reviews.controller.js";

const RESEARCH_DATABASE = Symbol("RESEARCH_DATABASE");
const RESEARCH_DATABASE_LIFECYCLE = Symbol("RESEARCH_DATABASE_LIFECYCLE");
const RESEARCH_RUNTIME = Symbol("RESEARCH_RUNTIME");
const RESEARCH_RUNTIME_LIFECYCLE = Symbol("RESEARCH_RUNTIME_LIFECYCLE");
const RESEARCH_ROUTE_KEY = "research.source-review.v1";

type Database = ReturnType<typeof createDatabaseClient>;
type Actor = Readonly<{ userId: string; active: boolean }>;

type Runtime = Readonly<{
  sourceReviews: ResearchSourceReviewService;
  research: ResearchService;
  researchQuery: ResearchQueryService;
  experiments: ExperimentService;
  experimentQuery: ExperimentQueryService;
  decisions: ResearchDecisionService;
  learning: AppliedLearningService;
  evidence: ResearchEvidenceLinkService;
  proposals: ResearchProposalConfirmationService;
  destroy: () => void;
}>;

export class ResearchExperimentsModule {}

Module({
  imports: [AuthModule, ConnectedWorkContextModule],
  controllers: [SourceReviewsController, ResearchRecordsController, ExperimentsController],
  providers: [
    {
      provide: RESEARCH_DATABASE,
      useFactory: () => createDatabaseClient(databaseUrl()),
    },
    {
      provide: RESEARCH_DATABASE_LIFECYCLE,
      useFactory: (database: Database) => ({ onModuleDestroy: () => database.$disconnect() }),
      inject: [RESEARCH_DATABASE],
    },
    {
      provide: RESEARCH_RUNTIME,
      useFactory: (
        database: Database,
        protector: import("@evaluation/connected-work-context").PrivateContextProtector,
      ) => createResearchRuntime(database, protector),
      inject: [RESEARCH_DATABASE, CONNECTED_WORK_PROTECTOR],
    },
    {
      provide: RESEARCH_RUNTIME_LIFECYCLE,
      useFactory: (runtime: Runtime) => ({ onModuleDestroy: () => runtime.destroy() }),
      inject: [RESEARCH_RUNTIME],
    },
    bind(ResearchSourceReviewService, "sourceReviews"),
    bind(ResearchService, "research"),
    bind(ResearchQueryService, "researchQuery"),
    bind(ExperimentService, "experiments"),
    bind(ExperimentQueryService, "experimentQuery"),
    bind(ResearchDecisionService, "decisions"),
    bind(AppliedLearningService, "learning"),
    bind(ResearchEvidenceLinkService, "evidence"),
    bind(ResearchProposalConfirmationService, "proposals"),
    ResearchExperimentsPolicyGuard,
  ],
})(ResearchExperimentsModule);

function bind<T>(token: new (...arguments_: never[]) => T, key: keyof Runtime) {
  return {
    provide: token,
    useFactory: (runtime: Runtime) => runtime[key],
    inject: [RESEARCH_RUNTIME],
  };
}

async function createResearchRuntime(
  database: Database,
  protector: import("@evaluation/connected-work-context").PrivateContextProtector,
): Promise<Runtime> {
  const config = parseDocumentRuntimeConfig(process.env);
  const s3 = new S3Client({
    credentials: {
      accessKeyId: config.storage.accessKeyId,
      secretAccessKey: config.storage.secretAccessKey,
    },
    endpoint: config.storage.endpoint,
    forcePathStyle: true,
    region: config.storage.region,
  });
  const storage = new S3PrivateStorage(s3, config.storage.bucket);
  const identity = new DocumentResourceReader(database);
  const loader = new DocumentAnalysisSourceLoader(database, storage, {
    maxSourceBytes: Math.max(
      config.policy.maxBytesByClass.text,
      config.policy.maxBytesByClass.office,
    ),
  });
  const locator = new ProgressContractDraftSourceLocator(database, identity);
  const documentSources = new ProgressContractDraftSourceReader(database, identity, loader, {
    maxSourceBytes: Math.max(
      config.policy.maxBytesByClass.text,
      config.policy.maxBytesByClass.office,
    ),
    maxArchiveEntries: config.policy.maxArchiveEntries,
    maxArchiveUncompressedBytes: config.policy.maxArchiveUncompressedBytes,
    maxArchiveCompressionRatio: config.policy.maxArchiveCompressionRatio,
    maxQuotedCharacters: Math.max(
      config.policy.maxBytesByClass.text,
      config.policy.maxBytesByClass.office,
    ),
  });
  const documents = new ResearchDocumentSourceReader(locator, documentSources);
  const workItems = new ResearchWorkItemReader(database);
  const authorizer = new ResearchProjectContextReader(database, workItems);
  const projectContexts = new ProjectContextAdapter(authorizer, workItems);
  const router = createDeferredRuntimeAiRouter(() =>
    createRuntimeAiRouter({
      database,
      secretResolver: new EnvironmentAiCredentialSecretResolver(),
    }),
  );
  const assistant = new ResearchAiAssistant<DatabaseTransaction>({
    router,
    promptArtifacts: {
      read: (routeKey, version) =>
        database.analysisPromptArtifact.findUnique({
          where: { routeKey_version: { routeKey, version } },
          select: { id: true, routeKey: true, version: true, bodyHash: true, trustedBody: true },
        }),
    },
    aiRuns: {
      readSucceeded: async (runId) => {
        const row = await database.aiRun.findUnique({ where: { id: runId } });
        if (row === null || row.state !== "succeeded") return null;
        return {
          id: row.id,
          routeKey: row.routeKey,
          routeConfigId: row.routeConfigId,
          routeConfigVersion: row.routeConfigVersion,
          outputSchemaVersion: row.outputSchemaVersion,
          promptTemplateVersion: row.promptTemplateVersion,
          sourceReferences: stringArray(row.sourceReferences),
          outputReference: row.outputReference,
          state: "succeeded" as const,
        };
      },
    },
  });
  const systemId = await resolveSystemAiScopeId(database, RESEARCH_ROUTE_KEY);
  const auditWriter = databaseAuditWriter as never;
  const sourceReviews = new ResearchSourceReviewService({
    persistence: new ResearchSourceReviewPersistence(database),
    authorizer,
    projectContexts,
    retriever: new SourceRetriever(),
    connectedSources: new ResearchSourceIntakeReader(database, protector),
    documents,
    assistant,
    protector,
    systemId,
  });
  const sourceValidator = {
    validateConfirmedReview: async (
      transaction: DatabaseTransaction,
      input: Readonly<{ actor: Actor; projectId: string; sourceReviewId: string }>,
    ) => {
      const review = await transaction.researchSourceReview.findFirst({
        where: {
          id: input.sourceReviewId,
          ownerId: input.actor.userId,
          projectId: input.projectId,
          state: "CONFIRMED",
        },
        select: { id: true, projectId: true },
      });
      if (review === null) throw sourceInvalid();
      return { sourceReviewId: review.id, projectId: review.projectId };
    },
    validateApprovedDocument: async (
      _transaction: DatabaseTransaction,
      input: Readonly<{
        actor: Actor;
        projectId: string;
        documentVersionId: string;
      }>,
    ) => {
      const source = await documents.readApprovedVersion(input);
      return { documentVersionId: source.documentVersionId, projectId: source.projectId };
    },
  };
  const research = new ResearchService({
    database,
    authorizer,
    auditWriter,
    sourceValidator,
    assistant,
    systemId,
  });
  const experiments = new ExperimentService({
    database,
    authorizer,
    auditWriter,
    assistant,
    systemId,
  });
  const activity = new ActivityReader(database);
  const projectService = createProjectService(database, auditWriter);
  const workItemCommands = new WorkItemService(
    database,
    auditWriter,
    () => new Date(),
    projectService,
  );
  return {
    sourceReviews,
    research,
    researchQuery: new ResearchQueryService({ database, authorizer }),
    experiments,
    experimentQuery: new ExperimentQueryService({ database, authorizer }),
    decisions: new ResearchDecisionService({ database, authorizer, auditWriter }),
    learning: new AppliedLearningService({
      database,
      authorizer,
      auditWriter,
      targetReaders: {
        workItem: workItems,
        update: {
          getConfirmedUpdate: async ({ actor, projectId, updateId }) => {
            const update = await activity.updateResult({
              actorId: actor.userId,
              acceptedEventId: updateId,
            });
            if (!actor.active || update.project.id !== projectId) throw sourceInvalid();
            return { id: updateId, projectId };
          },
        },
        document: documents,
        progressContractProposal: new ProgressProposalAdapter(authorizer),
        criterionProposal: new ResearchCriterionProposalReader(database, authorizer),
      },
    }),
    evidence: new ResearchEvidenceLinkService({
      database,
      authorizer,
      auditWriter,
      evidenceReader: new ConfirmedResearchEvidenceReader(
        database,
        new PrismaEvidenceScopeReader(),
      ),
    }),
    proposals: new ResearchProposalConfirmationService({
      database,
      authorizer,
      auditWriter,
      confirmedTaskCreator: new ConfirmedTaskCreatorAdapter(workItemCommands),
    }),
    destroy: () => s3.destroy(),
  };
}

class ProjectContextAdapter {
  private readonly projects: ResearchProjectContextReader;
  private readonly workItems: ResearchWorkItemReader;

  constructor(projects: ResearchProjectContextReader, workItems: ResearchWorkItemReader) {
    this.projects = projects;
    this.workItems = workItems;
  }

  async readAuthorizedSnapshot(
    input: Readonly<{
      actor: Actor;
      scope: import("@evaluation/contracts").ResearchScope;
      at: Date;
    }>,
  ) {
    await this.projects.authorize(input);
    const context = await this.projects.readAuthorizedContext({
      actor: input.actor,
      projectId: input.scope.projectId,
      at: input.at,
    });
    const allItems = await this.workItems.listAuthorizedProjectItems({
      actor: input.actor,
      projectId: input.scope.projectId,
      at: input.at,
    });
    const workstreams = context.workstreams.filter(
      ({ id }) => input.scope.workstreamId === null || id === input.scope.workstreamId,
    );
    const items = allItems.filter(
      ({ id, workstreamId }) =>
        (input.scope.workstreamId === null || workstreamId === input.scope.workstreamId) &&
        (input.scope.workItemId === null || id === input.scope.workItemId),
    );
    const contractReferences =
      context.activeContract === null
        ? []
        : [
            context.activeContract.sourceReference,
            ...context.activeContract.components.map(({ sourceReference }) => sourceReference),
            ...context.activeContract.rules.map(({ sourceReference }) => sourceReference),
          ];
    return composeProjectContextSnapshot({
      generatedAt: input.at,
      projectId: context.projectId,
      projectName: context.name,
      projectVersion: context.projectVersion,
      projectContentIdentitySha256: context.projectContentIdentitySha256,
      projectSourceReference: context.projectSourceReference,
      projectContentIdentityReference: context.projectContentIdentityReference,
      sourceReferences: [
        context.projectSourceReference,
        context.projectContentIdentityReference,
        ...workstreams.flatMap(({ sourceReference, contentIdentityReference }) => [
          sourceReference,
          contentIdentityReference,
        ]),
        ...items.flatMap(({ sourceReference, contentIdentityReference }) => [
          sourceReference,
          contentIdentityReference,
        ]),
        ...contractReferences,
      ],
      objective: context.objective,
      constraints:
        context.activeContract?.components.flatMap(
          ({ acceptanceConditions }) => acceptanceConditions,
        ) ?? [],
      deliverables:
        context.activeContract?.components
          .filter(({ kind }) => kind === "deliverable")
          .map(({ name }) => name) ?? [],
      operationalKpis:
        context.activeContract?.components
          .filter(({ kind }) => kind === "kpi")
          .map(({ name }) => name) ?? [],
      workstreams,
      workItems: items,
      decisions: [],
    });
  }
}

class ProgressProposalAdapter {
  private readonly projects: ResearchProjectContextReader;

  constructor(projects: ResearchProjectContextReader) {
    this.projects = projects;
  }

  async getProspectiveProgressProposal(
    input: Readonly<{ actor: Actor; projectId: string; proposalId: string }>,
  ) {
    const context = await this.projects.readAuthorizedContext({
      actor: input.actor,
      projectId: input.projectId,
      at: new Date(),
    });
    const proposal = context.prospectiveProgressProposals.find(
      ({ proposalId }) => proposalId === input.proposalId,
    );
    if (proposal === undefined) throw sourceInvalid();
    return proposal;
  }
}

function databaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL must be configured");
  return value;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : [];
}

function sourceInvalid(): AppError {
  return new AppError("RESEARCH_SOURCE_INVALID", "errors.research.sourceInvalid", 409);
}
