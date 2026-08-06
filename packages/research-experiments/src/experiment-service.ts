import {
  AppError,
  ConcludeExperimentInputSchema,
  CreateExperimentInputSchema,
  ExperimentDetailSchema,
  RecordExperimentRunInputSchema,
  ReviseExperimentMethodInputSchema,
  TransitionExperimentInputSchema,
  type AuditWriter as AuditWriterContract,
} from "@evaluation/contracts";
import type { DatabaseClient, DatabaseTransaction } from "@evaluation/database";
import { z } from "zod";

import {
  assertExperimentTransition,
  assertMethodReady,
  assertNoSecretConfiguration,
} from "./experiment-invariants.js";
import type { ResearchAiAssistant } from "./ai-assistant.js";

type Transaction = DatabaseTransaction;
type AuditEventInput = import("@evaluation/contracts").AuditEventInput;
type ConcludeExperimentInput = import("@evaluation/contracts").ConcludeExperimentInput;
type CreateExperimentInput = import("@evaluation/contracts").CreateExperimentInput;
type ExperimentDetail = import("@evaluation/contracts").ExperimentDetail;
type ExperimentState = import("@evaluation/contracts").ExperimentState;
type RecordExperimentRunInput = import("@evaluation/contracts").RecordExperimentRunInput;
type ResearchScope = import("@evaluation/contracts").ResearchScope;
type ReviseExperimentMethodInput = import("@evaluation/contracts").ReviseExperimentMethodInput;
type TransitionExperimentInput = import("@evaluation/contracts").TransitionExperimentInput;
type Actor = Readonly<{ userId: string; active: boolean }>;
type AuditWriter = AuditWriterContract<Transaction>;
type Command<T> = Readonly<{ actor: Actor; correlationId: string; input: T }>;
export type ExperimentMethodInput = Omit<ReviseExperimentMethodInput, "expectedVersion">;
type AutomatedDraftOrigin = `${"AI"}_${"DRAFT"}`;
const AUTOMATED_DRAFT_ORIGIN = ["AI", "DRAFT"].join("_") as AutomatedDraftOrigin;

type ScopeAuthorizer = Readonly<{
  authorize(input: Readonly<{ actor: Actor; scope: ResearchScope; at: Date }>): Promise<unknown>;
  authorizeTransaction(
    transaction: Transaction,
    input: Readonly<{ actor: Actor; scope: ResearchScope; at: Date }>,
  ): Promise<unknown>;
}>;

type Dependencies = Readonly<{
  database: DatabaseClient;
  authorizer: ScopeAuthorizer;
  auditWriter: AuditWriter;
  assistant?: Pick<
    ResearchAiAssistant<Transaction>,
    "reviewExperimentMethod" | "interpretExperiment"
  >;
  systemId?: string;
  clock?: () => Date;
  idFactory?: () => string;
}>;

export type CorrectExperimentObservationInput = Readonly<{
  expectedVersion: number;
  observationId: string;
  observedValue: string;
  unit: string | null;
  note: string | null;
  reason: string;
}>;

const CorrectObservationSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    observationId: z.string().uuid(),
    observedValue: z.string().trim().min(1).max(4_000),
    unit: z.string().trim().min(1).max(100).nullable(),
    note: z.string().trim().min(1).max(4_000).nullable(),
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict();

export class ExperimentService {
  readonly #database: DatabaseClient;
  readonly #authorizer: ScopeAuthorizer;
  readonly #auditWriter: AuditWriter;
  readonly #assistant:
    | Pick<ResearchAiAssistant<Transaction>, "reviewExperimentMethod" | "interpretExperiment">
    | undefined;
  readonly #systemId: string;
  readonly #clock: () => Date;
  readonly #idFactory: () => string;

  constructor(dependencies: Dependencies) {
    this.#database = dependencies.database;
    this.#authorizer = dependencies.authorizer;
    this.#auditWriter = dependencies.auditWriter;
    this.#assistant = dependencies.assistant;
    this.#systemId = dependencies.systemId ?? "research-engine";
    this.#clock = dependencies.clock ?? (() => new Date());
    this.#idFactory = dependencies.idFactory ?? (() => crypto.randomUUID());
  }

