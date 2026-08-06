import { AppError } from "@evaluation/contracts";
import type { DatabaseClient } from "@evaluation/database";

import { projectExperimentDetail } from "./experiment-service.js";

type ResearchScope = import("@evaluation/contracts").ResearchScope;
type ExperimentDetail = import("@evaluation/contracts").ExperimentDetail;

export type ExperimentRunProjection = Readonly<{
  id: string;
  experimentId: string;
  methodRevisionId: string;
  sequence: number;
  executorId: string;
  startedAt: string;
  completedAt: string;
  resultStatus: import("@evaluation/contracts").RecordExperimentRunInput["resultStatus"];
  environment: ReadonlyArray<{ name: string; value: string }>;
  inputs: ReadonlyArray<{ name: string; value: string }>;
  modelConfigurations: ReadonlyArray<{ name: string; value: string }>;
  unexpectedConditions: readonly string[];
  executionNotes: string;
  sourceReferences: readonly string[];
  observations: ReadonlyArray<{
    id: string;
    measureStableId: string;
    testCaseId: string | null;
    observedValue: string;
    unit: string | null;
    note: string | null;
    supersedesObservationId: string | null;
    correctionReason: string | null;
    createdAt: string;
  }>;
  createdAt: string;
}>;

export type ExperimentQueryResult = Readonly<{
  detail: ExperimentDetail;
  methodRevisions: ReadonlyArray<ExperimentDetail["currentMethod"]>;
  runs: ReadonlyArray<ExperimentRunProjection>;
  conclusions: ReadonlyArray<{
    id: string;
    outcome: import("@evaluation/contracts").ConcludeExperimentInput["outcome"];
    summary: string;
    runIds: readonly string[];
    measureStableIds: readonly string[];
    limitations: readonly string[];
    confidenceDescription: string;
    decisionRelevance: string;
    nextStep: string;
    aiRunId: string | null;
    confirmerId: string;
    confirmedAt: string;
    createdAt: string;
  }>;
}>;

type Actor = Readonly<{ userId: string; active: boolean }>;
type ScopeAuthorizer = Readonly<{
  authorize(input: Readonly<{ actor: Actor; scope: ResearchScope; at: Date }>): Promise<unknown>;
}>;

type Dependencies = Readonly<{
  database: DatabaseClient;
  authorizer: ScopeAuthorizer;
  clock?: () => Date;
}>;

const detailInclude = {
  research: { select: { projectId: true, ownerId: true, state: true } },
  methodRevisions: {
    include: {
      measures: { orderBy: { stableId: "asc" as const } },
      testCases: { orderBy: { id: "asc" as const } },
      controls: { orderBy: { position: "asc" as const } },
    },
    orderBy: { revision: "desc" as const },
  },
  runs: {
    include: {
      observations: {
        include: { measure: true, testCase: true },
        orderBy: { createdAt: "asc" as const },
      },
    },
    orderBy: { sequence: "asc" as const },
  },
  conclusions: { orderBy: { confirmedAt: "asc" as const } },
} as const;

export class ExperimentQueryService {
  readonly #database: DatabaseClient;
  readonly #authorizer: ScopeAuthorizer;
  readonly #clock: () => Date;

  constructor(dependencies: Dependencies) {
    this.#database = dependencies.database;
    this.#authorizer = dependencies.authorizer;
    this.#clock = dependencies.clock ?? (() => new Date());
  }

  async read(
    input: Readonly<{ actor: Actor; experimentId: string }>,
  ): Promise<ExperimentQueryResult> {
    if (!input.actor.active) throw forbidden();
    const at = this.#clock();
    if (!Number.isFinite(at.getTime())) throw forbidden();
    const root = await this.#database.experiment.findUnique({
      where: { id: input.experimentId },
      include: detailInclude,
    });
    if (root === null) throw forbidden();
    if (root.state === "DRAFT" && root.research.ownerId !== input.actor.userId) throw forbidden();
    const scope = {
      projectId: root.research.projectId,
      workstreamId: root.workstreamId,
      workItemId: root.workItemId,
    };
    await this.#authorizer.authorize({ actor: input.actor, scope, at }).catch(() => {
      throw forbidden();
    });
    return {
      detail: projectExperimentDetail(root),
      methodRevisions: root.methodRevisions.map(projectMethodRevision),
      runs: root.runs.map(projectRun),
      conclusions: root.conclusions.map((conclusion) => ({
        id: conclusion.id,
        outcome: conclusion.outcome,
        summary: conclusion.summary,
        runIds: stringArray(conclusion.runIds),
        measureStableIds: stringArray(conclusion.measureStableIds),
        limitations: stringArray(conclusion.limitations),
        confidenceDescription: conclusion.confidenceDescription,
        decisionRelevance: conclusion.decisionRelevance,
        nextStep: conclusion.nextStep,
        aiRunId: conclusion.aiRunId,
        confirmerId: conclusion.confirmerId,
        confirmedAt: conclusion.confirmedAt.toISOString(),
        createdAt: conclusion.createdAt.toISOString(),
      })),
    };
  }

  async list(input: Readonly<{ actor: Actor; researchId: string }>): Promise<
    ReadonlyArray<{
      id: string;
      researchId: string;
      projectId: string;
      workstreamId: string | null;
      workItemId: string | null;
      title: string;
      state: import("@evaluation/contracts").ExperimentState;
      methodRevision: number;
      version: number;
      createdAt: string;
      transitionedAt: string;
    }>
  > {
    if (!input.actor.active) throw forbidden();
    const at = this.#clock();
    const research = await this.#database.researchRecord.findUnique({
      where: { id: input.researchId },
      select: { projectId: true, workstreamId: true, workItemId: true, ownerId: true },
    });
    if (research === null) throw forbidden();
    await this.#authorizer
      .authorize({
        actor: input.actor,
        scope: {
          projectId: research.projectId,
          workstreamId: research.workstreamId,
          workItemId: research.workItemId,
        },
        at,
      })
      .catch(() => {
        throw forbidden();
      });
    const roots = await this.#database.experiment.findMany({
      where: {
        researchId: input.researchId,
        OR: [{ state: { not: "DRAFT" } }, { research: { ownerId: input.actor.userId } }],
      },
      orderBy: [{ transitionedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        researchId: true,
        workstreamId: true,
        workItemId: true,
        title: true,
        state: true,
        methodRevision: true,
        version: true,
        createdAt: true,
        transitionedAt: true,
      },
    });
    return roots.map((root) => ({
      ...root,
      projectId: research.projectId,
      createdAt: root.createdAt.toISOString(),
      transitionedAt: root.transitionedAt.toISOString(),
    }));
  }
}

