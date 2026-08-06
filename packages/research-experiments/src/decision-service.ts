import {
  AppError,
  ConcludeResearchInputSchema,
  type AuditWriter as AuditWriterContract,
  type ConcludeResearchInput,
} from "@evaluation/contracts";
import type { DatabaseClient, DatabaseTransaction } from "@evaluation/database";
import { z } from "zod";

const RETRACTION_EVENT_SCHEMA = "research-source-retraction.v1";

export type ResearchActor = Readonly<{ userId: string; active: boolean }>;
export type ResearchTransaction = DatabaseTransaction;
export type ResearchAuditWriter = AuditWriterContract<ResearchTransaction>;
export type ResearchScopeAuthorizer = Readonly<{
  authorize(
    input: Readonly<{
      actor: ResearchActor;
      scope: import("@evaluation/contracts").ResearchScope;
      at: Date;
    }>,
  ): Promise<unknown>;
  authorizeTransaction(
    transaction: ResearchTransaction,
    input: Readonly<{
      actor: ResearchActor;
      scope: import("@evaluation/contracts").ResearchScope;
      at: Date;
    }>,
  ): Promise<unknown>;
}>;

type Dependencies = Readonly<{
  database: DatabaseClient;
  authorizer: ResearchScopeAuthorizer;
  auditWriter: ResearchAuditWriter;
  clock?: () => Date;
}>;

type Command = Readonly<{
  actor: ResearchActor;
  correlationId: string;
  researchId: string;
  input: ConcludeResearchInput;
}>;

export type ResearchConclusionResult = Readonly<{
  id: string;
  researchId: string;
  synthesis: string;
  answer: string;
  remainingUncertainty: unknown;
  decision: ConcludeResearchInput["decision"];
  rationale: string;
  nextAction: string;
  sourceReferences: unknown;
  experimentIds: unknown;
  aiRunId: string | null;
  confirmerId: string;
  confirmedAt: Date;
  createdAt: Date;
}>;

export class ResearchDecisionService {
  readonly #database: DatabaseClient;
  readonly #authorizer: ResearchScopeAuthorizer;
  readonly #auditWriter: ResearchAuditWriter;
  readonly #clock: () => Date;

  constructor(dependencies: Dependencies) {
    this.#database = dependencies.database;
    this.#authorizer = dependencies.authorizer;
    this.#auditWriter = dependencies.auditWriter;
    this.#clock = dependencies.clock ?? (() => new Date());
  }

  async conclude(command: Command): Promise<ResearchConclusionResult> {
    const input = ConcludeResearchInputSchema.parse(command.input);
    const initial = await loadResearch(this.#database, command.researchId);
    const at = validInstant(this.#clock());
    assertHumanOwner(command.actor, initial.ownerId);
    await this.#authorizer.authorize({ actor: command.actor, scope: scopeOf(initial), at });

    return this.#database.$transaction(async (transaction) => {
      const root = await lockOwnedResearch(transaction, command.researchId, command.actor, at);
      assertVersion(root.version, input.expectedVersion);
      if (root.state !== "ACTIVE") throw decisionInvalid();
      await this.#authorizer.authorizeTransaction(transaction, {
        actor: command.actor,
        scope: scopeOf(root),
        at,
      });
      await validateDecisionSources(transaction, root.id, input.sourceReferences);
      await validateDecisionExperiments(transaction, root.id, input.experimentIds, input.decision);

      const conclusion = await transaction.researchConclusion.create({
        data: {
          researchId: root.id,
          synthesis: input.synthesis,
          answer: input.answer,
          remainingUncertainty: [...input.remainingUncertainty],
          decision: input.decision,
          rationale: input.rationale,
          nextAction: input.nextAction,
          sourceReferences: [...input.sourceReferences],
          experimentIds: [...input.experimentIds],
          aiRunId: null,
          confirmerId: command.actor.userId,
          confirmedAt: at,
          createdAt: at,
        },
      });
      await updateResearchVersion(transaction, root.id, root.version, {
        state: "CONCLUDED",
        version: { increment: 1 },
        transitionedAt: at,
      });
      await transaction.researchTransition.create({
        data: {
          researchId: root.id,
          fromState: root.state,
          toState: "CONCLUDED",
          reason: input.rationale,
          actorId: command.actor.userId,
          resultingVersion: root.version + 1,
          effectiveAt: at,
          createdAt: at,
        },
      });
      await this.#auditWriter.append(
        transaction,
        researchAudit(command, root.projectId, root.id, "research.concluded", {
          conclusionId: conclusion.id,
          decision: conclusion.decision,
          sourceCount: input.sourceReferences.length,
          experimentCount: input.experimentIds.length,
          fromState: root.state,
          toState: "CONCLUDED",
          version: root.version + 1,
        }),
      );
      return conclusion;
    }, SERIALIZABLE);
  }
}

type ResearchReader = Pick<DatabaseClient, "researchRecord"> | ResearchTransaction;

async function loadResearch(database: ResearchReader, researchId: string) {
  const root = await database.researchRecord.findUnique({
    where: { id: researchId },
    select: {
      id: true,
      projectId: true,
      workstreamId: true,
      workItemId: true,
      ownerId: true,
      state: true,
      version: true,
    },
  });
  if (root === null) throw forbidden();
  return root;
}