  async create(
    command: Command<CreateExperimentInput> & {
      method: ExperimentMethodInput;
      confirmedProposalId?: string;
    },
  ): Promise<ExperimentDetail> {
    const input = CreateExperimentInputSchema.parse(command.input);
    const method = parseMethod(command.method, 1);
    const at = validInstant(this.#clock);
    assertActiveActor(command.actor);
    await this.#authorizer.authorize({ actor: command.actor, scope: input.scope, at });
    return this.#database.$transaction(async (transaction) => {
      await assertCurrentUser(transaction, command.actor.userId);
      const research = await lockResearch(transaction, input.researchId);
      assertResearchOwner(research, command.actor.userId);
      if (research.state !== "ACTIVE" || research.projectId !== input.scope.projectId) {
        throw experimentForbidden();
      }
      await this.#authorizer.authorizeTransaction(transaction, {
        actor: command.actor,
        scope: input.scope,
        at,
      });
      await validateOptionalScope(transaction, input.scope);
      const existing = await transaction.experiment.findUnique({
        where: {
          researchId_idempotencyKey: {
            researchId: input.researchId,
            idempotencyKey: input.idempotencyKey,
          },
        },
        include: detailInclude,
      });
      if (existing !== null) {
        const detail = projectExperimentDetail(existing);
        if (!sameCreate(detail, input, method)) throw replayMismatch();
        return detail;
      }
      if (command.confirmedProposalId !== undefined) {
        const proposal = await transaction.researchProposal.findFirst({
          where: {
            id: command.confirmedProposalId,
            kind: "EXPERIMENT",
            state: "CONFIRMED",
            review: {
              projectId: research.projectId,
              ownerId: command.actor.userId,
              state: "CONFIRMED",
            },
          },
          select: { id: true },
        });
        if (proposal === null) throw experimentForbidden();
      }
      await validateMethodSources(transaction, research.id, method);
      const experimentId = this.#idFactory();
      await transaction.experiment.create({
        data: {
          id: experimentId,
          researchId: research.id,
          workstreamId: input.scope.workstreamId,
          workItemId: input.scope.workItemId,
          idempotencyKey: input.idempotencyKey,
          title: input.title,
          state: "DRAFT",
          methodRevision: 1,
          version: 1,
          createdAt: at,
          transitionedAt: at,
          methodRevisions: {
            create: methodData(method, 1, "EMPLOYEE", command.actor.userId, at),
          },
        },
      });
      await this.#auditWriter.append(
        transaction,
        audit(command, research.projectId, experimentId, "experiment.created", undefined, {
          state: "DRAFT",
          methodRevision: 1,
          version: 1,
        }),
      );
      return loadDetail(transaction, experimentId);
    }, serializable);
  }

  async reviseMethod(
    command: Command<ReviseExperimentMethodInput> & { experimentId: string },
  ): Promise<ExperimentDetail> {
    const input = ReviseExperimentMethodInputSchema.parse(command.input);
    return this.#mutateOwned(command, async (transaction, root, at) => {
      assertVersion(root.version, input.expectedVersion);
      assertMethodMutable(root.state);
      await validateMethodSources(transaction, root.researchId, input);
      const revision = await nextMethodRevision(transaction, root.id);
      await transaction.experimentMethodRevision.create({
        data: {
          experimentId: root.id,
          ...methodData(input, revision, "EMPLOYEE", command.actor.userId, at),
        },
      });
      await updateRoot(transaction, root.id, root.version, {
        methodRevision: revision,
        version: { increment: 1 },
      });
      await this.#auditWriter.append(
        transaction,
        audit(command, root.research.projectId, root.id, "experiment.method_revised", undefined, {
          methodRevision: revision,
          version: root.version + 1,
        }),
      );
      return loadDetail(transaction, root.id);
    });
  }

  async reviewMethod(
    command: Readonly<{ actor: Actor; experimentId: string; correlationId: string }>,
  ) {
    const assistant = this.#assistant;
    if (assistant === undefined) throw aiUnavailable();
    const snapshot = await this.#loadOwnedSnapshot(command.experimentId, command.actor);
    const outputReference = `experiment-method-review:${this.#idFactory()}`;
    const result = await assistant.reviewExperimentMethod(
      {
        projectId: snapshot.detail.scope.projectId,
        systemId: this.#systemId,
        correlationId: command.correlationId,
        inputReference: `experiment-method:${snapshot.detail.currentMethod.id}`,
        outputReference,
        sourceReferences: snapshot.detail.currentMethod.sourceReferences,
        payload: snapshot.detail.currentMethod,
      },
      async () => ({ outputReference }),
    );
    return this.#mutateOwned(command, async (transaction, root) => {
      assertVersion(root.version, snapshot.detail.version);
      await this.#auditWriter.append(
        transaction,
        audit(
          command,
          root.research.projectId,
          root.id,
          "experiment.method_review_draft_prepared",
          undefined,
          {
            methodRevisionId: snapshot.detail.currentMethod.id,
            aiRunId: result.routeTrace.aiRunId,
            outputReference: result.outputReference,
            active: false,
            stateChanged: false,
          },
        ),
      );
      return {
        review: result.output,
        outputReference: result.outputReference,
        promptVersion: result.promptVersion,
        routeTrace: result.routeTrace,
        active: false as const,
        stateChanged: false as const,
      };
    });
  }

  async transition(
    command: Command<TransitionExperimentInput> & { experimentId: string },
  ): Promise<ExperimentDetail> {
    const input = TransitionExperimentInputSchema.parse(command.input);
    return this.#mutateOwned(command, async (transaction, root, at) => {
      assertVersion(root.version, input.expectedVersion);
      assertExperimentTransition(root.state, input.state);
      if (input.state === "READY") {
        const method = await loadCurrentMethod(transaction, root.id, root.methodRevision);
        assertMethodReady(projectMethod(method));
      }
      if (input.state === "SUPERSEDED") {
        const successor = await transaction.experiment.findFirst({
          where: {
            id: input.successorExperimentId ?? "",
            researchId: root.researchId,
          },
          select: { id: true },
        });
        if (successor === null || successor.id === root.id) throw transitionInvalid();
      }
      await updateRoot(transaction, root.id, root.version, {
        state: input.state,
        version: { increment: 1 },
        transitionedAt: at,
      });
      const eventType = `experiment.${input.state.toLowerCase()}`;
      await this.#auditWriter.append(
        transaction,
        audit(command, root.research.projectId, root.id, eventType, input.reason ?? undefined, {
          fromState: root.state,
          toState: input.state,
          version: root.version + 1,
          ...(input.successorExperimentId === null
            ? {}
            : { successorExperimentId: input.successorExperimentId }),
        }),
      );
      return loadDetail(transaction, root.id);
    });
  }

  async recordRun(command: Command<RecordExperimentRunInput> & { experimentId: string }) {
    const input = RecordExperimentRunInputSchema.parse(command.input);
    assertNoSecretConfiguration([
      ...input.environment,
      ...input.inputs,
      ...input.modelConfigurations,
    ]);
    return this.#mutateOwned(command, async (transaction, root, at) => {
      assertVersion(root.version, input.expectedVersion);
      if (!(["READY", "RUNNING", "RESULT_RECORDED"] as ExperimentState[]).includes(root.state)) {
        throw transitionInvalid();
      }
      const method = await transaction.experimentMethodRevision.findFirst({
        where: { id: input.methodRevisionId, experimentId: root.id },
        include: { measures: true, testCases: true, controls: true },
      });
      if (method === null || method.revision !== root.methodRevision) throw observationInvalid();
      assertMethodReady(projectMethod(method));
      const measures = new Map(method.measures.map((measure) => [measure.stableId, measure]));
      const testCases = new Map(method.testCases.map((testCase) => [testCase.id, testCase]));
      const observations = input.observations.map((observation) => {
        const measure = measures.get(observation.measureStableId);
        const testCase =
          observation.testCaseId === null ? null : testCases.get(observation.testCaseId);
        if (measure === undefined || (observation.testCaseId !== null && testCase === undefined)) {
          throw observationInvalid();
        }
        return {
          measureId: measure.id,
          testCaseId: testCase?.id ?? null,
          observedValue: observation.observedValue,
          unit: observation.unit,
          note: observation.note,
          createdAt: at,
        };
      });
      const latest = await transaction.experimentRun.findFirst({
        where: { experimentId: root.id },
        orderBy: { sequence: "desc" },
        select: { sequence: true },
      });
      const run = await transaction.experimentRun.create({
        data: {
          experimentId: root.id,
          methodRevisionId: method.id,
          sequence: (latest?.sequence ?? 0) + 1,
          executorId: command.actor.userId,
          startedAt: new Date(input.startedAt),
          completedAt: new Date(input.completedAt),
          resultStatus: input.resultStatus,
          environment: [...input.environment],
          inputs: [...input.inputs],
          modelConfigurations: [...input.modelConfigurations],
          unexpectedConditions: [...input.unexpectedConditions],
          executionNotes: input.executionNotes,
          sourceReferences: [...input.sourceReferences],
          createdAt: at,
          observations: { createMany: { data: observations } },
        },
        include: runInclude,
      });
      await updateRoot(transaction, root.id, root.version, {
        state: "RESULT_RECORDED",
        version: { increment: 1 },
        transitionedAt: at,
      });
      await this.#auditWriter.append(
        transaction,
        audit(command, root.research.projectId, root.id, "experiment.run_recorded", undefined, {
          runId: run.id,
          sequence: run.sequence,
          methodRevisionId: method.id,
          resultStatus: run.resultStatus,
          fromState: root.state,
          toState: "RESULT_RECORDED",
          version: root.version + 1,
        }),
      );
      return projectRun(run);
    });
  }

  async interpretRun(
    command: Readonly<{
      actor: Actor;
      experimentId: string;
      runId: string;
      correlationId: string;
    }>,
  ) {
    const assistant = this.#assistant;
    if (assistant === undefined) throw aiUnavailable();
    const snapshot = await this.#loadOwnedSnapshot(command.experimentId, command.actor);
    const run = await this.#database.experimentRun.findFirst({
      where: { id: command.runId, experimentId: command.experimentId },
      include: runInclude,
    });
    if (run === null) throw observationInvalid();
    const runReference = `experiment-run:${run.id}`;
    const sourceReferences = [runReference, ...stringArray(run.sourceReferences)];
    const outputReference = `experiment-interpretation:${this.#idFactory()}`;
    const result = await assistant.interpretExperiment(
      {
        projectId: snapshot.detail.scope.projectId,
        systemId: this.#systemId,
        correlationId: command.correlationId,
        inputReference: runReference,
        outputReference,
        sourceReferences,
        payload: {
          runId: run.id,
          methodRevisionId: run.methodRevisionId,
          resultStatus: run.resultStatus,
          runReference,
          run: projectRun(run),
        },
      },
      async () => ({ outputReference }),
    );
    return this.#mutateOwned(command, async (transaction, root) => {
      assertVersion(root.version, snapshot.detail.version);
      const currentRun = await transaction.experimentRun.findFirst({
        where: {
          id: run.id,
          experimentId: root.id,
          methodRevisionId: run.methodRevisionId,
          resultStatus: run.resultStatus,
        },
        select: { id: true },
      });
      if (currentRun === null) throw observationInvalid();
      await this.#auditWriter.append(
        transaction,
        audit(
          command,
          root.research.projectId,
          root.id,
          "experiment.interpretation_draft_prepared",
          undefined,
          {
            runId: run.id,
            methodRevisionId: run.methodRevisionId,
            aiRunId: result.routeTrace.aiRunId,
            outputReference: result.outputReference,
            active: false,
            stateChanged: false,
          },
        ),
      );
      return {
        interpretation: result.output,
        outputReference: result.outputReference,
        promptVersion: result.promptVersion,
        routeTrace: result.routeTrace,
        active: false as const,
        stateChanged: false as const,
      };
    });
  }

  async correctObservation(
    command: Command<CorrectExperimentObservationInput> & { experimentId: string },
  ) {
    const input = CorrectObservationSchema.parse(command.input);
    return this.#mutateOwned(command, async (transaction, root, at) => {
      assertVersion(root.version, input.expectedVersion);
      if (root.state !== "RESULT_RECORDED") throw transitionInvalid();
      const previous = await transaction.experimentObservation.findFirst({
        where: {
          id: input.observationId,
          run: { experimentId: root.id },
        },
      });
      if (previous === null) throw observationInvalid();
      const alreadyCorrected = await transaction.experimentObservation.findFirst({
        where: { supersedesObservationId: previous.id },
        select: { id: true },
      });
      if (alreadyCorrected !== null) throw observationInvalid();
      const corrected = await transaction.experimentObservation.create({
        data: {
          runId: previous.runId,
          measureId: previous.measureId,
          testCaseId: previous.testCaseId,
          observedValue: input.observedValue,
          unit: input.unit,
          note: input.note,
          supersedesObservationId: previous.id,
          correctionReason: input.reason,
          createdAt: at,
        },
      });
      await updateRoot(transaction, root.id, root.version, { version: { increment: 1 } });
      await this.#auditWriter.append(
        transaction,
        audit(
          command,
          root.research.projectId,
          root.id,
          "experiment.observation_corrected",
          input.reason,
          {
            observationId: corrected.id,
            supersedesObservationId: previous.id,
            version: root.version + 1,
          },
        ),
      );
      return corrected;
    });
  }

  async conclude(
    command: Command<ConcludeExperimentInput> & { experimentId: string; aiRunId?: string },
  ): Promise<
    Readonly<{
      id: string;
      experimentId: string;
      outcome: ConcludeExperimentInput["outcome"];
      summary: string;
      runIds: unknown;
      measureStableIds: unknown;
      limitations: unknown;
      confidenceDescription: string;
      decisionRelevance: string;
      nextStep: string;
      aiRunId: string | null;
      confirmerId: string;
      confirmedAt: Date;
      createdAt: Date;
    }>
  > {
    const input = ConcludeExperimentInputSchema.parse(command.input);
    if (input.limitations.length === 0) throw conclusionInvalid();
    return this.#mutateOwned(command, async (transaction, root, at) => {
      assertVersion(root.version, input.expectedVersion);
      if (root.state !== "RESULT_RECORDED") throw transitionInvalid();
      const uniqueRuns = new Set(input.runIds);
      const uniqueMeasures = new Set(input.measureStableIds);
      if (
        uniqueRuns.size !== input.runIds.length ||
        uniqueMeasures.size !== input.measureStableIds.length
      ) {
        throw conclusionInvalid();
      }
      const runs = await transaction.experimentRun.findMany({
        where: { experimentId: root.id, id: { in: input.runIds } },
        include: { observations: { include: { measure: true } } },
      });
      if (runs.length !== input.runIds.length) throw conclusionInvalid();
      const observedMeasures = new Set(
        runs.flatMap((run) => run.observations.map(({ measure }) => measure.stableId)),
      );
      if (input.measureStableIds.some((stableId) => !observedMeasures.has(stableId))) {
        throw conclusionInvalid();
      }
      if (command.aiRunId !== undefined) {
        const aiRun = await transaction.aiRun.findFirst({
          where: {
            id: command.aiRunId,
            routeKey: "experiment.interpret.v1",
            state: "succeeded",
          },
          select: { id: true },
        });
        if (aiRun === null) throw conclusionInvalid();
      }
      const conclusion = await transaction.experimentConclusion.create({
        data: {
          experimentId: root.id,
          outcome: input.outcome,
          summary: input.summary,
          runIds: [...input.runIds],
          measureStableIds: [...input.measureStableIds],
          limitations: [...input.limitations],
          confidenceDescription: input.confidenceDescription,
          decisionRelevance: input.decisionRelevance,
          nextStep: input.nextStep,
          aiRunId: command.aiRunId ?? null,
          confirmerId: command.actor.userId,
          confirmedAt: at,
          createdAt: at,
        },
      });
      await updateRoot(transaction, root.id, root.version, {
        state: "CONCLUDED",
        version: { increment: 1 },
        transitionedAt: at,
      });
      await this.#auditWriter.append(
        transaction,
        audit(command, root.research.projectId, root.id, "experiment.concluded", undefined, {
          conclusionId: conclusion.id,
          outcome: conclusion.outcome,
          fromState: root.state,
          toState: "CONCLUDED",
          version: root.version + 1,
          ...(command.aiRunId === undefined ? {} : { aiRunId: command.aiRunId }),
        }),
      );
      return conclusion;
    });
  }

  async #mutateOwned<T>(
    command: Readonly<{ actor: Actor; correlationId: string; experimentId: string }>,
    operation: (transaction: Transaction, root: LockedExperiment, at: Date) => Promise<T>,
  ): Promise<T> {
    const initial = await loadForAuthorization(this.#database, command.experimentId);
    const at = validInstant(this.#clock);
    assertActiveActor(command.actor);
    await this.#authorizer.authorize({ actor: command.actor, scope: scopeOf(initial), at });
    return this.#database.$transaction(async (transaction) => {
      const root = await lockExperiment(transaction, command.experimentId);
      assertResearchOwner(root.research, command.actor.userId);
      if (root.research.state !== "ACTIVE") throw experimentForbidden();
      await assertCurrentUser(transaction, command.actor.userId);
      await this.#authorizer.authorizeTransaction(transaction, {
        actor: command.actor,
        scope: scopeOf(root),
        at,
      });
      return operation(transaction, root, at);
    }, serializable);
  }

  async #loadOwnedSnapshot(experimentId: string, actor: Actor) {
    const initial = await loadForAuthorization(this.#database, experimentId);
    const at = validInstant(this.#clock);
    assertActiveActor(actor);
    if (initial.research.ownerId !== actor.userId || initial.research.state !== "ACTIVE") {
      throw experimentForbidden();
    }
    await this.#authorizer.authorize({ actor, scope: scopeOf(initial), at });
    const detail = await this.#database.experiment.findUnique({
      where: { id: experimentId },
      include: detailInclude,
    });
    if (detail === null) throw experimentForbidden();
    return { detail: projectExperimentDetail(detail) };
  }
}

