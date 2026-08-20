import { AppError } from "@evaluation/contracts";

import { projectResearchDetail, projectResearchRevision } from "./research-service.js";

const RETRACTION_EVENT_SCHEMA = "research-source-retraction.v1";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type Actor = Readonly<{ userId: string; active: boolean }>;
type ResearchScope = import("@evaluation/contracts").ResearchScope;

type ScopeAuthorizer = Readonly<{
  authorize(input: Readonly<{ actor: Actor; scope: ResearchScope; at: Date }>): Promise<unknown>;
}>;

type Dependencies = Readonly<{
  database: DatabaseClient;
  authorizer: ScopeAuthorizer;
  clock?: () => Date;
}>;

export type ResearchQueryResult = Readonly<{
  detail: import("@evaluation/contracts").ResearchDetail;
  participantEvents: ReadonlyArray<
    Readonly<{
      id: string;
      employeeId: string;
      role: "OWNER" | "CONTRIBUTOR";
      action: "STARTED" | "ENDED";
      effectiveAt: string;
      reason: string;
      actorId: string;
      createdAt: string;
    }>
  >;
  transitions: ReadonlyArray<
    Readonly<{
      id: string;
      fromState: import("@evaluation/contracts").ResearchState | null;
      toState: import("@evaluation/contracts").ResearchState;
      reason: string | null;
      successorResearchId: string | null;
      actorId: string;
      resultingVersion: number;
      effectiveAt: string;
      createdAt: string;
    }>
  >;
  sourceReferences: ReadonlyArray<
    Readonly<{
      id: string;
      kind:
        | "PAPER"
        | "REPOSITORY"
        | "DOCUMENTATION"
        | "DATASET"
        | "BENCHMARK"
        | "COURSE_VIDEO"
        | "INTERNAL_DOCUMENT"
        | "LINK"
        | "OTHER";
      title: string;
      canonicalUrl: string | null;
      relevanceNote: string;
      credibilityNote: string;
      state: "ACTIVE" | "RETRACTED" | "SUPERSEDED";
      reason: string | null;
      sourceReviewId: string | null;
      documentVersionId: string | null;
      addedById: string;
      createdAt: string;
    }>
  >;
  conclusions: ReadonlyArray<
    Readonly<{
      id: string;
      synthesis: string;
      answer: string;
      remainingUncertainty: readonly string[];
      decision: import("@evaluation/contracts").ConcludeResearchInput["decision"];
      rationale: string;
      nextAction: string;
      confirmerId: string;
      confirmedAt: string;
    }>
  >;
  appliedLearning: ReadonlyArray<
    Readonly<{
      id: string;
      researchConclusionId: string;
      targetKind: import("@evaluation/contracts").CreateAppliedLearningInput["target"]["kind"];
      whatChanged: string;
      causalRationale: string;
      confirmerId: string;
      confirmedAt: string;
    }>
  >;
}>;

export class ResearchQueryService {
  readonly #database: DatabaseClient;
  readonly #authorizer: ScopeAuthorizer;
  readonly #clock: () => Date;

  constructor(dependencies: Dependencies) {
    this.#database = dependencies.database;
    this.#authorizer = dependencies.authorizer;
    this.#clock = dependencies.clock ?? (() => new Date());
  }

