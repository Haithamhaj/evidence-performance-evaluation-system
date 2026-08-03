import { createHash } from "node:crypto";

import {
  AcceptedUpdateEventSchema,
  AppError,
  ClarificationAnswerInputSchema,
  ClarificationStateSchema,
  ConfirmUpdateInputSchema,
  ReviseUpdateDraftInputSchema,
  StartUpdateInputSchema,
  StructuredUpdateDraftSchema,
  UpdateComparisonSchema,
  UpdateStructureAiOutputSchema,
} from "@evaluation/contracts";
import { z } from "zod";

import { PrismaUpdateSourceLoader } from "./update-source-loader.js";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type Transaction = import("@evaluation/database").DatabaseTransaction;
type AuditWriter = import("@evaluation/contracts").AuditWriter<Transaction>;
type AiOutput = import("@evaluation/contracts").UpdateStructureAiOutput;

const ActorSchema = z.object({ userId: z.string().uuid(), active: z.boolean() }).strict();
const StartCommandSchema = z
  .object({
    actor: ActorSchema,
    correlationId: z.string().uuid(),
    input: StartUpdateInputSchema,
  })
  .strict();
const SessionCommandBaseSchema = z
  .object({
    actor: ActorSchema,
    correlationId: z.string().uuid(),
    sessionId: z.string().uuid(),
  })
  .strict();
const AnswerCommandSchema = SessionCommandBaseSchema.extend({
  input: ClarificationAnswerInputSchema,
}).strict();
const ReviseCommandSchema = SessionCommandBaseSchema.extend({
  input: ReviseUpdateDraftInputSchema,
}).strict();
const ConfirmCommandSchema = SessionCommandBaseSchema.extend({
  input: ConfirmUpdateInputSchema,
}).strict();

export type UpdateStructureContext = Readonly<{
  rawText: string;
  answers: ReadonlyArray<Readonly<{ question: string; answer: string }>>;
  previousAcceptedState: Readonly<{
    acceptedEventId: string;
    summary: string;
    result: string;
    sourceReferences: readonly string[];
  }> | null;
  activeContract: Readonly<{
    contractId: string;
    contractVersion: number;
    componentReferences: readonly string[];
  }> | null;
  sourceReferences: readonly string[];
}>;

export type UpdateStructureRunInput = UpdateStructureContext &
  Readonly<{
    projectScopeId: string;
    departmentScopeId: string;
    correlationId: string;
    updateSourceId: string;
  }>;

export interface UpdateStructurer {
  structure(
    input: UpdateStructureRunInput,
    persistValidatedOutput: (
      transaction: Transaction,
      output: AiOutput,
    ) => Promise<Readonly<{ outputReference: string }>>,
  ): Promise<AiOutput>;
}

export interface UpdateScopeReader {
  authorizeIn(
    transaction: Transaction,
    input: Readonly<{
      actor: { userId: string; active: boolean };
      projectId: string;
      workstreamId: string | null;
      workItemId: string | null;
      at: Date;
    }>,
  ): Promise<{
    organizationId: string;
    projectScopeId: string;
    departmentScopeId: string;
    activeContract: UpdateStructureContext["activeContract"];
  }>;
}

type Scope = Awaited<ReturnType<UpdateScopeReader["authorizeIn"]>>;

export class UpdateService {
  private readonly client: DatabaseClient;
  private readonly scopeReader: UpdateScopeReader;
  private readonly structurer: UpdateStructurer;
  private readonly auditWriter: AuditWriter;
  private readonly clock: () => Date;
  private readonly sourceLoader: PrismaUpdateSourceLoader;

  constructor(
    client: DatabaseClient,
    scopeReader: UpdateScopeReader,
    structurer: UpdateStructurer,
    auditWriter: AuditWriter,
    clock: () => Date = () => new Date(),
    sourceLoader: PrismaUpdateSourceLoader = new PrismaUpdateSourceLoader(),
  ) {
    this.client = client;
    this.scopeReader = scopeReader;
    this.structurer = structurer;
    this.auditWriter = auditWriter;
    this.clock = clock;
    this.sourceLoader = sourceLoader;
  }