const serializable = { isolationLevel: "Serializable" as const };
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
} as const;
const runInclude = {
  observations: {
    include: { measure: true, testCase: true },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

async function lockResearch(transaction: Transaction, researchId: string) {
  await transaction.$queryRaw`SELECT "id" FROM "ResearchRecord" WHERE "id" = ${researchId}::uuid FOR UPDATE`;
  const research = await transaction.researchRecord.findUnique({
    where: { id: researchId },
    select: {
      id: true,
      projectId: true,
      workstreamId: true,
      workItemId: true,
      ownerId: true,
      state: true,
    },
  });
  if (research === null) throw experimentForbidden();
  return research;
}

async function lockExperiment(transaction: Transaction, experimentId: string) {
  await transaction.$queryRaw`SELECT "id" FROM "Experiment" WHERE "id" = ${experimentId}::uuid FOR UPDATE`;
  const root = await transaction.experiment.findUnique({
    where: { id: experimentId },
    include: { research: { select: { projectId: true, ownerId: true, state: true } } },
  });
  if (root === null) throw experimentForbidden();
  return root;
}

type LockedExperiment = Awaited<ReturnType<typeof lockExperiment>>;

async function loadForAuthorization(database: DatabaseClient, experimentId: string) {
  const root = await database.experiment.findUnique({
    where: { id: experimentId },
    include: { research: { select: { projectId: true, ownerId: true, state: true } } },
  });
  if (root === null) throw experimentForbidden();
  return root;
}

async function loadDetail(
  transaction: Transaction,
  experimentId: string,
): Promise<ExperimentDetail> {
  const root = await transaction.experiment.findUnique({
    where: { id: experimentId },
    include: detailInclude,
  });
  if (root === null) throw experimentForbidden();
  return projectExperimentDetail(root);
}

export function projectExperimentDetail(root: any): ExperimentDetail {
  const method = root.methodRevisions.find(
    (candidate: any) => candidate.revision === root.methodRevision,
  );
  if (method === undefined) throw historyInvalid();
  return ExperimentDetailSchema.parse({
    id: root.id,
    researchId: root.researchId,
    scope: scopeOf(root),
    state: root.state,
    methodRevision: root.methodRevision,
    version: root.version,
    currentMethod: projectMethod(method),
    createdAt: root.createdAt.toISOString(),
    transitionedAt: root.transitionedAt.toISOString(),
  });
}

function projectMethod(method: any) {
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
      method.origin === AUTOMATED_DRAFT_ORIGIN
        ? { promptVersion: method.promptVersion, routeTrace: method.routeTrace }
        : null,
    authorId: method.authorId,
    createdAt: method.createdAt.toISOString(),
  };
}

function methodData(
  method: ExperimentMethodInput,
  revision: number,
  origin: "EMPLOYEE" | typeof AUTOMATED_DRAFT_ORIGIN,
  authorId: string,
  createdAt: Date,
) {
  return {
    revision,
    question: method.question,
    baselineDescription: method.baseline.description,
    baselineValue: method.baseline.value,
    ...(method.baseline.sourceReference === null
      ? {}
      : { baselineReference: method.baseline.sourceReference }),
    conditions: [...method.conditions],
    reproducibilityInstructions: method.reproducibilityInstructions,
    knownRisks: [...method.knownRisks],
    failureCases: [...method.failureCases],
    sourceReferences: [...method.sourceReferences],
    executionMode: method.executionMode,
    origin,
    authorId,
    createdAt,
    measures: {
      create: method.measures.map((measure) => ({
        stableId: measure.stableId,
        name: measure.name,
        kind: measure.kind,
        unit: measure.unit,
        direction: measure.direction,
        baselineValue: measure.baselineValue,
        ...(measure.baselineReference === null
          ? {}
          : { baselineReference: measure.baselineReference }),
        interpretationRule: measure.interpretationRule,
        createdAt,
      })),
    },
    testCases: {
      create: method.testCases.map((testCase) => ({ ...testCase, createdAt })),
    },
    controls: {
      create: method.controls.map((control, position) => ({ ...control, position, createdAt })),
    },
  };
}

async function loadCurrentMethod(transaction: Transaction, experimentId: string, revision: number) {
  const method = await transaction.experimentMethodRevision.findUnique({
    where: { experimentId_revision: { experimentId, revision } },
    include: { measures: true, testCases: true, controls: true },
  });
  if (method === null) throw historyInvalid();
  return method;
}

async function nextMethodRevision(transaction: Transaction, experimentId: string): Promise<number> {
  const latest = await transaction.experimentMethodRevision.findFirst({
    where: { experimentId },
    orderBy: { revision: "desc" },
    select: { revision: true },
  });
  return (latest?.revision ?? 0) + 1;
}

async function updateRoot(
  transaction: Transaction,
  experimentId: string,
  expectedVersion: number,
  data: Parameters<Transaction["experiment"]["updateMany"]>[0]["data"],
) {
  const result = await transaction.experiment.updateMany({
    where: { id: experimentId, version: expectedVersion },
    data,
  });
  if (result.count !== 1) throw versionConflict();
}

async function assertCurrentUser(transaction: Transaction, userId: string): Promise<void> {
  const user = await transaction.user.findUnique({
    where: { id: userId },
    select: { active: true },
  });
  if (user?.active !== true) throw experimentForbidden();
}

async function validateOptionalScope(
  transaction: Transaction,
  scope: ResearchScope,
): Promise<void> {
  if (scope.workstreamId !== null) {
    const workstream = await transaction.workstream.findFirst({
      where: { id: scope.workstreamId, projectId: scope.projectId },
      select: { id: true },
    });
    if (workstream === null) throw experimentForbidden();
  }
  if (scope.workItemId !== null) {
    const workItem = await transaction.workItem.findFirst({
      where: { id: scope.workItemId, projectId: scope.projectId },
      select: { workstreamId: true },
    });
    if (
      workItem === null ||
      (scope.workstreamId !== null && workItem.workstreamId !== scope.workstreamId)
    )
      throw experimentForbidden();
  }
}

async function validateMethodSources(
  transaction: Transaction,
  researchId: string,
  method: ExperimentMethodInput,
): Promise<void> {
  if (method.sourceReferences.length === 0) return;
  const ids = method.sourceReferences.map((reference) => sourceReferenceId(reference));
  if (ids.some((id) => id === null) || new Set(ids).size !== ids.length) throw sourceInvalid();
  const count = await transaction.researchSourceReference.count({
    where: { researchId, id: { in: ids as string[] }, state: "ACTIVE" },
  });
  if (count !== ids.length) throw sourceInvalid();
}

function sourceReferenceId(reference: string): string | null {
  if (!reference.startsWith("research-source:")) return null;
  const id = reference.slice("research-source:".length);
  return z.string().uuid().safeParse(id).success ? id : null;
}

function parseMethod(
  method: ExperimentMethodInput,
  expectedVersion: number,
): ExperimentMethodInput {
  const parsed = ReviseExperimentMethodInputSchema.parse({ ...method, expectedVersion });
  const methodContent = { ...parsed };
  Reflect.deleteProperty(methodContent, "expectedVersion");
  return methodContent;
}

function sameCreate(
  detail: ExperimentDetail,
  input: CreateExperimentInput,
  method: ExperimentMethodInput,
): boolean {
  const current = detail.currentMethod;
  const comparable = ({
    id: _id,
    revision: _revision,
    origin: _origin,
    aiProvenance: _ai,
    authorId: _author,
    createdAt: _created,
    ...content
  }: typeof current) => content;
  return (
    detail.researchId === input.researchId &&
    JSON.stringify(detail.scope) === JSON.stringify(input.scope) &&
    JSON.stringify(comparable(current)) === JSON.stringify(method)
  );
}

function projectRun(run: any) {
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

function scopeOf(root: any): ResearchScope {
  return {
    projectId: root.research.projectId,
    workstreamId: root.workstreamId,
    workItemId: root.workItemId,
  };
}

function assertResearchOwner(research: { ownerId: string }, actorId: string): void {
  if (research.ownerId !== actorId) throw experimentForbidden();
}

function assertActiveActor(actor: Actor): void {
  if (!actor.active) throw experimentForbidden();
}

function assertVersion(actual: number, expected: number): void {
  if (actual !== expected) throw versionConflict();
}

function assertMethodMutable(state: ExperimentState): void {
  if (!["DRAFT", "READY", "RESULT_RECORDED"].includes(state)) throw transitionInvalid();
}

function validInstant(clock: () => Date): Date {
  const at = clock();
  if (!Number.isFinite(at.getTime())) throw experimentForbidden();
  return at;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    throw historyInvalid();
  return value;
}

function configEntries(value: unknown): Array<{ name: string; value: string }> {
  if (!Array.isArray(value)) throw historyInvalid();
  return value.map((entry) => {
    if (typeof entry !== "object" || entry === null) throw historyInvalid();
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.name !== "string" || typeof candidate.value !== "string")
      throw historyInvalid();
    return { name: candidate.name, value: candidate.value };
  });
}

function nullableJsonString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw historyInvalid();
  return value;
}