export async function lockOwnedResearch(
  transaction: ResearchTransaction,
  researchId: string,
  actor: ResearchActor,
  _at: Date,
): Promise<LockedResearch> {
  await transaction.$queryRaw`SELECT "id" FROM "ResearchRecord" WHERE "id" = ${researchId}::uuid FOR UPDATE`;
  const root = await loadResearch(transaction, researchId);
  assertHumanOwner(actor, root.ownerId);
  const user = await transaction.user.findUnique({
    where: { id: actor.userId },
    select: { active: true },
  });
  if (user?.active !== true) throw forbidden();
  return root;
}

async function validateDecisionSources(
  transaction: ResearchTransaction,
  researchId: string,
  references: readonly string[],
) {
  const ids = references.map(sourceId);
  if (ids.some((id) => id === null) || new Set(ids).size !== ids.length) throw decisionInvalid();
  const sourceIds = ids as string[];
  const [rows, retractionEvents] = await Promise.all([
    transaction.researchSourceReference.findMany({
      where: { researchId, id: { in: sourceIds }, state: "ACTIVE" },
      select: { id: true },
    }),
    transaction.researchSourceReference.findMany({
      where: { researchId, state: "RETRACTED" },
      select: { citedLocations: true },
    }),
  ]);
  const retractedPredecessors = new Set(
    retractionEvents
      .map(({ citedLocations }) => retractionPredecessor(citedLocations))
      .filter((id): id is string => id !== null),
  );
  if (rows.length !== sourceIds.length || sourceIds.some((id) => retractedPredecessors.has(id))) {
    throw decisionInvalid();
  }
}

function retractionPredecessor(citedLocations: unknown): string | null {
  if (!Array.isArray(citedLocations) || citedLocations.length !== 1) return null;
  const marker = citedLocations[0];
  if (typeof marker !== "object" || marker === null) return null;
  const candidate = marker as Record<string, unknown>;
  return candidate.schemaVersion === RETRACTION_EVENT_SCHEMA &&
    typeof candidate.predecessorSourceReferenceId === "string"
    ? candidate.predecessorSourceReferenceId
    : null;
}

async function validateDecisionExperiments(
  transaction: ResearchTransaction,
  researchId: string,
  experimentIds: readonly string[],
  decision: ConcludeResearchInput["decision"],
) {
  if (new Set(experimentIds).size !== experimentIds.length) throw decisionInvalid();
  if (experimentIds.length === 0) return;
  const experiments = await transaction.experiment.findMany({
    where: { researchId, id: { in: [...experimentIds] } },
    select: { id: true, state: true },
  });
  if (experiments.length !== experimentIds.length) throw decisionInvalid();
  const hasUnresolved = experiments.some(({ state }) => state !== "CONCLUDED");
  if (hasUnresolved && !["REFINE", "RUN_ANOTHER_EXPERIMENT"].includes(decision)) {
    throw decisionInvalid();
  }
}

function sourceId(reference: string): string | null {
  if (!reference.startsWith("research-source:")) return null;
  const id = reference.slice("research-source:".length);
  return z.string().uuid().safeParse(id).success ? id : null;
}

export type LockedResearch = Readonly<{
  id: string;
  projectId: string;
  workstreamId: string | null;
  workItemId: string | null;
  ownerId: string;
  state: import("@evaluation/contracts").ResearchState;
  version: number;
}>;

export function scopeOf(root: {
  projectId: string;
  workstreamId: string | null;
  workItemId: string | null;
}): import("@evaluation/contracts").ResearchScope {
  return {
    projectId: root.projectId,
    workstreamId: root.workstreamId,
    workItemId: root.workItemId,
  };
}

export async function updateResearchVersion(
  transaction: ResearchTransaction,
  researchId: string,
  expectedVersion: number,
  data: Parameters<ResearchTransaction["researchRecord"]["updateMany"]>[0]["data"],
) {
  const updated = await transaction.researchRecord.updateMany({
    where: { id: researchId, version: expectedVersion },
    data,
  });
  if (updated.count !== 1) throw versionConflict();
}

export function assertVersion(actual: number, expected: number) {
  if (actual !== expected) throw versionConflict();
}

export function researchAudit(
  command: Readonly<{ actor: ResearchActor; correlationId: string }>,
  projectId: string,
  researchId: string,
  eventType: string,
  safeDiff: Readonly<Record<string, unknown>>,
  reason?: string,
): import("@evaluation/contracts").AuditEventInput {
  return {
    eventType,
    actor: { kind: "human", id: command.actor.userId },
    effectiveSubjectId: command.actor.userId,
    scopeType: "project",
    scopeId: projectId,
    targetType: "research_record",
    targetId: researchId,
    reason,
    safeDiff,
    correlationId: command.correlationId,
    source: "api",
  };
}

export function assertHumanOwner(actor: ResearchActor, ownerId: string) {
  if (!actor.active || actor.userId !== ownerId) throw forbidden();
}

function validInstant(at: Date) {
  if (!Number.isFinite(at.getTime())) throw forbidden();
  return at;
}

export const SERIALIZABLE = { isolationLevel: "Serializable" as const };

export function forbidden(): AppError {
  return new AppError("RESEARCH_FORBIDDEN", "errors.research.forbidden", 403);
}

export function versionConflict(): AppError {
  return new AppError("RESEARCH_VERSION_CONFLICT", "errors.research.versionConflict", 409);
}

export function decisionInvalid(): AppError {
  return new AppError("RESEARCH_DECISION_INVALID", "errors.research.decisionInvalid", 409);
}