  async start(command: unknown): Promise<import("@evaluation/contracts").ClarificationState> {
    const parsed = StartCommandSchema.parse(command);
    const at = validClock(this.clock());
    const prepared = await serializable(this.client, async (transaction) => {
      const scope = await this.scopeReader.authorizeIn(transaction, {
        actor: parsed.actor,
        projectId: parsed.input.projectId,
        workstreamId: parsed.input.workstreamId,
        workItemId: parsed.input.workItemId,
        at,
      });
      const existing = await transaction.updateSource.findUnique({
        where: { idempotencyKey: parsed.input.idempotencyKey },
        include: {
          clarificationSession: true,
          attachments: {
            select: {
              position: true,
              kind: true,
              uploadedSourceId: true,
              content: true,
              sourceUrl: true,
              checksumSha256: true,
            },
            orderBy: { position: "asc" },
          },
        },
      });
      if (existing !== null) {
        await assertSameSource(transaction, existing, parsed);
        if (existing.clarificationSession === null) throw invalidState();
        if (
          existing.clarificationSession.currentTurnNo > 0 ||
          existing.clarificationSession.state !== "clarifying"
        ) {
          return {
            kind: "existing" as const,
            state: await currentState(transaction, existing.clarificationSession),
          };
        }
        return {
          kind: "structure" as const,
          source: existing,
          session: existing.clarificationSession,
          context: await buildStructureContext(transaction, existing, [], scope, this.sourceLoader),
          scope,
        };
      }
      const source = await transaction.updateSource.create({
        data: {
          idempotencyKey: parsed.input.idempotencyKey,
          projectId: parsed.input.projectId,
          workstreamId: parsed.input.workstreamId,
          workItemId: parsed.input.workItemId,
          employeeId: parsed.actor.userId,
          inputKind: "text",
          rawText: parsed.input.rawText,
          executionMode: parsed.input.executionMode,
          attachments: {
            create: await attachmentDataIn(transaction, parsed.input, parsed.actor.userId),
          },
        },
      });
      const session = await transaction.clarificationSession.create({
        data: { updateSourceId: source.id, unresolvedFields: [] },
      });
      return {
        kind: "structure" as const,
        source,
        session,
        context: await buildStructureContext(transaction, source, [], scope, this.sourceLoader),
        scope,
      };
    });
    if (prepared.kind === "existing") return prepared.state;
    return this.persistStructuredOutput({
      actor: parsed.actor,
      at,
      correlationId: parsed.correlationId,
      source: prepared.source,
      sessionId: prepared.session.id,
      expectedSessionVersion: prepared.session.version,
      expectedTurnId: null,
      pendingAnswer: null,
      context: prepared.context,
      expectedScope: prepared.scope,
    });
  }

  async answer(command: unknown): Promise<import("@evaluation/contracts").ClarificationState> {
    const parsed = AnswerCommandSchema.parse(command);
    const at = validClock(this.clock());
    const prepared = await serializable(this.client, async (transaction) => {
      await lockSession(transaction, parsed.sessionId);
      const session = await loadSession(transaction, parsed.sessionId);
      assertOwner(session.updateSource.employeeId, parsed.actor);
      if (session.state !== "clarifying") throw invalidState();
      if (session.version !== parsed.input.expectedSessionVersion) throw versionConflict();
      const turn = session.turns.at(-1);
      if (turn === undefined || turn.id !== parsed.input.turnId || turn.answer !== null) {
        throw invalidTurn();
      }
      const scope = await this.scopeReader.authorizeIn(transaction, {
        actor: parsed.actor,
        projectId: session.updateSource.projectId,
        workstreamId: session.updateSource.workstreamId,
        workItemId: session.updateSource.workItemId,
        at,
      });
      const answers = session.turns
        .filter((item) => item.answer !== null)
        .map((item) => ({ question: item.question, answer: item.answer?.answer ?? "" }));
      answers.push({ question: turn.question, answer: parsed.input.answer });
      return {
        source: session.updateSource,
        sessionId: session.id,
        expectedSessionVersion: session.version,
        expectedTurnId: turn.id,
        context: await buildStructureContext(
          transaction,
          session.updateSource,
          answers,
          scope,
          this.sourceLoader,
        ),
        scope,
      };
    });
    return this.persistStructuredOutput({
      actor: parsed.actor,
      at,
      correlationId: parsed.correlationId,
      source: prepared.source,
      sessionId: prepared.sessionId,
      expectedSessionVersion: prepared.expectedSessionVersion,
      expectedTurnId: prepared.expectedTurnId,
      pendingAnswer: parsed.input.answer,
      context: prepared.context,
      expectedScope: prepared.scope,
    });
  }