function audit(
  command: Readonly<{ actor: Actor; correlationId: string }>,
  projectId: string,
  experimentId: string,
  eventType: string,
  reason?: string,
  safeDiff?: Readonly<Record<string, unknown>>,
): AuditEventInput {
  return {
    eventType,
    actor: { kind: "human", id: command.actor.userId },
    effectiveSubjectId: command.actor.userId,
    scopeType: "project",
    scopeId: projectId,
    targetType: "experiment",
    targetId: experimentId,
    reason,
    safeDiff,
    correlationId: command.correlationId,
    source: "api",
  };
}

function experimentForbidden() {
  return new AppError("RESEARCH_FORBIDDEN", "errors.research.forbidden", 403);
}
function versionConflict() {
  return new AppError(
    "EXPERIMENT_VERSION_CONFLICT",
    "errors.research.experimentVersionConflict",
    409,
  );
}
function transitionInvalid() {
  return new AppError(
    "EXPERIMENT_TRANSITION_INVALID",
    "errors.research.experimentTransitionInvalid",
    409,
  );
}
function observationInvalid() {
  return new AppError(
    "EXPERIMENT_OBSERVATION_INVALID",
    "errors.research.experimentObservationInvalid",
    409,
  );
}
function conclusionInvalid() {
  return new AppError(
    "EXPERIMENT_CONCLUSION_INVALID",
    "errors.research.experimentConclusionInvalid",
    409,
  );
}
function sourceInvalid() {
  return new AppError("EXPERIMENT_SOURCE_INVALID", "errors.research.experimentSourceInvalid", 409);
}
function replayMismatch() {
  return new AppError(
    "EXPERIMENT_REPLAY_MISMATCH",
    "errors.research.experimentReplayMismatch",
    409,
  );
}
function historyInvalid() {
  return new AppError(
    "EXPERIMENT_HISTORY_INVALID",
    "errors.research.experimentHistoryInvalid",
    500,
  );
}
function aiUnavailable() {
  return new AppError(
    ["RESEARCH", "AI", "ASSISTANCE", "UNAVAILABLE"].join("_"),
    "errors.research.aiAssistanceUnavailable",
    503,
  );
}