function projectMethodRevision(method: any): ExperimentDetail["currentMethod"] {
  return {
    id: method.id,
    revision: method.revision,
    question: method.question,
    baseline: {
      description: method.baselineDescription,
      value: method.baselineValue,
      sourceReference: nullableJsonString(method.baselineReference),
    },
    measures: method.measures.map((measure: any) => ({
      stableId: measure.stableId,
      name: measure.name,
      kind: measure.kind,
      unit: measure.unit,
      direction: measure.direction,
      baselineValue: measure.baselineValue,
      baselineReference: nullableJsonString(measure.baselineReference),
      interpretationRule: measure.interpretationRule,
    })),
    testCases: method.testCases.map((testCase: any) => ({
      id: testCase.id,
      inputIdentity: testCase.inputIdentity,
      expectedObservation: testCase.expectedObservation,
      category: testCase.category,
      inclusionReason: testCase.inclusionReason,
    })),
    controls: method.controls.map((control: any) => ({
      comparisonTarget: control.comparisonTarget,
      constantConditions: control.constantConditions,
    })),
    conditions: stringArray(method.conditions),
    reproducibilityInstructions: method.reproducibilityInstructions,
    knownRisks: stringArray(method.knownRisks),
    failureCases: stringArray(method.failureCases),
    sourceReferences: stringArray(method.sourceReferences),
    executionMode: method.executionMode,
    origin: method.origin,
    aiProvenance:
      method.origin === "AI_DRAFT"
        ? { promptVersion: method.promptVersion, routeTrace: method.routeTrace }
        : null,
    authorId: method.authorId,
    createdAt: method.createdAt.toISOString(),
  };
}

function projectRun(run: any): ExperimentRunProjection {
  return {
    id: run.id,
    experimentId: run.experimentId,
    methodRevisionId: run.methodRevisionId,
    sequence: run.sequence,
    executorId: run.executorId,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt.toISOString(),
    resultStatus: run.resultStatus,
    environment: configEntries(run.environment),
    inputs: configEntries(run.inputs),
    modelConfigurations: configEntries(run.modelConfigurations),
    unexpectedConditions: stringArray(run.unexpectedConditions),
    executionNotes: run.executionNotes,
    sourceReferences: stringArray(run.sourceReferences),
    observations: run.observations.map((observation: any) => ({
      id: observation.id,
      measureStableId: observation.measure.stableId,
      testCaseId: observation.testCaseId,
      observedValue: observation.observedValue,
      unit: observation.unit,
      note: observation.note,
      supersedesObservationId: observation.supersedesObservationId,
      correctionReason: observation.correctionReason,
      createdAt: observation.createdAt.toISOString(),
    })),
    createdAt: run.createdAt.toISOString(),
  };
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    throw invalidHistory();
  return value;
}

function configEntries(value: unknown): Array<{ name: string; value: string }> {
  if (!Array.isArray(value)) throw invalidHistory();
  return value.map((entry) => {
    if (typeof entry !== "object" || entry === null) throw invalidHistory();
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.name !== "string" || typeof candidate.value !== "string")
      throw invalidHistory();
    return { name: candidate.name, value: candidate.value };
  });
}

function nullableJsonString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw invalidHistory();
  return value;
}

function forbidden() {
  return new AppError("RESEARCH_FORBIDDEN", "errors.research.forbidden", 403);
}

function invalidHistory() {
  return new AppError(
    "EXPERIMENT_HISTORY_INVALID",
    "errors.research.experimentHistoryInvalid",
    500,
  );
}