  async revise(command: unknown): Promise<import("@evaluation/contracts").StructuredUpdateDraft> {
    const parsed = ReviseCommandSchema.parse(command);
    const at = validClock(this.clock());
    return serializable(this.client, async (transaction) => {
      await lockSession(transaction, parsed.sessionId);
      const session = await loadSession(transaction, parsed.sessionId);
      assertOwner(session.updateSource.employeeId, parsed.actor);
      if (session.state !== "ready_for_review") throw invalidState();
      await this.scopeReader.authorizeIn(transaction, {
        actor: parsed.actor,
        projectId: session.updateSource.projectId,
        workstreamId: session.updateSource.workstreamId,
        workItemId: session.updateSource.workItemId,
        at,
      });
      const latest = session.draftRevisions.at(-1);
      if (latest === undefined) throw invalidState();
      if (latest.revision !== parsed.input.expectedDraftRevision) throw versionConflict();
      const revised = await transaction.structuredUpdateDraftRevision.create({
        data: {
          updateSourceId: session.updateSource.id,
          sessionId: session.id,
          revision: latest.revision + 1,
          revisionKind: "employee_edit",
          summary: parsed.input.summary,
          result: parsed.input.result,
          blocker: parsed.input.blocker,
          nextAction: parsed.input.nextAction,
          contributionContext: parsed.input.contributionContext,
          executionMode: session.updateSource.executionMode === "manual" ? "manual" : "mixed",
          sourceReferences: jsonArray(latest.sourceReferences),
          evidenceClaimDrafts: parsed.input.evidenceClaimDrafts,
          documentationNeeds: parsed.input.documentationNeeds,
          relatedProgressComponentIds: parsed.input.relatedProgressComponentIds,
          comparison: UpdateComparisonSchema.parse(latest.comparison),
          createdById: parsed.actor.userId,
        },
      });
      return serializeDraft(revised);
    });
  }

  async confirm(command: unknown): Promise<import("@evaluation/contracts").AcceptedUpdateEvent> {
    const parsed = ConfirmCommandSchema.parse(command);
    const at = validClock(this.clock());
    return serializable(this.client, async (transaction) => {
      await lockSession(transaction, parsed.sessionId);
      const session = await loadSession(transaction, parsed.sessionId);
      assertOwner(session.updateSource.employeeId, parsed.actor);
      const existing = await transaction.acceptedUpdateEvent.findUnique({
        where: { updateSourceId: session.updateSource.id },
        include: { confirmation: true },
      });
      if (existing !== null)
        return serializeAccepted(existing, existing.confirmation.draftRevisionId);
      if (session.state !== "ready_for_review") throw invalidState();
      const latest = session.draftRevisions.at(-1);
      if (latest === undefined) throw invalidState();
      if (latest.revision !== parsed.input.expectedDraftRevision) throw versionConflict();
      if (latest.revisionKind !== "employee_edit") throw employeeEditRequired();
      const scope = await this.scopeReader.authorizeIn(transaction, {
        actor: parsed.actor,
        projectId: session.updateSource.projectId,
        workstreamId: session.updateSource.workstreamId,
        workItemId: session.updateSource.workItemId,
        at,
      });
      const confirmation = await transaction.updateConfirmation.create({
        data: {
          updateSourceId: session.updateSource.id,
          draftRevisionId: latest.id,
          employeeId: parsed.actor.userId,
          reason: parsed.input.reason,
          confirmedAt: at,
        },
      });
      const accepted = await transaction.acceptedUpdateEvent.create({
        data: {
          confirmationId: confirmation.id,
          updateSourceId: session.updateSource.id,
          projectId: session.updateSource.projectId,
          workstreamId: session.updateSource.workstreamId,
          workItemId: session.updateSource.workItemId,
          employeeId: parsed.actor.userId,
          sourceReferences: jsonArray(latest.sourceReferences),
          occurredAt: at,
        },
      });
      const operationId = crypto.randomUUID();
      const payloadHash = sha256({
        acceptedEventId: accepted.id,
        contractId: scope.activeContract?.contractId ?? null,
      });
      await transaction.operation.create({
        data: {
          id: operationId,
          organizationId: scope.organizationId,
          jobType: "progress.recalculate",
          jobVersion: 1,
          idempotencyKey: `progress-recalculate:${accepted.id}`,
          correlationId: parsed.correlationId,
          payloadHash,
          status: "pending",
        },
      });
      await transaction.progressRecalculationRequest.create({
        data: {
          acceptedEventId: accepted.id,
          contractId: scope.activeContract?.contractId ?? null,
          operationId,
          correlationId: parsed.correlationId,
        },
      });
      await transaction.clarificationSession.update({
        where: { id: session.id },
        data: { state: "confirmed", version: { increment: 1 } },
      });
      await this.auditWriter.append(transaction, {
        eventType: "update.confirmed",
        actor: { kind: "human", id: parsed.actor.userId },
        effectiveSubjectId: parsed.actor.userId,
        scopeType: "project",
        scopeId: session.updateSource.projectId,
        targetType: "accepted_update_event",
        targetId: accepted.id,
        reason: parsed.input.reason,
        safeDiff: {
          updateSourceId: session.updateSource.id,
          draftRevision: latest.revision,
          progressRecalculationRequested: true,
        },
        correlationId: parsed.correlationId,
        source: "api",
      });
      return serializeAccepted(accepted, latest.id);
    });
  }