  async read(input: Readonly<{ actor: Actor; researchId: string }>): Promise<ResearchQueryResult> {
    assertActiveActor(input.actor);
    const at = validInstant(this.#clock());
    const root = await this.#database.researchRecord.findUnique({
      where: { id: input.researchId },
      include: {
        revisions: { orderBy: { revision: "desc" } },
        participantEvents: { orderBy: [{ effectiveAt: "asc" }, { id: "asc" }] },
        transitions: { orderBy: [{ effectiveAt: "asc" }, { id: "asc" }] },
        sourceReferences: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
        researchConclusions: { orderBy: [{ confirmedAt: "asc" }, { id: "asc" }] },
        appliedLearning: { orderBy: [{ confirmedAt: "asc" }, { id: "asc" }] },
      },
    });
    if (root === null) throw forbidden();
    if (root.state === "DRAFT" && root.ownerId !== input.actor.userId) throw forbidden();
    await this.#authorizer
      .authorize({
        actor: input.actor,
        scope: {
          projectId: root.projectId,
          workstreamId: root.workstreamId,
          workItemId: root.workItemId,
        },
        at,
      })
      .catch(() => {
        throw forbidden();
      });
    const currentRevision = root.revisions.find(({ revision }) => revision === root.revision);
    if (currentRevision === undefined) throw invalidHistory();
    const retractedSourceIds = new Set(
      root.sourceReferences
        .filter(({ state }) => state === "RETRACTED")
        .map(({ citedLocations }) => retractionPredecessor(citedLocations))
        .filter((id): id is string => id !== null),
    );
    return {
      detail: projectResearchDetail({ ...root, revisions: [currentRevision] }),
      participantEvents: root.participantEvents.map((event) => ({
        id: event.id,
        employeeId: event.employeeId,
        role: event.role,
        action: event.action,
        effectiveAt: event.effectiveAt.toISOString(),
        reason: event.reason,
        actorId: event.actorId,
        createdAt: event.createdAt.toISOString(),
      })),
      transitions: root.transitions.map((transition) => ({
        id: transition.id,
        fromState: transition.fromState,
        toState: transition.toState,
        reason: transition.reason,
        successorResearchId: transition.successorResearchId,
        actorId: transition.actorId,
        resultingVersion: transition.resultingVersion,
        effectiveAt: transition.effectiveAt.toISOString(),
        createdAt: transition.createdAt.toISOString(),
      })),
      sourceReferences: root.sourceReferences
        .filter(({ id, state }) => state === "ACTIVE" && !retractedSourceIds.has(id))
        .map((source) => ({
          id: source.id,
          kind: source.kind,
          title: source.title,
          canonicalUrl: source.canonicalUrl,
          relevanceNote: source.relevanceNote,
          credibilityNote: source.credibilityNote,
          state: source.state,
          reason: source.reason,
          sourceReviewId: source.sourceReviewId,
          documentVersionId: source.documentVersionId,
          addedById: source.addedById,
          createdAt: source.createdAt.toISOString(),
        })),
      conclusions: root.researchConclusions.map((conclusion) => ({
        id: conclusion.id,
        synthesis: conclusion.synthesis,
        answer: conclusion.answer,
        remainingUncertainty: stringArray(conclusion.remainingUncertainty),
        decision: conclusion.decision,
        rationale: conclusion.rationale,
        nextAction: conclusion.nextAction,
        confirmerId: conclusion.confirmerId,
        confirmedAt: conclusion.confirmedAt.toISOString(),
      })),
      appliedLearning: root.appliedLearning.map((learning) => ({
        id: learning.id,
        researchConclusionId: learning.researchConclusionId,
        targetKind: learning.targetKind,
        whatChanged: learning.whatChanged,
        causalRationale: learning.causalRationale,
        confirmerId: learning.confirmerId,
        confirmedAt: learning.confirmedAt.toISOString(),
      })),
    };
  }

  async authorizeAppliedLearningTarget(
    input: Readonly<{ actor: Actor; projectId: string; researchId: string }>,
  ): Promise<Readonly<{ id: string; projectId: string }>> {
    const result = await this.read({ actor: input.actor, researchId: input.researchId }).catch(
      () => {
        throw forbidden();
      },
    );
    if (result.detail.scope.projectId !== input.projectId) throw forbidden();
    return { id: result.detail.id, projectId: result.detail.scope.projectId };
  }

  async readDraft(input: Readonly<{ actor: Actor; researchId: string; revision: number }>) {
    assertActiveActor(input.actor);
    if (!Number.isInteger(input.revision) || input.revision < 1) throw forbidden();
    const at = validInstant(this.#clock());
    const root = await this.#database.researchRecord.findUnique({
      where: { id: input.researchId },
      select: {
        ownerId: true,
        projectId: true,
        workstreamId: true,
        workItemId: true,
        revisions: { where: { revision: input.revision, origin: "AI_DRAFT" } },
      },
    });
    if (root === null || root.ownerId !== input.actor.userId) throw forbidden();
    await this.#authorizer.authorize({ actor: input.actor, scope: root, at }).catch(() => {
      throw forbidden();
    });
    const revision = root.revisions[0];
    if (revision === undefined) throw forbidden();
    return projectResearchRevision(revision);
  }

  async list(input: Readonly<{ actor: Actor; projectId: string }>): Promise<
    ReadonlyArray<{
      id: string;
      projectId: string;
      workstreamId: string | null;
      workItemId: string | null;
      ownerId: string;
      state: import("@evaluation/contracts").ResearchState;
      revision: number;
      version: number;
      createdAt: string;
      transitionedAt: string;
    }>
  > {
    assertActiveActor(input.actor);
    const at = validInstant(this.#clock());
    await this.#authorizer
      .authorize({
        actor: input.actor,
        scope: { projectId: input.projectId, workstreamId: null, workItemId: null },
        at,
      })
      .catch(() => {
        throw forbidden();
      });
    const roots = await this.#database.researchRecord.findMany({
      where: {
        projectId: input.projectId,
        OR: [{ state: { not: "DRAFT" } }, { ownerId: input.actor.userId }],
      },
      orderBy: [{ transitionedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        projectId: true,
        workstreamId: true,
        workItemId: true,
        ownerId: true,
        state: true,
        revision: true,
        version: true,
        createdAt: true,
        transitionedAt: true,
      },
    });
    const visible = [];
    for (const root of roots) {
      try {
        await this.#authorizer.authorize({
          actor: input.actor,
          scope: {
            projectId: root.projectId,
            workstreamId: root.workstreamId,
            workItemId: root.workItemId,
          },
          at,
        });
        visible.push({
          ...root,
          createdAt: root.createdAt.toISOString(),
          transitionedAt: root.transitionedAt.toISOString(),
        });
      } catch {
        // Narrower-scope authorization is deliberately filtered without leaking existence.
      }
    }
    return visible;
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

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function assertActiveActor(actor: Actor): void {
  if (!actor.active) throw forbidden();
}

function validInstant(at: Date): Date {
  if (!Number.isFinite(at.getTime())) throw forbidden();
  return at;
}

function forbidden(): AppError {
  return new AppError("RESEARCH_FORBIDDEN", "errors.research.forbidden", 403);
}

function invalidHistory(): AppError {
  return new AppError("RESEARCH_HISTORY_INVALID", "errors.research.historyInvalid", 500);
}
