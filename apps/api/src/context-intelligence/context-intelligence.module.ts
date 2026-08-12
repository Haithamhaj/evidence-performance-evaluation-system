import { createHash } from "node:crypto";

import {
  createRuntimeAiRouter,
  EnvironmentAiCredentialSecretResolver,
} from "@evaluation/ai-routing";
import { databaseAuditWriter } from "@evaluation/audit";
import {
  ConnectedWorkConnectionService,
  ConnectedWorkContextQueryService,
} from "@evaluation/connected-work-context";
import {
  AppError,
  ContextAnalysisSchema,
  ProjectLinkSuggestionSchema,
  SourceLinkCorrectionSchema,
  TaskDraftRecordSchema,
  TaskDraftSchema,
} from "@evaluation/contracts";
import {
  CONTEXT_PROJECT_MATCH_ROUTE,
  CONTEXT_SUMMARY_ROUTE,
  ContextAnalysisService,
  ContextProjectMatchAiOutputSchema,
  ContextSummaryAiOutputSchema,
  decideProjectLink,
  ProjectAnchorReader,
  ProjectLinkSuggestionService,
  ProjectSemanticContextReader,
  TASK_DRAFT_ROUTE,
  TaskDraftService,
} from "@evaluation/context-intelligence";
import { createDatabaseClient } from "@evaluation/database";
import { DocumentProjectSemanticContextReader } from "@evaluation/documents";
import { createProjectService } from "@evaluation/projects";
import { WorkItemService } from "@evaluation/work-items";
import { Module } from "@nestjs/common";
import { z } from "zod";

import { createDeferredRuntimeAiRouter } from "../ai-routing/deferred-runtime-ai-router.js";
import { resolveSystemAiScopeId } from "../ai-routing/system-ai-scope.js";
import { AuthModule } from "../auth/auth.module.js";
import {
  CONNECTED_WORK_PROTECTOR,
  ConnectedWorkContextModule,
} from "../connected-work-context/connected-work-context.module.js";
import { DocumentsModule } from "../documents/documents.module.js";
import {
  CONTEXT_INTELLIGENCE_WORKFLOW,
  ContextAnalysisController,
} from "./context-analysis.controller.js";
import {
  CONTEXT_INTELLIGENCE_POLICY_DATABASE,
  ContextIntelligencePolicyGuard,
} from "./context-intelligence-policy.guard.js";
import { TaskDraftsController } from "./task-drafts.controller.js";

const CONTEXT_INTELLIGENCE_DATABASE = Symbol("CONTEXT_INTELLIGENCE_DATABASE");
const CONTEXT_INTELLIGENCE_DATABASE_LIFECYCLE = Symbol("CONTEXT_INTELLIGENCE_DATABASE_LIFECYCLE");
const CONTEXT_INTELLIGENCE_RUNTIME = Symbol("CONTEXT_INTELLIGENCE_RUNTIME");
const CONTEXT_INTELLIGENCE_SEMANTIC_READER = Symbol("CONTEXT_INTELLIGENCE_SEMANTIC_READER");

type Database = ReturnType<typeof createDatabaseClient>;
type Transaction = import("@evaluation/database").DatabaseTransaction;
type Protector = import("@evaluation/connected-work-context").PrivateContextProtector;
type AnalysisPersistence = import("@evaluation/context-intelligence").ContextAnalysisPersistence;
type SuggestionPersistence =
  import("@evaluation/context-intelligence").ProjectLinkSuggestionPersistence;
type DraftPersistence = import("@evaluation/context-intelligence").TaskDraftPersistence;
type Actor = Readonly<{ userId: string; active: boolean }>;
type RouteTrace = import("@evaluation/contracts").ContextIntelligenceRouteTrace;
type ContextAnalysis = import("@evaluation/contracts").ContextAnalysis;
type ProjectSuggestion = import("@evaluation/contracts").ProjectLinkSuggestion;
type TaskDraftRecord = import("@evaluation/contracts").TaskDraftRecord;

type Runtime = Readonly<{
  router: ReturnType<typeof createDeferredRuntimeAiRouter>;
  systemId: string;
}>;

type ProjectService = ReturnType<typeof createProjectService>;
type SemanticReader = ProjectSemanticContextReader;

export class ContextIntelligenceProjectAnchorAdapter {
  private readonly context: ConnectedWorkContextQueryService;
  private readonly projects: ProjectService;
  private readonly semantics: SemanticReader;

  constructor(
    context: ConnectedWorkContextQueryService,
    projects: ProjectService,
    semantics: SemanticReader,
  ) {
    this.context = context;
    this.projects = projects;
    this.semantics = semantics;
  }

  async readProjectAnchors(input: Readonly<{ employeeId: string; sourceItemId: string }>) {
    const actor = { userId: input.employeeId, active: true } as const;
    const [source, facts, projects] = await Promise.all([
      this.context.get({ actor, sourceItemId: input.sourceItemId }),
      this.context.readProjectAnchorFacts({ actor, sourceItemId: input.sourceItemId }),
      this.projects.listProjects({ actor }),
    ]);
    const sourceText = `${source.title}\n${source.summary ?? ""}`;
    const effectiveFrom = validDate(source.occurredAt);
    const records: import("@evaluation/context-intelligence").GovernedProjectAnchor[] = [];

    for (const link of facts.links) {
      records.push({
        projectId: link.projectId,
        kind: "EXPLICIT_USER_MAPPING",
        reference: `source-project-link:${link.id}`,
        conflicts: false,
        effectiveFrom: link.linkedAt,
        effectiveUntil: link.unlinkedAt,
      });
    }
    for (const correction of facts.corrections) {
      if (correction.action === "CORRECT" && correction.correctedProjectId !== null) {
        records.push({
          projectId: correction.correctedProjectId,
          kind: "PRIOR_EMPLOYEE_CORRECTION",
          reference: `source-link-correction:${correction.id}`,
          conflicts: false,
          effectiveFrom: correction.createdAt,
          effectiveUntil: null,
        });
      }
      if (correction.action === "REJECT" && correction.previousProjectId !== null) {
        records.push({
          projectId: correction.previousProjectId,
          kind: "PRIOR_EMPLOYEE_CORRECTION",
          reference: `source-link-correction:${correction.id}`,
          conflicts: true,
          effectiveFrom: correction.createdAt,
          effectiveUntil: null,
        });
      }
    }

    const semanticContexts = await Promise.all(
      projects.map(async (project) => ({
        project,
        semantic: await this.semantics.read({ actor, projectId: project.id }),
      })),
    );
    for (const { project, semantic } of semanticContexts) {
      const explicitTerms = [project.name, ...(semantic?.terminology ?? [])];
      if (explicitTerms.some((term) => containsPhrase(sourceText, term))) {
        records.push({
          projectId: project.id,
          kind: "EXPLICIT_PROJECT_REFERENCE",
          reference: `explicit-project-reference:${source.id}`,
          conflicts: false,
          effectiveFrom,
          effectiveUntil: null,
        });
      }
      if (source.provider === "GOOGLE_CALENDAR" && semantic !== null) {
        const calendarTerms = [
          ...semantic.milestones,
          ...semantic.deliverables,
          ...semantic.stakeholders,
          ...semantic.outcomes,
        ];
        if (calendarTerms.some((term) => containsPhrase(sourceText, term))) {
          records.push({
            projectId: project.id,
            kind: "CALENDAR_CONTEXT",
            reference: `calendar-context:${source.id}`,
            conflicts: false,
            effectiveFrom,
            effectiveUntil: null,
          });
        }
      }
    }
    return records.slice(0, 100);
  }
}