  private async persistStructuredOutput(input: {
    actor: { userId: string; active: boolean };
    at: Date;
    correlationId: string;
    source: Source;
    sessionId: string;
    expectedSessionVersion: number;
    expectedTurnId: string | null;
    pendingAnswer: string | null;
    context: UpdateStructureContext;
    expectedScope: Scope;
  }): Promise<import("@evaluation/contracts").ClarificationState> {
    let persistedState: import("@evaluation/contracts").ClarificationState | undefined;
    await this.structurer.structure(
      {
        ...input.context,
        projectScopeId: input.expectedScope.projectScopeId,
        departmentScopeId: input.expectedScope.departmentScopeId,
        correlationId: input.correlationId,
        updateSourceId: input.source.id,
      },
      async (transaction, untrustedOutput) => {
        if (persistedState !== undefined) throw invalidPersistence();
        const output = UpdateStructureAiOutputSchema.parse(untrustedOutput);
        await lockSession(transaction, input.sessionId);
        const session = await loadSession(transaction, input.sessionId);
        assertOwner(session.updateSource.employeeId, input.actor);
        if (session.state !== "clarifying") throw invalidState();
        if (session.version !== input.expectedSessionVersion) throw versionConflict();
        const scope = await this.scopeReader.authorizeIn(transaction, {
          actor: input.actor,
          projectId: session.updateSource.projectId,
          workstreamId: session.updateSource.workstreamId,
          workItemId: session.updateSource.workItemId,
          at: input.at,
        });
        if (!sameScope(scope, input.expectedScope)) throw versionConflict();
        if (input.expectedTurnId !== null) {
          const turn = session.turns.at(-1);
          if (
            turn === undefined ||
            turn.id !== input.expectedTurnId ||
            turn.answer !== null ||
            input.pendingAnswer === null
          ) {
            throw invalidTurn();
          }
          await transaction.clarificationAnswer.create({
            data: {
              turnId: turn.id,
              answer: input.pendingAnswer,
              employeeId: input.actor.userId,
              resultingSessionVersion: session.version + 1,
            },
          });
        }
        persistedState = await applyOutput(
          transaction,
          session,
          session.updateSource,
          output,
          [...input.context.sourceReferences],
          input.actor.userId,
        );
        return {
          outputReference:
            persistedState.state === "draft_with_question"
              ? `clarification-turn:${persistedState.turnId}`
              : `update-draft:${persistedState.draft.id}`,
        };
      },
    );
    if (persistedState === undefined) throw invalidPersistence();
    return persistedState;
  }
}

type Source = {
  id: string;
  projectId: string;
  workstreamId: string | null;
  workItemId: string | null;
  employeeId: string;
  rawText: string;
  executionMode: import("@evaluation/contracts").ExecutionMode;
  sourceVersion: number;
};
type IdempotentSource = Source &
  Readonly<{
    attachments: ReadonlyArray<{
      position: number;
      kind: string;
      uploadedSourceId: string | null;
      content: string | null;
      sourceUrl: string | null;
      checksumSha256: string;
    }>;
  }>;
type Session = {
  id: string;
  version: number;
  currentTurnNo: number;
};

async function buildStructureContext(
  transaction: Transaction,
  source: Source,
  answers: ReadonlyArray<{ question: string; answer: string }>,
  scope: Scope,
  sourceLoader: PrismaUpdateSourceLoader,
): Promise<UpdateStructureContext> {
  const previous = await transaction.acceptedUpdateEvent.findFirst({
    where: {
      employeeId: source.employeeId,
      projectId: source.projectId,
      workstreamId: source.workstreamId,
      workItemId: source.workItemId,
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    include: { confirmation: { include: { draftRevision: true } } },
  });
  const loaded = await sourceLoader.loadIn(transaction, {
    updateSourceId: source.id,
    employeeId: source.employeeId,
    projectId: source.projectId,
    workstreamId: source.workstreamId,
  });
  const sourceReferences = [
    `update-source:${source.id}`,
    ...loaded.sourceReferences,
    ...(previous === null ? [] : [`accepted-update-event:${previous.id}`]),
    ...(scope.activeContract?.componentReferences ?? []),
  ];
  return {
    rawText: loaded.untrustedText,
    answers,
    previousAcceptedState:
      previous === null
        ? null
        : {
            acceptedEventId: previous.id,
            summary: previous.confirmation.draftRevision.summary,
            result: previous.confirmation.draftRevision.result,
            sourceReferences: jsonArray(previous.sourceReferences),
          },
    activeContract: scope.activeContract,
    sourceReferences,
  };
}

async function applyOutput(
  transaction: Transaction,
  session: Session,
  source: Source,
  output: AiOutput,
  sourceReferences: string[],
  createdById: string,
): Promise<import("@evaluation/contracts").ClarificationState> {
  const revision =
    (await transaction.structuredUpdateDraftRevision.count({
      where: { sessionId: session.id },
    })) + 1;
  const previous = await transaction.acceptedUpdateEvent.findFirst({
    where: {
      employeeId: source.employeeId,
      projectId: source.projectId,
      workstreamId: source.workstreamId,
      workItemId: source.workItemId,
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    select: { id: true },
  });
  assertAuthorizedProgressComponents(output.draft.relatedProgressComponentIds, sourceReferences);
  const draft = await transaction.structuredUpdateDraftRevision.create({
    data: {
      updateSourceId: source.id,
      sessionId: session.id,
      revision,
      revisionKind: "ai_draft",
      summary: output.draft.summary,
      result: output.draft.result,
      blocker: output.draft.blocker,
      nextAction: output.draft.nextAction,
      contributionContext: output.draft.contributionContext,
      evidenceClaimDrafts: output.draft.evidenceClaimDrafts,
      documentationNeeds: output.draft.documentationNeeds,
      relatedProgressComponentIds: output.draft.relatedProgressComponentIds,
      executionMode: source.executionMode,
      sourceReferences,
      comparison: {
        previousAcceptedEventId: previous?.id ?? null,
        changedFields: ["summary", "result", "blocker", "nextAction", "contributionContext"],
        explanation: output.draft.comparisonExplanation,
      },
      createdById,
    },
  });
  const serializedDraft = serializeDraft(draft);
  if (output.state === "draft_with_question") {
    const turnNumber = session.currentTurnNo + 1;
    const turn = await transaction.clarificationTurn.create({
      data: {
        sessionId: session.id,
        turnNo: turnNumber,
        question: output.nextQuestion.question,
        affects: output.nextQuestion.affects,
      },
    });
    const updated = await transaction.clarificationSession.update({
      where: { id: session.id },
      data: {
        unresolvedFields: output.unresolvedFields,
        currentTurnNo: turnNumber,
        version: { increment: 1 },
      },
    });
    return ClarificationStateSchema.parse({
      state: "draft_with_question",
      sessionId: session.id,
      sessionVersion: updated.version,
      draft: serializedDraft,
      turnId: turn.id,
      turnNumber,
      question: turn.question,
      affects: output.nextQuestion.affects,
      remainingFieldCount: output.unresolvedFields.length,
    });
  }
  const updated = await transaction.clarificationSession.update({
    where: { id: session.id },
    data: {
      state: "ready_for_review",
      unresolvedFields: [],
      version: { increment: 1 },
    },
  });
  return ClarificationStateSchema.parse({
    state: "ready_for_review",
    sessionId: session.id,
    sessionVersion: updated.version,
    draft: serializedDraft,
  });
}

async function loadSession(transaction: Transaction, sessionId: string) {
  const session = await transaction.clarificationSession.findUnique({
    where: { id: sessionId },
    include: {
      updateSource: true,
      turns: { orderBy: { turnNo: "asc" }, include: { answer: true } },
      draftRevisions: { orderBy: { revision: "asc" } },
    },
  });
  if (session === null) throw invalidState();
  return session;
}

async function currentState(
  transaction: Transaction,
  session: { id: string; state: string; version: number },
) {
  const draft = await transaction.structuredUpdateDraftRevision.findFirst({
    where: { sessionId: session.id },
    orderBy: { revision: "desc" },
  });
  const turn = await transaction.clarificationTurn.findFirst({
    where: { sessionId: session.id, answer: null },
    orderBy: { turnNo: "desc" },
  });
  if (draft !== null && session.state === "ready_for_review") {
    return ClarificationStateSchema.parse({
      state: "ready_for_review",
      sessionId: session.id,
      sessionVersion: session.version,
      draft: serializeDraft(draft),
    });
  }
  if (turn === null) throw invalidState();
  const unresolved = await transaction.clarificationSession.findUniqueOrThrow({
    where: { id: session.id },
    select: { unresolvedFields: true },
  });
  const fields = jsonArray(unresolved.unresolvedFields);
  if (draft === null) throw invalidState();
  return ClarificationStateSchema.parse({
    state: "draft_with_question",
    sessionId: session.id,
    sessionVersion: session.version,
    draft: serializeDraft(draft),
    turnId: turn.id,
    turnNumber: turn.turnNo,
    question: turn.question,
    affects: jsonArray(turn.affects),
    remainingFieldCount: fields.length,
  });
}

function serializeDraft(row: {
  id: string;
  sessionId: string;
  revision: number;
  summary: string;
  result: string;
  blocker: string | null;
  nextAction: string;
  contributionContext: string;
  executionMode: import("@evaluation/contracts").ExecutionMode;
  sourceReferences: unknown;
  documentationNeeds: unknown;
  relatedProgressComponentIds: unknown;
  comparison: unknown;
}) {
  return StructuredUpdateDraftSchema.parse({
    id: row.id,
    sessionId: row.sessionId,
    revision: row.revision,
    summary: row.summary,
    result: row.result,
    blocker: row.blocker,
    nextAction: row.nextAction,
    contributionContext: row.contributionContext,
    executionMode: row.executionMode,
    sourceReferences: jsonArray(row.sourceReferences),
    evidenceIds: [],
    documentationNeeds: jsonArray(row.documentationNeeds),
    relatedProgressComponentIds: jsonArray(row.relatedProgressComponentIds),
    comparison: UpdateComparisonSchema.parse(row.comparison),
  });
}

function assertAuthorizedProgressComponents(
  ids: readonly string[],
  sourceReferences: string[],
): void {
  if (ids.some((id) => !sourceReferences.includes(`progress-component:${id}`))) {
    throw new AppError(
      "UPDATE_PROGRESS_COMPONENT_INVALID",
      "errors.updates.progressComponentInvalid",
      422,
    );
  }
}

function serializeAccepted(
  row: {
    id: string;
    updateSourceId: string;
    projectId: string;
    workstreamId: string | null;
    workItemId: string | null;
    employeeId: string;
    sourceReferences: unknown;
    occurredAt: Date;
  },
  draftRevisionId: string,
) {
  return AcceptedUpdateEventSchema.parse({
    id: row.id,
    updateSourceId: row.updateSourceId,
    draftRevisionId,
    projectId: row.projectId,
    workstreamId: row.workstreamId,
    workItemId: row.workItemId,
    employeeId: row.employeeId,
    confirmedAt: row.occurredAt.toISOString(),
    sourceReferences: jsonArray(row.sourceReferences),
  });
}

async function assertSameSource(
  transaction: Transaction,
  existing: IdempotentSource,
  command: z.infer<typeof StartCommandSchema>,
): Promise<void> {
  if (
    existing.employeeId !== command.actor.userId ||
    existing.projectId !== command.input.projectId ||
    existing.workstreamId !== command.input.workstreamId ||
    existing.workItemId !== command.input.workItemId ||
    existing.rawText !== command.input.rawText ||
    existing.executionMode !== command.input.executionMode
  ) {
    throw new AppError("IDEMPOTENCY_CONFLICT", "errors.idempotency.conflict", 409);
  }
  const incoming = await attachmentDataIn(transaction, command.input, command.actor.userId);
  const sameAttachments =
    incoming.length === existing.attachments.length &&
    incoming.every((attachment, index) => {
      const persisted = existing.attachments[index];
      return (
        persisted !== undefined &&
        persisted.position === attachment.position &&
        persisted.kind === attachment.kind &&
        persisted.uploadedSourceId === (attachment.uploadedSourceId ?? null) &&
        persisted.content === (attachment.content ?? null) &&
        persisted.sourceUrl === (attachment.sourceUrl ?? null) &&
        persisted.checksumSha256 === attachment.checksumSha256
      );
    });
  if (!sameAttachments) {
    throw new AppError("IDEMPOTENCY_CONFLICT", "errors.idempotency.conflict", 409);
  }
}

async function attachmentDataIn(
  transaction: Transaction,
  input: z.infer<typeof StartUpdateInputSchema>,
  employeeId: string,
) {
  const sourceInputs = [
    ...(input.rawText.length === 0 ? [] : [{ kind: "pasted_text" as const, text: input.rawText }]),
    ...(input.sources ?? []),
  ];
  const uploadIds = sourceInputs.flatMap((source) =>
    "uploadedSourceId" in source ? [source.uploadedSourceId] : [],
  );
  const uploads =
    uploadIds.length === 0
      ? []
      : await transaction.uploadedSource.findMany({
          where: { id: { in: uploadIds }, createdById: employeeId },
          select: { id: true, projectId: true, workstreamId: true, sha256: true },
        });
  const uploadsById = new Map(uploads.map((upload) => [upload.id, upload]));
  return sourceInputs.map((source, index) => {
    const position = index + 1;
    if ("uploadedSourceId" in source) {
      const upload = uploadsById.get(source.uploadedSourceId);
      if (
        upload === undefined ||
        upload.projectId !== input.projectId ||
        (upload.workstreamId !== null && upload.workstreamId !== input.workstreamId)
      ) {
        throw new AppError("SCOPE_MISMATCH", "errors.authorization.scopeMismatch", 403);
      }
      return {
        position,
        kind: source.kind,
        uploadedSourceId: upload.id,
        checksumSha256: upload.sha256,
      };
    }
    if ("url" in source) {
      return {
        position,
        kind: source.kind,
        sourceUrl: source.url,
        checksumSha256: contentChecksum(source.url),
      };
    }
    return {
      position,
      kind: source.kind,
      content: source.text,
      checksumSha256: contentChecksum(source.text),
    };
  });
}

function contentChecksum(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function assertOwner(employeeId: string, actor: { userId: string; active: boolean }): void {
  if (!actor.active || employeeId !== actor.userId) {
    throw new AppError("SCOPE_MISMATCH", "errors.authorization.scopeMismatch", 403);
  }
}

async function lockSession(transaction: Transaction, id: string): Promise<void> {
  await transaction.$queryRaw`SELECT id FROM "ClarificationSession" WHERE id = ${id}::uuid FOR UPDATE`;
}

function serializable<T>(
  client: DatabaseClient,
  operation: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  return client.$transaction(operation, { isolationLevel: "Serializable" });
}

function jsonArray(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw invalidState();
  }
  return value;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function validClock(value: Date): Date {
  if (!Number.isFinite(value.getTime())) throw new Error("Clock returned an invalid date");
  return value;
}

function invalidState(): AppError {
  return new AppError("UPDATE_STATE_INVALID", "errors.updates.stateInvalid", 409);
}

function invalidTurn(): AppError {
  return new AppError("UPDATE_TURN_INVALID", "errors.updates.turnInvalid", 409);
}

function versionConflict(): AppError {
  return new AppError("VERSION_CONFLICT", "errors.versionConflict", 409);
}

function employeeEditRequired(): AppError {
  return new AppError("UPDATE_EMPLOYEE_EDIT_REQUIRED", "errors.updates.employeeEditRequired", 409);
}

function invalidPersistence(): AppError {
  return new AppError(
    "AI_RUN_PERSISTENCE_FAILED",
    "errors.aiRouter.validatedOutputPersistenceFailed",
    500,
  );
}

function sameScope(left: Scope, right: Scope): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