function containsPhrase(text: string, phrase: string): boolean {
  const normalizedPhrase = normalizeMatchText(phrase);
  return normalizedPhrase.length >= 4 && normalizeMatchText(text).includes(normalizedPhrase);
}

function normalizeMatchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}@.]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function validDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Connected source occurrence time is invalid");
  return date;
}

export class ContextIntelligenceApplicationService {
  private readonly analyses: ContextAnalysisService;
  private readonly suggestions: ProjectLinkSuggestionService;
  private readonly drafts: TaskDraftService;
  private readonly projectService: ReturnType<typeof createProjectService>;
  private readonly workItems: WorkItemService;
  private readonly analysisPersistence: PrismaContextAnalysisPersistence;
  private readonly suggestionPersistence: PrismaProjectSuggestionPersistence;
  private readonly taskDraftPersistence: PrismaTaskDraftPersistence;
  private readonly projectAnchors: ProjectAnchorReader;
  private readonly projectSemantics: ProjectSemanticContextReader;

  private readonly database: Database;
  private readonly context: ConnectedWorkContextQueryService;
  private readonly connections: ConnectedWorkConnectionService;
  private readonly protector: Protector;
  private readonly runtime: Runtime;

  constructor(
    database: Database,
    context: ConnectedWorkContextQueryService,
    connections: ConnectedWorkConnectionService,
    protector: Protector,
    runtime: Runtime,
    semanticReader?: ProjectSemanticContextReader,
  ) {
    this.database = database;
    this.context = context;
    this.connections = connections;
    this.protector = protector;
    this.runtime = runtime;
    this.projectService = createProjectService(database, databaseAuditWriter as never);
    this.projectSemantics =
      semanticReader ??
      new ProjectSemanticContextReader({
        readApprovedProjectSemanticContext: async () => null,
      });
    this.projectAnchors = new ProjectAnchorReader(
      new ContextIntelligenceProjectAnchorAdapter(
        context,
        this.projectService,
        this.projectSemantics,
      ),
      {
        canAccessProject: (employeeId, projectId) => this.canAccessProject(employeeId, projectId),
      },
    );
    this.workItems = new WorkItemService(
      database,
      databaseAuditWriter as never,
      () => new Date(),
      this.projectService,
    );
    this.analysisPersistence = new PrismaContextAnalysisPersistence(database, protector);
    this.suggestionPersistence = new PrismaProjectSuggestionPersistence(
      database,
      protector,
      context,
      connections,
    );
    this.taskDraftPersistence = new PrismaTaskDraftPersistence(database, protector);
    this.suggestions = new ProjectLinkSuggestionService({
      persistence: this.suggestionPersistence,
      projectAuthorization: {
        canLink: (employeeId, projectId) => this.canAccessProject(employeeId, projectId),
      },
      protector,
    });
    const shared = {
      router: runtime.router,
      promptArtifacts: {
        read: (routeKey: string, version: string) =>
          database.analysisPromptArtifact.findUnique({
            where: { routeKey_version: { routeKey, version } },
            select: { id: true, routeKey: true, version: true, bodyHash: true, trustedBody: true },
          }),
      },
      aiRuns: {
        readSucceeded: async (runId: string) => {
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
      protector,
      timeoutMs: 60_000,
    };
    this.analyses = new ContextAnalysisService({
      ...shared,
      analyses: this.analysisPersistence,
      suggestions: this.suggestions,
    });
    this.drafts = new TaskDraftService({
      ...shared,
      drafts: this.taskDraftPersistence,
    });
  }

  async analyze(input: { actor: Actor; sourceItemId: string; correlationId: string }) {
    const prepared = await this.prepareSource(input.actor, input.sourceItemId);
    const [projects, candidates] = await Promise.all([
      this.projectService.listProjects({ actor: input.actor }),
      this.projectAnchors.read({
        employeeId: input.actor.userId,
        sourceItemId: input.sourceItemId,
        at: new Date(),
      }),
    ]);
    const decision = decideProjectLink(candidates);
    const decisionProjectId =
      decision.kind === "AUTO_LINK"
        ? decision.projectId
        : decision.kind === "REVIEW"
          ? decision.candidates.find(({ accessible }) => accessible)?.projectId
          : undefined;
    const scopeProject =
      projects.find(({ id }) => id === (prepared.linkedProjectId ?? decisionProjectId)) ??
      projects[0];
    if (scopeProject === undefined) throw forbidden();
    const sourceReference = connectedSourceReference(input.sourceItemId);
    const semanticContexts = await this.semanticContextsForDecision(input.actor, decision);
    return this.analyses.analyze({
      actor: input.actor,
      sourceItemId: input.sourceItemId,
      departmentId: scopeProject.departmentId,
      systemId: this.runtime.systemId,
      correlationId: input.correlationId,
      sources: [
        {
          kind: prepared.item.provider === "GOOGLE_GMAIL" ? "EMAIL" : "EVENT",
          reference: sourceReference,
          mediaType: "application/json",
          content: JSON.stringify({
            title: prepared.item.title,
            summary: prepared.item.summary,
            occurredAt: prepared.item.occurredAt,
          }),
        },
      ],
      candidates,
      semanticContexts,
    });
  }

  async reviewQueue(input: { actor: Actor }) {
    assertActive(input.actor);
    return this.database.$transaction(
      async (transaction) => {
        const [suggestions, drafts] = await Promise.all([
          transaction.projectLinkSuggestion.findMany({
            where: {
              employeeId: input.actor.userId,
              reviewStatus: "PENDING",
              supersedingSuggestion: null,
            },
            include: { aiRunTrace: true },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          }),
          transaction.taskDraft.findMany({
            where: {
              employeeId: input.actor.userId,
              reviewStatus: { in: ["PENDING", "CORRECTED"] },
              supersedingTaskDraft: null,
            },
            include: { aiRunTrace: true },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          }),
        ]);
        const items: Array<Record<string, unknown>> = [];
        for (const row of suggestions) {
          if (!(await this.canReturnSource(transaction, input.actor, row.sourceItemId))) continue;
          items.push({
            kind: "PROJECT_SUGGESTION" as const,
            ...(await this.suggestionPersistence.materialize(row)),
          });
        }
        for (const row of drafts) {
          if (!(await this.canReturnSource(transaction, input.actor, row.sourceItemId))) continue;
          items.push({
            kind: "TASK_DRAFT" as const,
            ...taskDraftView(await this.taskDraftPersistence.materialize(row)),
          });
        }
        return { items };
      },
      { isolationLevel: "Serializable" },
    );
  }

  async confirmProjectSuggestion(input: {
    actor: Actor;
    suggestionId: string;
    expectedRevision: number;
    reason: string;
    correlationId: string;
  }) {
    assertActive(input.actor);
    return this.database.$transaction(
      async (transaction) => {
        await lockSuggestion(transaction, input.suggestionId);
        const row = await transaction.projectLinkSuggestion.findUnique({
          where: { id: input.suggestionId },
          include: {
            aiRunTrace: true,
            supersedingSuggestion: { include: { aiRunTrace: true } },
          },
        });
        if (row === null || row.employeeId !== input.actor.userId) throw forbidden();
        await this.context.assertAccessibleInTransaction(transaction, {
          actor: input.actor,
          sourceItemId: row.sourceItemId,
        });
        if (row.projectId === null) throw confirmationRequired();
        await this.projectService.authorizeCurrentMemberInTransaction(transaction, {
          actor: input.actor,
          projectId: row.projectId,
          at: new Date(),
        });
        if (row.supersedingSuggestion !== null) {
          if (row.supersedingSuggestion.reviewStatus !== "CONFIRMED") throw versionConflict();
          const replayReason = await openNullable(
            this.protector,
            row.supersedingSuggestion.correctionReasonCiphertext,
            row.supersedingSuggestion.correctionReasonKeyVersion,
          );
          if (replayReason !== input.reason) throw idempotencyConflict();
          return { acknowledged: true } as const;
        }
        if (row.revision !== input.expectedRevision || row.reviewStatus !== "PENDING") {
          throw versionConflict();
        }
        const current = await this.suggestionPersistence.materialize(row);
        const confirmed = ProjectLinkSuggestionSchema.parse({
          ...current,
          id: stableUuid("project-suggestion-confirmation", current.id),
          revision: current.revision + 1,
          reviewStatus: "CONFIRMED",
          revisionOrigin: "EMPLOYEE",
          correctionReason: input.reason,
          supersedesSuggestionId: current.id,
          createdAt: new Date().toISOString(),
        });
        const [sealedExplanation, sealedReason] = await Promise.all([
          this.protector.seal(current.explanation),
          this.protector.seal(input.reason),
        ]);
        await transaction.projectLinkSuggestion.create({
          data: suggestionData(confirmed, sealedExplanation, sealedReason),
        });
        await this.connections.confirmSuggestedProject(transaction, {
          actor: input.actor,
          correlationId: input.correlationId,
          sourceItemId: confirmed.sourceItemId,
          projectId: confirmed.projectId!,
          suggestionId: confirmed.id,
        });
        await databaseAuditWriter.append(transaction, {
          eventType: "context_intelligence.project_suggestion_confirmed",
          actor: { kind: "human", id: input.actor.userId },
          effectiveSubjectId: input.actor.userId,
          scopeType: "project",
          scopeId: confirmed.projectId!,
          targetType: "project_link_suggestion",
          targetId: confirmed.id,
          reason: "Employee confirmed a Context Intelligence Project suggestion",
          safeDiff: { reviewStatus: "CONFIRMED", revision: confirmed.revision },
          correlationId: input.correlationId,
          source: "api",
        });
        return { acknowledged: true } as const;
      },
      { isolationLevel: "Serializable" },
    );
  }

  async correctProjectSuggestion(input: {
    actor: Actor;
    suggestionId: string;
    expectedRevision: number;
    projectId: string | null;
    reason: string;
    correlationId: string;
  }) {
    assertActive(input.actor);
    const current = await this.loadCurrentSuggestion(input.actor, input.suggestionId);
    if (current.replay !== null || current.suggestion.revision !== input.expectedRevision) {
      throw versionConflict();
    }
    await this.requireSource(input.actor, current.suggestion.sourceItemId);
    return input.projectId === null
      ? this.suggestions.reject({
          actor: input.actor,
          suggestionId: input.suggestionId,
          reason: input.reason,
          correlationId: input.correlationId,
        })
      : this.suggestions.correct({
          actor: input.actor,
          suggestionId: input.suggestionId,
          correctedProjectId: input.projectId,
          reason: input.reason,
          correlationId: input.correlationId,
        });
  }

  async prepareTaskDraft(input: { actor: Actor; sourceItemId: string; correlationId: string }) {
    const prepared = await this.prepareSource(input.actor, input.sourceItemId);
    const analysisRow = await this.database.contextAnalysis.findFirst({
      where: {
        employeeId: input.actor.userId,
        sourceItemId: input.sourceItemId,
        supersedingAnalysis: null,
      },
      include: { aiRunTrace: true },
      orderBy: [{ revision: "desc" }, { id: "desc" }],
    });
    const suggestionRow = await this.database.projectLinkSuggestion.findFirst({
      where: {
        employeeId: input.actor.userId,
        sourceItemId: input.sourceItemId,
        supersedingSuggestion: null,
      },
      include: { aiRunTrace: true },
      orderBy: [{ revision: "desc" }, { id: "desc" }],
    });
    if (analysisRow === null || suggestionRow === null) throw analysisRequired();
    const [analysis, suggestion, projects, candidates] = await Promise.all([
      this.analysisPersistence.materialize(analysisRow),
      this.suggestionPersistence.materialize(suggestionRow),
      this.projectService.listProjects({ actor: input.actor }),
      this.projectAnchors.read({
        employeeId: input.actor.userId,
        sourceItemId: input.sourceItemId,
        at: new Date(),
      }),
    ]);
    const currentDecision = decideProjectLink(candidates);
    const decision: import("@evaluation/context-intelligence").LinkDecision =
      suggestion.decision === "AUTO_LINK" && suggestion.projectId !== null
        ? {
            kind: "AUTO_LINK",
            projectId: suggestion.projectId,
            anchors: suggestion.anchors,
          }
        : suggestion.decision === "NO_MATCH"
          ? { kind: "NO_MATCH", reasons: ["EMPLOYEE_REJECTED_PROJECT_LINK"] }
          : currentDecision.kind === "REVIEW"
            ? currentDecision
            : {
                kind: "REVIEW",
                candidates,
                reasons: ["EMPLOYEE_REVIEW_REQUIRED"],
              };
    const decisionProjectId =
      decision.kind === "AUTO_LINK"
        ? decision.projectId
        : decision.kind === "REVIEW"
          ? decision.candidates.find(({ accessible }) => accessible)?.projectId
          : undefined;
    const scopeProject =
      projects.find(({ id }) => id === (suggestion.projectId ?? decisionProjectId)) ?? projects[0];
    if (scopeProject === undefined) throw forbidden();
    const semanticContexts = await this.semanticContextsForDecision(input.actor, decision);
    const record = await this.drafts.prepare({
      actor: input.actor,
      sourceItemId: input.sourceItemId,
      departmentId: scopeProject.departmentId,
      systemId: this.runtime.systemId,
      correlationId: input.correlationId,
      sources: [sourceInput(prepared.item)],
      decision,
      semanticContexts,
      analysis: {
        summary: analysis.summary,
        uncertainties: analysis.uncertainties,
        sourceReferences: analysis.sourceReferences,
      },
    });
    return taskDraftView(record);
  }

  async confirmTaskDraft(input: unknown) {
    const command = ConfirmTaskCommandSchema.parse(input);
    await this.requireSource(
      command.actor,
      await this.sourceIdForDraft(command.actor, command.taskDraftId),
    );
    return this.database.$transaction(
      async (transaction) => {
        await lockTaskDraft(transaction, command.taskDraftId);
        const row = await transaction.taskDraft.findUnique({
          where: { id: command.taskDraftId },
          include: { aiRunTrace: true, supersedingTaskDraft: { include: { aiRunTrace: true } } },
        });
        if (row === null || row.employeeId !== command.actor.userId) throw forbidden();
        if (row.revision !== command.expectedRevision) throw versionConflict();
        await this.context.assertAccessibleInTransaction(transaction, {
          actor: command.actor,
          sourceItemId: row.sourceItemId,
        });
        const workItemId = stableUuid("confirmed-context-task", row.id);
        if (row.supersedingTaskDraft !== null) {
          const confirmed = await this.taskDraftPersistence.materialize(row.supersedingTaskDraft);
          if (
            confirmed.reviewStatus !== "CONFIRMED" ||
            !sameOfficialContent(confirmed, command.draft, command.reason)
          ) {
            throw idempotencyConflict();
          }
          const workItem = await this.workItems.createConfirmedTask(
            transaction,
            workItemCommand(command, workItemId),
          );
          return { taskDraftId: row.id, confirmedRevision: confirmed.revision, workItem };
        }
        const previous = await this.taskDraftPersistence.materialize(row);
        if (previous.reviewStatus !== "PENDING" && previous.reviewStatus !== "CORRECTED") {
          throw versionConflict();
        }
        const finalDraft = TaskDraftSchema.parse({
          title: command.draft.title,
          description: command.draft.description,
          projectId: command.draft.projectId,
          workstreamId: command.draft.workstreamId,
          proposedAssigneeId: command.draft.assigneeId,
          dueAt: command.draft.dueAt,
          acceptanceConditions: command.draft.acceptanceConditions,
          sourceReferences: previous.sourceReferences,
          uncertainties: previous.draft.uncertainties,
        });
        const confirmed = TaskDraftRecordSchema.parse({
          ...previous,
          id: stableUuid("task-draft-confirmation", previous.id),
          revision: previous.revision + 1,
          reviewStatus: "CONFIRMED",
          revisionOrigin: "EMPLOYEE",
          correctionReason: command.reason,
          createdAt: new Date().toISOString(),
          draft: finalDraft,
          supersedesTaskDraftId: previous.id,
        });
        const [sealedDraft, sealedReason] = await Promise.all([
          this.protector.seal(JSON.stringify(finalDraft)),
          this.protector.seal(command.reason),
        ]);
        const workItem = await this.workItems.createConfirmedTask(
          transaction,
          workItemCommand(command, workItemId),
        );
        await transaction.taskDraft.create({
          data: taskDraftData(confirmed, sealedDraft, sealedReason),
        });
        await databaseAuditWriter.append(transaction, {
          eventType: "context_intelligence.task_draft_confirmed",
          actor: { kind: "human", id: command.actor.userId },
          effectiveSubjectId: command.draft.assigneeId,
          scopeType: "project",
          scopeId: command.draft.projectId,
          targetType: "task_draft",
          targetId: confirmed.id,
          reason: "Employee confirmed a Context Intelligence Task draft",
          safeDiff: {
            reviewStatus: "CONFIRMED",
            revision: confirmed.revision,
            workItemId: workItem.id,
          },
          correlationId: command.correlationId,
          source: "api",
        });
        return { taskDraftId: row.id, confirmedRevision: confirmed.revision, workItem };
      },
      { isolationLevel: "Serializable" },
    );
  }

  private async prepareSource(actor: Actor, sourceItemId: string) {
    const item = await this.requireSource(actor, sourceItemId);
    const review = await this.context.review({ actor });
    const current = review.items.find(({ id }) => id === sourceItemId);
    if (current === undefined || current.excluded) throw forbidden();
    return { item, linkedProjectId: current.projectId };
  }

  private async requireSource(actor: Actor, sourceItemId: string) {
    assertActive(actor);
    const item = await this.context.get({ actor, sourceItemId });
    if (item.excluded || item.privacy !== "PRIVATE") throw forbidden();
    return item;
  }

  private async sourceIdForDraft(actor: Actor, taskDraftId: string): Promise<string> {
    const row = await this.database.taskDraft.findUnique({
      where: { id: taskDraftId },
      select: { employeeId: true, sourceItemId: true },
    });
    if (row === null || row.employeeId !== actor.userId) throw forbidden();
    return row.sourceItemId;
  }

  private async canReturnSource(
    transaction: Transaction,
    actor: Actor,
    sourceItemId: string,
  ): Promise<boolean> {
    try {
      await this.context.assertAccessibleInTransaction(transaction, { actor, sourceItemId });
      return true;
    } catch (error) {
      if (error instanceof AppError && error.code === "CONNECTED_CONTEXT_FORBIDDEN") return false;
      throw error;
    }
  }

  private async canAccessProject(employeeId: string, projectId: string): Promise<boolean> {
    try {
      await this.projectService.getProject({
        actor: { userId: employeeId, active: true },
        projectId,
      });
      return true;
    } catch (error) {
      if (error instanceof AppError && error.status === 403) return false;
      throw error;
    }
  }

  private async semanticContextsForDecision(
    actor: Actor,
    decision: import("@evaluation/context-intelligence").LinkDecision,
  ) {
    const projectIds =
      decision.kind === "AUTO_LINK"
        ? [decision.projectId]
        : decision.kind === "REVIEW"
          ? decision.candidates
              .filter(({ accessible }) => accessible)
              .map(({ projectId }) => projectId)
          : [];
    const contexts = await Promise.all(
      [...new Set(projectIds)].map((projectId) => this.projectSemantics.read({ actor, projectId })),
    );
    return contexts.filter((context): context is NonNullable<typeof context> => context !== null);
  }

  private async loadCurrentSuggestion(actor: Actor, suggestionId: string) {
    const row = await this.database.projectLinkSuggestion.findUnique({
      where: { id: suggestionId },
      include: { aiRunTrace: true, supersedingSuggestion: { include: { aiRunTrace: true } } },
    });
    if (row === null || row.employeeId !== actor.userId) throw forbidden();
    const suggestion = await this.suggestionPersistence.materialize(row);
    const replay =
      row.supersedingSuggestion?.reviewStatus === "CONFIRMED"
        ? await this.suggestionPersistence.materialize(row.supersedingSuggestion)
        : null;
    if (row.supersedingSuggestion !== null && replay === null) throw versionConflict();
    return { suggestion, replay };
  }
}

class PrismaContextAnalysisPersistence implements AnalysisPersistence {
  private readonly database: Database;
  private readonly protector: Protector;

  constructor(database: Database, protector: Protector) {
    this.database = database;
    this.protector = protector;
  }

  async findInitial(input: { id: string; employeeId: string; sourceItemId: string }) {
    const row = await this.database.contextAnalysis.findUnique({
      where: { id: input.id },
      include: { aiRunTrace: true },
    });
    if (
      row === null ||
      row.employeeId !== input.employeeId ||
      row.sourceItemId !== input.sourceItemId
    ) {
      return null;
    }
    return this.materialize(row);
  }

  async append(input: {
    record: ContextAnalysis;
    outputCiphertext: string;
    outputKeyVersion: string;
  }) {
    await this.database.contextAnalysis.create({
      data: analysisData(input.record, input.outputCiphertext, input.outputKeyVersion),
    });
    return input.record;
  }

  async materialize(row: AnalysisRow): Promise<ContextAnalysis> {
    const output = ContextSummaryAiOutputSchema.parse(
      JSON.parse(
        await this.protector.open({
          ciphertext: row.outputCiphertext,
          keyVersion: row.outputKeyVersion,
        }),
      ),
    );
    const correctionReason = await openNullable(
      this.protector,
      row.correctionReasonCiphertext,
      row.correctionReasonKeyVersion,
    );
    return ContextAnalysisSchema.parse({
      id: row.id,
      employeeId: row.employeeId,
      sourceItemId: row.sourceItemId,
      revision: row.revision,
      schemaVersion: row.schemaVersion,
      promptVersion: row.promptVersion,
      routeTrace: routeTrace(row.aiRunTrace),
      sourceReferences: stringArray(row.sourceReferences),
      reviewStatus: row.reviewStatus,
      revisionOrigin: row.revisionOrigin,
      correctionReason,
      createdAt: row.createdAt.toISOString(),
      summary: output.summary,
      uncertainties: output.uncertainties,
      supersedesAnalysisId: row.supersedesAnalysisId,
    });
  }
}

class PrismaProjectSuggestionPersistence implements SuggestionPersistence {
  private readonly database: Database;
  private readonly protector: Protector;
  private readonly context: ConnectedWorkContextQueryService;
  private readonly connections: ConnectedWorkConnectionService;

  constructor(
    database: Database,
    protector: Protector,
    context: ConnectedWorkContextQueryService,
    connections: ConnectedWorkConnectionService,
  ) {
    this.database = database;
    this.protector = protector;
    this.context = context;
    this.connections = connections;
  }

  async appendInitial(input: {
    record: Omit<ProjectSuggestion, "explanation">;
    explanationCiphertext: string;
    explanationKeyVersion: string;
  }) {
    const row = await this.database.projectLinkSuggestion.create({
      data: suggestionData(input.record, {
        ciphertext: input.explanationCiphertext,
        keyVersion: input.explanationKeyVersion,
      }),
      include: { aiRunTrace: true },
    });
    return this.materialize(row);
  }

  async findOwnedSuggestion(input: { employeeId: string; suggestionId: string }) {
    const row = await this.database.projectLinkSuggestion.findUnique({
      where: { id: input.suggestionId },
      include: { aiRunTrace: true },
    });
    if (row === null || row.employeeId !== input.employeeId) return null;
    return this.materialize(row);
  }

  async appendCorrectionRevision(input: {
    previousSuggestionId: string;
    suggestion: ProjectSuggestion;
    correction: import("@evaluation/contracts").SourceLinkCorrection;
    correlationId: string;
  }) {
    const [sealedExplanation, sealedReason] = await Promise.all([
      this.protector.seal(input.suggestion.explanation),
      this.protector.seal(input.correction.reason),
    ]);
    return this.database.$transaction(
      async (transaction) => {
        await lockSuggestion(transaction, input.previousSuggestionId);
        const existing = await transaction.projectLinkSuggestion.findUnique({
          where: { supersedesSuggestionId: input.previousSuggestionId },
          include: { aiRunTrace: true },
        });
        if (existing !== null) throw versionConflict();
        await this.context.assertAccessibleInTransaction(transaction, {
          actor: { userId: input.correction.employeeId, active: true },
          sourceItemId: input.suggestion.sourceItemId,
        });
        const suggestion = await transaction.projectLinkSuggestion.create({
          data: suggestionData(input.suggestion, sealedExplanation, sealedReason),
          include: { aiRunTrace: true },
        });
        await transaction.sourceLinkCorrection.create({
          data: {
            id: input.correction.id,
            suggestionId: input.correction.suggestionId,
            sourceItemId: input.suggestion.sourceItemId,
            employeeId: input.correction.employeeId,
            previousProjectId: input.correction.previousProjectId,
            correctedProjectId: input.correction.correctedProjectId,
            action: input.correction.action,
            reasonCiphertext: sealedReason.ciphertext,
            reasonKeyVersion: sealedReason.keyVersion,
            sourceReferences: [...input.correction.sourceReferences] as never,
            supersedingSuggestionId: input.correction.supersedingSuggestionId,
            correctedById: input.correction.employeeId,
            createdAt: new Date(input.correction.createdAt),
          },
        });
        if (input.correction.action === "CORRECT") {
          await this.connections.replaceSuggestedProject(transaction, {
            actor: { userId: input.correction.employeeId, active: true },
            correlationId: input.correlationId,
            sourceItemId: input.suggestion.sourceItemId,
            expectedSuggestionId: input.previousSuggestionId,
            replacementSuggestionId: input.suggestion.id,
            projectId: input.correction.correctedProjectId!,
          });
        } else {
          await this.connections.removeSuggestedProject(transaction, {
            actor: { userId: input.correction.employeeId, active: true },
            correlationId: input.correlationId,
            sourceItemId: input.suggestion.sourceItemId,
            expectedSuggestionId: input.previousSuggestionId,
          });
        }
        const auditProjectId =
          input.correction.correctedProjectId ?? input.correction.previousProjectId;
        await databaseAuditWriter.append(transaction, {
          eventType: `context_intelligence.project_suggestion_${input.correction.action.toLowerCase()}`,
          actor: { kind: "human", id: input.correction.employeeId },
          effectiveSubjectId: input.correction.employeeId,
          scopeType: auditProjectId === null ? "system" : "project",
          scopeId: auditProjectId ?? input.correction.employeeId,
          targetType: "project_link_suggestion",
          targetId: input.suggestion.id,
          reason:
            input.correction.action === "CORRECT"
              ? "Employee corrected a Context Intelligence Project suggestion"
              : "Employee rejected a Context Intelligence Project suggestion",
          safeDiff: {
            reviewStatus: input.suggestion.reviewStatus,
            revision: input.suggestion.revision,
          },
          correlationId: input.correlationId,
          source: "api",
        });
        return {
          suggestion: await this.materialize(suggestion),
          correction: SourceLinkCorrectionSchema.parse(input.correction),
        };
      },
      { isolationLevel: "Serializable" },
    );
  }

  async materialize(row: SuggestionRow): Promise<ProjectSuggestion> {
    const protectedValue = await this.protector.open({
      ciphertext: row.explanationCiphertext,
      keyVersion: row.explanationKeyVersion,
    });
    let explanation = protectedValue;
    try {
      explanation = ContextProjectMatchAiOutputSchema.parse(JSON.parse(protectedValue)).explanation;
    } catch {
      // Employee revisions contain a protected human lifecycle explanation, not AI output.
    }
    const correctionReason = await openNullable(
      this.protector,
      row.correctionReasonCiphertext,
      row.correctionReasonKeyVersion,
    );
    return ProjectLinkSuggestionSchema.parse({
      id: row.id,
      employeeId: row.employeeId,
      sourceItemId: row.sourceItemId,
      revision: row.revision,
      schemaVersion: row.schemaVersion,
      promptVersion: row.promptVersion,
      routeTrace: routeTrace(row.aiRunTrace),
      sourceReferences: stringArray(row.sourceReferences),
      reviewStatus: row.reviewStatus,
      revisionOrigin: row.revisionOrigin,
      correctionReason,
      createdAt: row.createdAt.toISOString(),
      analysisId: row.analysisId,
      projectId: row.projectId,
      decision: row.decision,
      explanation,
      anchors: row.anchors,
      supersedesSuggestionId: row.supersedesSuggestionId,
    });
  }
}

class PrismaTaskDraftPersistence implements DraftPersistence {
  private readonly database: Database;
  private readonly protector: Protector;

  constructor(database: Database, protector: Protector) {
    this.database = database;
    this.protector = protector;
  }

  async findInitial(input: { id: string; employeeId: string; sourceItemId: string }) {
    const row = await this.database.taskDraft.findUnique({
      where: { id: input.id },
      include: { aiRunTrace: true },
    });
    if (
      row === null ||
      row.employeeId !== input.employeeId ||
      row.sourceItemId !== input.sourceItemId
    ) {
      return null;
    }
    return this.materialize(row);
  }

  async append(input: {
    record: TaskDraftRecord;
    draftCiphertext: string;
    draftKeyVersion: string;
  }) {
    await this.database.taskDraft.create({
      data: taskDraftData(input.record, {
        ciphertext: input.draftCiphertext,
        keyVersion: input.draftKeyVersion,
      }),
    });
    return input.record;
  }

  async materialize(row: TaskDraftRow): Promise<TaskDraftRecord> {
    const draft = TaskDraftSchema.parse(
      JSON.parse(
        await this.protector.open({
          ciphertext: row.draftCiphertext,
          keyVersion: row.draftKeyVersion,
        }),
      ),
    );
    const correctionReason = await openNullable(
      this.protector,
      row.correctionReasonCiphertext,
      row.correctionReasonKeyVersion,
    );
    return TaskDraftRecordSchema.parse({
      id: row.id,
      employeeId: row.employeeId,
      sourceItemId: row.sourceItemId,
      revision: row.revision,
      schemaVersion: row.schemaVersion,
      promptVersion: row.promptVersion,
      routeTrace: routeTrace(row.aiRunTrace),
      sourceReferences: stringArray(row.sourceReferences),
      reviewStatus: row.reviewStatus,
      revisionOrigin: row.revisionOrigin,
      correctionReason,
      createdAt: row.createdAt.toISOString(),
      draft,
      supersedesTaskDraftId: row.supersedesTaskDraftId,
    });
  }
}

const ConfirmTaskCommandSchema = z
  .object({
    actor: z.object({ userId: z.string().uuid(), active: z.boolean() }).strict(),
    taskDraftId: z.string().uuid(),
    expectedRevision: z.number().int().positive(),
    reason: z.string().trim().min(1).max(1_000),
    draft: z
      .object({
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().max(8_000),
        projectId: z.string().uuid(),
        workstreamId: z.string().uuid().nullable(),
        assigneeId: z.string().uuid(),
        dueAt: z.iso.datetime({ offset: true }).nullable(),
        acceptanceConditions: z.array(z.string().trim().min(1).max(500)).max(50),
      })
      .strict(),
    correlationId: z.string().uuid(),
  })
  .strict();

function taskDraftView(record: TaskDraftRecord) {
  const requiredFields = [
    ...(record.draft.projectId === null ? (["projectId"] as const) : []),
    ...(record.draft.proposedAssigneeId === null ? (["assigneeId"] as const) : []),
  ];
  return {
    ...record,
    clarification: {
      requiredFields,
      nextQuestion:
        requiredFields.length === 0
          ? null
          : { field: requiredFields[0], sourceItemId: record.sourceItemId },
    },
  };
}

function sourceInput(item: Awaited<ReturnType<ConnectedWorkContextQueryService["get"]>>) {
  return {
    kind: item.provider === "GOOGLE_GMAIL" ? ("EMAIL" as const) : ("EVENT" as const),
    reference: connectedSourceReference(item.id),
    mediaType: "application/json",
    content: JSON.stringify({
      title: item.title,
      summary: item.summary,
      occurredAt: item.occurredAt,
    }),
  };
}

function workItemCommand(command: z.infer<typeof ConfirmTaskCommandSchema>, workItemId: string) {
  return {
    actor: command.actor,
    correlationId: command.correlationId,
    workItemId,
    input: {
      title: command.draft.title,
      description: command.draft.description,
      projectId: command.draft.projectId,
      workstreamId: command.draft.workstreamId,
      assigneeId: command.draft.assigneeId,
      dueAt: command.draft.dueAt,
      priority: "normal" as const,
      requirements: [],
      acceptanceConditions: command.draft.acceptanceConditions,
      blocker: null,
      nextAction: null,
    },
    reason: command.reason,
  };
}

function sameOfficialContent(
  record: TaskDraftRecord,
  draft: z.infer<typeof ConfirmTaskCommandSchema>["draft"],
  protectedReason: string,
) {
  return (
    record.correctionReason === protectedReason &&
    record.draft.title === draft.title &&
    record.draft.description === draft.description &&
    record.draft.projectId === draft.projectId &&
    record.draft.workstreamId === draft.workstreamId &&
    record.draft.proposedAssigneeId === draft.assigneeId &&
    record.draft.dueAt === draft.dueAt &&
    JSON.stringify(record.draft.acceptanceConditions) === JSON.stringify(draft.acceptanceConditions)
  );
}

function analysisData(record: ContextAnalysis, ciphertext: string, keyVersion: string) {
  return {
    id: record.id,
    sourceItemId: record.sourceItemId,
    employeeId: record.employeeId,
    revision: record.revision,
    schemaVersion: record.schemaVersion,
    promptVersion: record.promptVersion,
    aiRunTraceId: record.routeTrace.aiRunId,
    outputCiphertext: ciphertext,
    outputKeyVersion: keyVersion,
    sourceReferences: [...record.sourceReferences] as never,
    reviewStatus: record.reviewStatus,
    revisionOrigin: record.revisionOrigin,
    supersedesAnalysisId: record.supersedesAnalysisId,
    createdById: record.employeeId,
    createdAt: new Date(record.createdAt),
  };
}

function suggestionData(
  record: Omit<ProjectSuggestion, "explanation"> | ProjectSuggestion,
  explanation: { ciphertext: string; keyVersion: string },
  correctionReason?: { ciphertext: string; keyVersion: string },
) {
  return {
    id: record.id,
    analysisId: record.analysisId,
    sourceItemId: record.sourceItemId,
    employeeId: record.employeeId,
    projectId: record.projectId,
    decision: record.decision,
    explanationCiphertext: explanation.ciphertext,
    explanationKeyVersion: explanation.keyVersion,
    anchors: [...record.anchors] as never,
    revision: record.revision,
    schemaVersion: record.schemaVersion,
    promptVersion: record.promptVersion,
    aiRunTraceId: record.routeTrace.aiRunId,
    sourceReferences: [...record.sourceReferences] as never,
    reviewStatus: record.reviewStatus,
    revisionOrigin: record.revisionOrigin,
    correctionReasonCiphertext: correctionReason?.ciphertext ?? null,
    correctionReasonKeyVersion: correctionReason?.keyVersion ?? null,
    supersedesSuggestionId: record.supersedesSuggestionId,
    createdById: record.employeeId,
    createdAt: new Date(record.createdAt),
  };
}

function taskDraftData(
  record: TaskDraftRecord,
  draft: { ciphertext: string; keyVersion: string },
  correctionReason?: { ciphertext: string; keyVersion: string },
) {
  return {
    id: record.id,
    sourceItemId: record.sourceItemId,
    employeeId: record.employeeId,
    draftCiphertext: draft.ciphertext,
    draftKeyVersion: draft.keyVersion,
    projectId: record.draft.projectId,
    workstreamId: record.draft.workstreamId,
    proposedAssigneeId: record.draft.proposedAssigneeId,
    dueAt: record.draft.dueAt === null ? null : new Date(record.draft.dueAt),
    revision: record.revision,
    schemaVersion: record.schemaVersion,
    promptVersion: record.promptVersion,
    aiRunTraceId: record.routeTrace.aiRunId,
    sourceReferences: [...record.sourceReferences] as never,
    reviewStatus: record.reviewStatus,
    revisionOrigin: record.revisionOrigin,
    correctionReasonCiphertext: correctionReason?.ciphertext ?? null,
    correctionReasonKeyVersion: correctionReason?.keyVersion ?? null,
    supersedesTaskDraftId: record.supersedesTaskDraftId,
    createdById: record.employeeId,
    createdAt: new Date(record.createdAt),
  };
}

function routeTrace(row: AiRunRow): RouteTrace {
  return {
    aiRunId: row.id,
    routeKey: row.routeKey,
    routeConfigId: row.routeConfigId,
    routeConfigVersion: row.routeConfigVersion,
  };
}

function connectedSourceReference(id: string): string {
  return `connected-source:${id}`;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    throw new Error("Governed source references are invalid");
  }
  return [...value];
}

async function openNullable(
  protector: Protector,
  ciphertext: string | null,
  keyVersion: string | null,
): Promise<string | null> {
  if (ciphertext === null && keyVersion === null) return null;
  if (ciphertext === null || keyVersion === null)
    throw new Error("Protected value lineage mismatch");
  return protector.open({ ciphertext, keyVersion });
}

function stableUuid(kind: string, id: string): string {
  const bytes = createHash("sha256")
    .update(`context-intelligence:${kind}:${id}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function assertActive(actor: Actor): void {
  if (!actor.active) throw forbidden();
}

function forbidden(): AppError {
  return new AppError(
    "CONTEXT_INTELLIGENCE_FORBIDDEN",
    "errors.contextIntelligence.forbidden",
    403,
  );
}

function versionConflict(): AppError {
  return new AppError(
    "CONTEXT_DRAFT_VERSION_CONFLICT",
    "errors.contextIntelligence.versionConflict",
    409,
  );
}

function idempotencyConflict(): AppError {
  return new AppError("IDEMPOTENCY_CONFLICT", "errors.idempotency.conflict", 409);
}

function confirmationRequired(): AppError {
  return new AppError(
    "CONTEXT_CONFIRMATION_REQUIRED",
    "errors.contextIntelligence.confirmationRequired",
    409,
  );
}

function analysisRequired(): AppError {
  return new AppError(
    "CONTEXT_ANALYSIS_REQUIRED",
    "errors.contextIntelligence.analysisRequired",
    409,
  );
}

async function lockSuggestion(transaction: Transaction, id: string): Promise<void> {
  await transaction.$queryRaw`SELECT id FROM "ProjectLinkSuggestion" WHERE id = ${id}::uuid FOR UPDATE`;
}

async function lockTaskDraft(transaction: Transaction, id: string): Promise<void> {
  await transaction.$queryRaw`SELECT id FROM "TaskDraft" WHERE id = ${id}::uuid FOR UPDATE`;
}

type AiRunRow = {
  id: string;
  routeKey: string;
  routeConfigId: string;
  routeConfigVersion: number;
};
type AnalysisRow = Readonly<{
  id: string;
  sourceItemId: string;
  employeeId: string;
  revision: number;
  schemaVersion: string;
  promptVersion: string;
  outputCiphertext: string;
  outputKeyVersion: string;
  sourceReferences: unknown;
  reviewStatus: "PENDING" | "CONFIRMED" | "CORRECTED" | "REJECTED" | "SUPERSEDED";
  revisionOrigin: "AI" | "EMPLOYEE";
  correctionReasonCiphertext: string | null;
  correctionReasonKeyVersion: string | null;
  supersedesAnalysisId: string | null;
  createdAt: Date;
  aiRunTrace: AiRunRow;
}>;
type SuggestionRow = Readonly<{
  id: string;
  analysisId: string;
  sourceItemId: string;
  employeeId: string;
  projectId: string | null;
  decision: "AUTO_LINK" | "REVIEW" | "NO_MATCH";
  explanationCiphertext: string;
  explanationKeyVersion: string;
  anchors: unknown;
  revision: number;
  schemaVersion: string;
  promptVersion: string;
  sourceReferences: unknown;
  reviewStatus: "PENDING" | "CONFIRMED" | "CORRECTED" | "REJECTED" | "SUPERSEDED";
  revisionOrigin: "AI" | "EMPLOYEE";
  correctionReasonCiphertext: string | null;
  correctionReasonKeyVersion: string | null;
  supersedesSuggestionId: string | null;
  createdAt: Date;
  aiRunTrace: AiRunRow;
}>;
type TaskDraftRow = Readonly<{
  id: string;
  sourceItemId: string;
  employeeId: string;
  draftCiphertext: string;
  draftKeyVersion: string;
  revision: number;
  schemaVersion: string;
  promptVersion: string;
  sourceReferences: unknown;
  reviewStatus: "PENDING" | "CONFIRMED" | "CORRECTED" | "REJECTED" | "SUPERSEDED";
  revisionOrigin: "AI" | "EMPLOYEE";
  correctionReasonCiphertext: string | null;
  correctionReasonKeyVersion: string | null;
  supersedesTaskDraftId: string | null;
  createdAt: Date;
  aiRunTrace: AiRunRow;
}>;

export class ContextIntelligenceModule {}

Module({
  imports: [AuthModule, ConnectedWorkContextModule, DocumentsModule],
  controllers: [ContextAnalysisController, TaskDraftsController],
  providers: [
    {
      provide: CONTEXT_INTELLIGENCE_DATABASE,
      useFactory: () => {
        const url = process.env.DATABASE_URL?.trim();
        if (!url) throw new Error("DATABASE_URL must be configured");
        return createDatabaseClient(url);
      },
    },
    {
      provide: CONTEXT_INTELLIGENCE_DATABASE_LIFECYCLE,
      useFactory: (database: Database) => ({ onModuleDestroy: () => database.$disconnect() }),
      inject: [CONTEXT_INTELLIGENCE_DATABASE],
    },
    {
      provide: CONTEXT_INTELLIGENCE_POLICY_DATABASE,
      useExisting: CONTEXT_INTELLIGENCE_DATABASE,
    },
    {
      provide: CONTEXT_INTELLIGENCE_SEMANTIC_READER,
      useFactory: (documents: DocumentProjectSemanticContextReader) =>
        new ProjectSemanticContextReader(documents),
      inject: [DocumentProjectSemanticContextReader],
    },
    {
      provide: CONTEXT_INTELLIGENCE_RUNTIME,
      useFactory: async (database: Database): Promise<Runtime> => ({
        router: createDeferredRuntimeAiRouter(() =>
          createRuntimeAiRouter({
            database,
            secretResolver: new EnvironmentAiCredentialSecretResolver(),
          }),
        ),
        systemId: await resolveSystemAiScopeId(database, CONTEXT_SUMMARY_ROUTE),
      }),
      inject: [CONTEXT_INTELLIGENCE_DATABASE],
    },
    {
      provide: CONTEXT_INTELLIGENCE_WORKFLOW,
      useFactory: (
        database: Database,
        context: ConnectedWorkContextQueryService,
        connections: ConnectedWorkConnectionService,
        protector: Protector,
        runtime: Runtime,
        semanticReader: ProjectSemanticContextReader,
      ) =>
        new ContextIntelligenceApplicationService(
          database,
          context,
          connections,
          protector,
          runtime,
          semanticReader,
        ),
      inject: [
        CONTEXT_INTELLIGENCE_DATABASE,
        ConnectedWorkContextQueryService,
        ConnectedWorkConnectionService,
        CONNECTED_WORK_PROTECTOR,
        CONTEXT_INTELLIGENCE_RUNTIME,
        CONTEXT_INTELLIGENCE_SEMANTIC_READER,
      ],
    },
    ContextIntelligencePolicyGuard,
  ],
  exports: [CONTEXT_INTELLIGENCE_WORKFLOW],
})(ContextIntelligenceModule);

// Avoid accidental route renames in this central composition file.
void CONTEXT_PROJECT_MATCH_ROUTE;
void TASK_DRAFT_ROUTE;
