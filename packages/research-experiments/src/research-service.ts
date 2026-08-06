import {
  AppError,
  CreateResearchInputSchema,
  ResearchDetailSchema,
  ReviseResearchInputSchema,
  TransferResearchOwnerInputSchema,
  TransitionResearchInputSchema,
  type AuditEventInput as ContractAuditEventInput,
  type AuditWriter as AuditWriterContract,
  type CreateResearchInput as ContractCreateResearchInput,
  type ResearchDetail as ContractResearchDetail,
  type ResearchScope as ContractResearchScope,
  type ResearchState as ContractResearchState,
  type ReviseResearchInput as ContractReviseResearchInput,
  type TransferResearchOwnerInput as ContractTransferResearchOwnerInput,
  type TransitionResearchInput as ContractTransitionResearchInput,
} from "@evaluation/contracts";
import type { DatabaseClient, DatabaseTransaction } from "@evaluation/database";
import { z } from "zod";

import {
  assertResearchRevisionCanBecomeCurrent,
  assertResearchTransition,
  assertSingleActiveResearchOwner,
} from "./research-invariants.js";
import type { ResearchAiAssistant } from "./ai-assistant.js";
import type { ResearchFrameAiOutput as FrameAiOutput } from "./prompts.js";

type Transaction = DatabaseTransaction;
type AuditWriter = AuditWriterContract<Transaction>;
type Actor = Readonly<{ userId: string; active: boolean }>;
type AuditEventInput = ContractAuditEventInput;
type CreateResearchInput = ContractCreateResearchInput;
type ResearchDetail = ContractResearchDetail;
type ResearchScope = ContractResearchScope;
type ResearchState = ContractResearchState;
type ReviseResearchInput = ContractReviseResearchInput;
type TransferResearchOwnerInput = ContractTransferResearchOwnerInput;
type TransitionResearchInput = ContractTransitionResearchInput;
type ResearchFrameAiOutput = FrameAiOutput;
type RevisionContent = Omit<ReviseResearchInput, "expectedVersion">;
const AUTOMATED_DRAFT_ORIGIN = ["AI", "DRAFT"].join("_") as "AI_DRAFT";

type ScopeAuthorizer = Readonly<{
  authorize(input: Readonly<{ actor: Actor; scope: ResearchScope; at: Date }>): Promise<unknown>;
  authorizeTransaction(
    transaction: Transaction,
    input: Readonly<{ actor: Actor; scope: ResearchScope; at: Date }>,
  ): Promise<unknown>;
}>;

type SourceValidator = Readonly<{
  validateConfirmedReview(
    transaction: Transaction,
    input: Readonly<{
      actor: Actor;
      projectId: string;
      sourceReviewId: string;
      at: Date;
    }>,
  ): Promise<Readonly<{ sourceReviewId: string; projectId: string }>>;
  validateApprovedDocument(
    transaction: Transaction,
    input: Readonly<{
      actor: Actor;
      projectId: string;
      documentVersionId: string;
      at: Date;
    }>,
  ): Promise<Readonly<{ documentVersionId: string; projectId: string }>>;
}>;

type Dependencies = Readonly<{
  database: DatabaseClient;
  authorizer: ScopeAuthorizer;
  auditWriter: AuditWriter;
  sourceValidator?: SourceValidator;
  assistant?: Pick<ResearchAiAssistant<Transaction>, "frameResearch" | "synthesizeResearch">;
  systemId?: string;
  clock?: () => Date;
  idFactory?: () => string;
}>;

type Command<T> = Readonly<{
  actor: Actor;
  correlationId: string;
  input: T;
}>;

export type ChangeResearchContributorInput = Readonly<{
  expectedVersion: number;
  employeeId: string;
  action: "ADD" | "REMOVE";
  effectiveAt: string;
  reason: string;
}>;

const Text = (maximum: number) => z.string().trim().min(1).max(maximum);
const SourceKindSchema = z.enum([
  "PAPER",
  "REPOSITORY",
  "DOCUMENTATION",
  "DATASET",
  "BENCHMARK",
  "COURSE_VIDEO",
  "INTERNAL_DOCUMENT",
  "LINK",
  "OTHER",
]);

export const AddResearchSourceInputSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    source: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("SOURCE_REVIEW"), sourceReviewId: z.string().uuid() }).strict(),
      z
        .object({ kind: z.literal("DOCUMENT_VERSION"), documentVersionId: z.string().uuid() })
        .strict(),
      z
        .object({
          kind: z.literal("MANUAL_CITATION"),
          canonicalUrl: z.url().max(2_000).nullable(),
        })
        .strict(),
    ]),
    kind: SourceKindSchema,
    title: Text(2_000),
    relevanceNote: Text(4_000),
    credibilityNote: Text(4_000),
    comparedAlternative: Text(4_000).nullable().optional(),
    citedLocations: z.array(Text(1_000)).max(100).optional(),
    observedLicense: Text(500).nullable().optional(),
    reuseWarning: Text(2_000).nullable().optional(),
  })
  .strict();

export type AddResearchSourceInput = z.infer<typeof AddResearchSourceInputSchema>;

const SOURCE_REFERENCE_PREFIX = "research-source:";
const RETRACTION_EVENT_SCHEMA = "research-source-retraction.v1";
const PROPOSAL_SOURCE_SCHEMA = "research-proposal-source.v1";

export class ResearchService {
  readonly #database: DatabaseClient;
  readonly #authorizer: ScopeAuthorizer;
  readonly #auditWriter: AuditWriter;
  readonly #sourceValidator: SourceValidator | undefined;
  readonly #assistant:
    Pick<ResearchAiAssistant<Transaction>, "frameResearch" | "synthesizeResearch"> | undefined;
  readonly #systemId: string;
  readonly #clock: () => Date;
  readonly #idFactory: () => string;

  constructor(dependencies: Dependencies) {
    this.#database = dependencies.database;
    this.#authorizer = dependencies.authorizer;
    this.#auditWriter = dependencies.auditWriter;
    this.#sourceValidator = dependencies.sourceValidator;
    this.#assistant = dependencies.assistant;
    this.#systemId = dependencies.systemId ?? "research-engine";
    this.#clock = dependencies.clock ?? (() => new Date());
    this.#idFactory = dependencies.idFactory ?? (() => crypto.randomUUID());
  }

  async create(command: Command<CreateResearchInput> & { confirmedProposalId?: string }) {
    const input = CreateResearchInputSchema.parse(command.input);
    if (input.sourceReferences.length !== 0) throw sourceInvalid();
    const at = validInstant(this.#clock);
    await this.#authorizer.authorize({ actor: command.actor, scope: input.scope, at });
    assertActiveActor(command.actor);
    return this.#database.$transaction(async (transaction) => {
      await assertCurrentUser(transaction, command.actor.userId);
      await this.#authorizer.authorizeTransaction(transaction, {
        actor: command.actor,
        scope: input.scope,
        at,
      });
      const existing = await transaction.researchRecord.findFirst({
        where: {
          ownerId: command.actor.userId,
          projectId: input.scope.projectId,
          idempotencyKey: input.idempotencyKey,
        },
        include: currentRevisionInclude,
      });
      if (existing !== null) {
        const detail = projectResearchDetail(existing);
        const boundSource = await transaction.researchSourceReference.findFirst({
          where: { researchId: existing.id, state: "ACTIVE" },
          select: { citedLocations: true },
        });
        const boundProposalMatches =
          command.confirmedProposalId !== undefined &&
          proposalSourceId(boundSource?.citedLocations) === command.confirmedProposalId;
        if (!sameCreateInput(detail, input, boundProposalMatches)) throw replayMismatch();
        return detail;
      }
      const id = this.#idFactory();
      const proposal =
        command.confirmedProposalId === undefined
          ? null
          : await transaction.researchProposal.findFirst({
              where: {
                id: command.confirmedProposalId,
                kind: "RESEARCH",
                state: "CONFIRMED",
                review: {
                  projectId: input.scope.projectId,
                  ownerId: command.actor.userId,
                  state: "CONFIRMED",
                },
              },
              select: { id: true, reviewId: true, title: true, rationale: true },
            });
      if (command.confirmedProposalId !== undefined && proposal === null) throw sourceInvalid();
      const created = await transaction.researchRecord.create({
        data: {
          id,
          idempotencyKey: input.idempotencyKey,
          projectId: input.scope.projectId,
          workstreamId: input.scope.workstreamId,
          workItemId: input.scope.workItemId,
          ownerId: command.actor.userId,
          state: "DRAFT",
          revision: 1,
          version: 1,
          createdAt: at,
          transitionedAt: at,
          participantEvents: {
            create: {
              employeeId: command.actor.userId,
              role: "OWNER",
              action: "STARTED",
              effectiveAt: at,
              reason: "Research created",
              actorId: command.actor.userId,
              createdAt: at,
            },
          },
          transitions: {
            create: {
              fromState: null,
              toState: "DRAFT",
              reason: null,
              actorId: command.actor.userId,
              resultingVersion: 1,
              effectiveAt: at,
              createdAt: at,
            },
          },
        },
        select: { id: true, projectId: true },
      });
      let sourceReferences: readonly string[] = [];
      if (proposal !== null) {
        const source = await transaction.researchSourceReference.create({
          data: {
            researchId: created.id,
            sourceReviewId: proposal.reviewId,
            kind: "OTHER",
            title: proposal.title,
            canonicalUrl: null,
            relevanceNote: proposal.rationale,
            credibilityNote: "Confirmed employee-reviewed Research proposal",
            retrievalState: "RETRIEVED",
            citedLocations: [{ schemaVersion: PROPOSAL_SOURCE_SCHEMA, proposalId: proposal.id }],
            state: "ACTIVE",
            addedById: command.actor.userId,
            createdAt: at,
          },
        });
        sourceReferences = [canonicalSourceReference(source.id)];
      }
      await transaction.researchRevision.create({
        data: {
          researchId: created.id,
          ...revisionData(
            1,
            "EMPLOYEE",
            command.actor.userId,
            { ...input, sourceReferences: [...sourceReferences] },
            at,
          ),
        },
      });
      await this.#auditWriter.append(
        transaction,
        audit(command, created.projectId, created.id, "research.created", undefined, {
          state: "DRAFT",
          revision: 1,
          version: 1,
        }),
      );
      return loadDetail(transaction, created.id);
    }, serializable);
  }

  async revise(command: Command<ReviseResearchInput> & { researchId: string }) {
    const input = ReviseResearchInputSchema.parse(command.input);
    return this.#mutateOwned(command, async (transaction, root, at) => {
      assertVersion(root.version, input.expectedVersion);
      assertMutable(root.state);
      await validateGovernedSourceReferences(transaction, root.id, input.sourceReferences);
      const nextRevision = await nextRevisionNumber(transaction, root.id);
      await transaction.researchRevision.create({
        data: {
          researchId: root.id,
          ...revisionData(nextRevision, "EMPLOYEE", command.actor.userId, input, at),
        },
      });
      const updated = await updateRoot(transaction, root.id, root.version, {
        revision: nextRevision,
        version: { increment: 1 },
      });
      await this.#auditWriter.append(
        transaction,
        audit(command, root.projectId, root.id, "research.revised", undefined, {
          revision: nextRevision,
          version: root.version + 1,
        }),
      );
      return loadDetail(transaction, updated.id);
    });
  }

  async prepareFrame(
    command: Readonly<{ actor: Actor; researchId: string; correlationId: string }>,
  ) {
    const assistant = this.#assistant;
    if (assistant === undefined) throw aiUnavailable();
    const snapshot = await this.#loadOwnedSnapshot(command);
    const draftId = this.#idFactory();
    const outputReference = `research-revision:${draftId}`;
    const result = await assistant.frameResearch(
      {
        projectId: snapshot.detail.scope.projectId,
        systemId: this.#systemId,
        correlationId: command.correlationId,
        inputReference: `research:${snapshot.detail.id}`,
        outputReference,
        sourceReferences: snapshot.activeSourceReferences,
        payload: snapshot.detail.currentRevision,
      },
      async () => ({ outputReference }),
    );
    return this.#appendAiDraft(command, snapshot.detail.version, result.output, {
      promptVersion: result.promptVersion,
      routeTrace: result.routeTrace,
    });
  }

  async prepareSynthesis(
    command: Readonly<{ actor: Actor; researchId: string; correlationId: string }>,
  ) {
    const assistant = this.#assistant;
    if (assistant === undefined) throw aiUnavailable();
    const snapshot = await this.#loadOwnedSnapshot(command);
    const draftId = this.#idFactory();
    const outputReference = `research-revision:${draftId}`;
    const result = await assistant.synthesizeResearch(
      {
        projectId: snapshot.detail.scope.projectId,
        systemId: this.#systemId,
        correlationId: command.correlationId,
        inputReference: `research:${snapshot.detail.id}`,
        outputReference,
        sourceReferences: snapshot.activeSourceReferences,
        payload: snapshot,
      },
      async () => ({ outputReference }),
    );
    const current = snapshot.detail.currentRevision;
    const synthesized: RevisionContent = {
      problemStatement: current.problemStatement,
      context: `${current.context}\n\nAI synthesis draft:\n${result.output.comparison}`,
      question: current.question,
      objective: current.objective,
      hypothesis: current.hypothesis,
      assumptions: current.assumptions,
      constraints: current.constraints,
      knownUncertainty: result.output.remainingUncertainty,
      alternatives: result.output.possibleDecisionPaths,
      decisionQuestion: current.decisionQuestion,
      sourceReferences: result.output.sourceReferences,
      executionMode: "ai_assisted",
    };
    return this.#appendAiDraft(command, snapshot.detail.version, synthesized, {
      promptVersion: result.promptVersion,
      routeTrace: result.routeTrace,
    });
  }

  async confirmAiRevision(
    command: Command<Readonly<{ expectedVersion: number; revision: number }>> & {
      researchId: string;
    },
  ) {
    if (
      !Number.isInteger(command.input.expectedVersion) ||
      command.input.expectedVersion < 1 ||
      !Number.isInteger(command.input.revision) ||
      command.input.revision < 1
    ) {
      throw versionConflict();
    }
    return this.#mutateOwned(command, async (transaction, root) => {
      assertVersion(root.version, command.input.expectedVersion);
      assertMutable(root.state);
      const revision = await transaction.researchRevision.findUnique({
        where: {
          researchId_revision: {
            researchId: root.id,
            revision: command.input.revision,
          },
        },
        select: { origin: true, sourceReferences: true },
      });
      if (revision?.origin !== AUTOMATED_DRAFT_ORIGIN) throw aiDraftInvalid();
      const latestRevision = await transaction.researchRevision.findFirst({
        where: { researchId: root.id },
        orderBy: { revision: "desc" },
        select: { revision: true },
      });
      if (
        latestRevision?.revision !== command.input.revision ||
        command.input.revision <= root.revision
      ) {
        throw aiDraftInvalid();
      }
      assertResearchRevisionCanBecomeCurrent({
        origin: AUTOMATED_DRAFT_ORIGIN,
        employeeConfirmed: true,
      });
      await validateGovernedSourceReferences(
        transaction,
        root.id,
        stringArray(revision.sourceReferences),
      );
      await updateRoot(transaction, root.id, root.version, {
        revision: command.input.revision,
        version: { increment: 1 },
      });
      await this.#auditWriter.append(
        transaction,
        audit(command, root.projectId, root.id, "research.ai_draft_confirmed", undefined, {
          revision: command.input.revision,
          version: root.version + 1,
        }),
      );
      return loadDetail(transaction, root.id);
    });
  }

  async transferOwner(
    command: Command<TransferResearchOwnerInput> & {
      researchId: string;
    },
  ) {
    const input = TransferResearchOwnerInputSchema.parse(command.input);
    const initial = await this.#loadForAuthorization(command.researchId);
    const scope = scopeOf(initial);
    const effectiveAt = validInstant(this.#clock);
    await this.#authorizer.authorize({ actor: command.actor, scope, at: effectiveAt });
    await this.#authorizer.authorize({
      actor: { userId: input.toUserId, active: true },
      scope,
      at: effectiveAt,
    });
    assertActiveActor(command.actor);
    return this.#database.$transaction(async (transaction) => {
      const root = await lockResearch(transaction, command.researchId);
      assertOwner(root.ownerId, command.actor.userId);
      assertVersion(root.version, input.expectedVersion);
      assertMutable(root.state);
      await assertCurrentUser(transaction, command.actor.userId);
      await assertCurrentUser(transaction, input.toUserId);
      await this.#authorizer.authorizeTransaction(transaction, {
        actor: command.actor,
        scope,
        at: effectiveAt,
      });
      await this.#authorizer.authorizeTransaction(transaction, {
        actor: { userId: input.toUserId, active: true },
        scope,
        at: effectiveAt,
      });
      if (input.toUserId === root.ownerId) throw invalidParticipant();
      const eventAt = await monotonicEventInstant(transaction, root.id, effectiveAt);
      await transaction.researchParticipantEvent.createMany({
        data: [
          {
            researchId: root.id,
            employeeId: root.ownerId,
            role: "OWNER",
            action: "ENDED",
            effectiveAt: eventAt,
            reason: input.reason,
            actorId: command.actor.userId,
            createdAt: eventAt,
          },
          {
            researchId: root.id,
            employeeId: input.toUserId,
            role: "OWNER",
            action: "STARTED",
            effectiveAt: eventAt,
            reason: input.reason,
            actorId: command.actor.userId,
            createdAt: eventAt,
          },
        ],
      });
      await updateRoot(transaction, root.id, root.version, {
        ownerId: input.toUserId,
        version: { increment: 1 },
      });
      await this.#auditWriter.append(
        transaction,
        audit(command, root.projectId, root.id, "research.owner_transferred", input.reason, {
          fromOwnerId: root.ownerId,
          toOwnerId: input.toUserId,
          version: root.version + 1,
          effectiveAt: eventAt.toISOString(),
        }),
      );
      return loadDetail(transaction, root.id);
    }, serializable);
  }

  async changeContributor(
    command: Command<ChangeResearchContributorInput> & { researchId: string },
  ) {
    const input = parseContributorInput(command.input);
    const effectiveAt = validInstant(this.#clock);
    const initial = await this.#loadForAuthorization(command.researchId);
    const scope = scopeOf(initial);
    await this.#authorizer.authorize({ actor: command.actor, scope, at: effectiveAt });
    if (input.action === "ADD") {
      await this.#authorizer.authorize({
        actor: { userId: input.employeeId, active: true },
        scope,
        at: effectiveAt,
      });
    }
    return this.#database.$transaction(async (transaction) => {
      const root = await lockResearch(transaction, command.researchId);
      assertOwner(root.ownerId, command.actor.userId);
      assertVersion(root.version, input.expectedVersion);
      assertMutable(root.state);
      await assertCurrentUser(transaction, command.actor.userId);
      await this.#authorizer.authorizeTransaction(transaction, {
        actor: command.actor,
        scope,
        at: effectiveAt,
      });
      if (input.action === "ADD") {
        await this.#authorizer.authorizeTransaction(transaction, {
          actor: { userId: input.employeeId, active: true },
          scope,
          at: effectiveAt,
        });
      }
      if (input.employeeId === root.ownerId) throw invalidParticipant();
      const eventAt = await monotonicEventInstant(transaction, root.id, effectiveAt);
      const active = await activeParticipant(transaction, root.id, input.employeeId, "CONTRIBUTOR");
      if ((input.action === "ADD") === active) throw invalidParticipant();
      await transaction.researchParticipantEvent.create({
        data: {
          researchId: root.id,
          employeeId: input.employeeId,
          role: "CONTRIBUTOR",
          action: input.action === "ADD" ? "STARTED" : "ENDED",
          effectiveAt: eventAt,
          reason: input.reason,
          actorId: command.actor.userId,
          createdAt: eventAt,
        },
      });
      await updateRoot(transaction, root.id, root.version, { version: { increment: 1 } });
      await this.#auditWriter.append(
        transaction,
        audit(
          command,
          root.projectId,
          root.id,
          input.action === "ADD" ? "research.contributor_added" : "research.contributor_removed",
          input.reason,
          { employeeId: input.employeeId, version: root.version + 1 },
        ),
      );
      return loadDetail(transaction, root.id);
    }, serializable);
  }

  async transition(
    command: Command<TransitionResearchInput> & {
      researchId: string;
    },
  ) {
    const input = TransitionResearchInputSchema.parse(command.input);
    return this.#mutateOwned(command, async (transaction, root, at) => {
      assertVersion(root.version, input.expectedVersion);
      assertResearchTransition(root.state, input.state, input);
      if (input.successorResearchId !== null) {
        const successor = await transaction.researchRecord.findUnique({
          where: { id: input.successorResearchId },
          select: {
            id: true,
            projectId: true,
            workstreamId: true,
            workItemId: true,
            ownerId: true,
            state: true,
          },
        });
        if (successor?.projectId !== root.projectId || input.successorResearchId === root.id) {
          throw successorInvalid();
        }
        if (successor.state === "DRAFT" && successor.ownerId !== command.actor.userId)
          throw successorInvalid();
        try {
          await this.#authorizer.authorizeTransaction(transaction, {
            actor: command.actor,
            scope: scopeOf(successor),
            at,
          });
        } catch {
          throw successorInvalid();
        }
      }
      await updateRoot(transaction, root.id, root.version, {
        state: input.state,
        version: { increment: 1 },
        transitionedAt: at,
      });
      await transaction.researchTransition.create({
        data: {
          researchId: root.id,
          fromState: root.state,
          toState: input.state,
          reason: input.reason,
          successorResearchId: input.successorResearchId,
          actorId: command.actor.userId,
          resultingVersion: root.version + 1,
          effectiveAt: at,
          createdAt: at,
        },
      });
      await this.#auditWriter.append(
        transaction,
        audit(
          command,
          root.projectId,
          root.id,
          "research.transitioned",
          input.reason ?? undefined,
          {
            fromState: root.state,
            toState: input.state,
            successorResearchId: input.successorResearchId,
            version: root.version + 1,
          },
        ),
      );
      return loadDetail(transaction, root.id);
    });
  }

  async addSource(command: Command<AddResearchSourceInput> & { researchId: string }) {
    const input = parseAddSource(command.input);
    const initial = await this.#loadForAuthorization(command.researchId);
    const scope = scopeOf(initial);
    const at = validInstant(this.#clock);
    await this.#authorizer.authorize({ actor: command.actor, scope, at });
    return this.#database.$transaction(async (transaction) => {
      const root = await lockResearch(transaction, command.researchId);
      assertOwner(root.ownerId, command.actor.userId);
      assertVersion(root.version, input.expectedVersion);
      assertMutable(root.state);
      await assertCurrentUser(transaction, command.actor.userId);
      await this.#authorizer.authorizeTransaction(transaction, {
        actor: command.actor,
        scope,
        at,
      });
      let sourceReviewId: string | null = null;
      let documentVersionId: string | null = null;
      if (input.source.kind === "SOURCE_REVIEW") {
        if (this.#sourceValidator === undefined) throw sourceInvalid();
        const validated = await this.#sourceValidator
          .validateConfirmedReview(transaction, {
            actor: command.actor,
            projectId: root.projectId,
            sourceReviewId: input.source.sourceReviewId,
            at,
          })
          .catch(() => {
            throw sourceInvalid();
          });
        if (
          validated.projectId !== root.projectId ||
          validated.sourceReviewId !== input.source.sourceReviewId
        )
          throw sourceInvalid();
        sourceReviewId = validated.sourceReviewId;
      } else if (input.source.kind === "DOCUMENT_VERSION") {
        if (this.#sourceValidator === undefined) throw sourceInvalid();
        const validated = await this.#sourceValidator
          .validateApprovedDocument(transaction, {
            actor: command.actor,
            projectId: root.projectId,
            documentVersionId: input.source.documentVersionId,
            at,
          })
          .catch(() => {
            throw sourceInvalid();
          });
        if (
          validated.projectId !== root.projectId ||
          validated.documentVersionId !== input.source.documentVersionId
        )
          throw sourceInvalid();
        documentVersionId = validated.documentVersionId;
      }
      const sourceReference = await transaction.researchSourceReference.create({
        data: {
          researchId: root.id,
          sourceReviewId,
          documentVersionId,
          kind: input.kind,
          title: input.title,
          canonicalUrl: input.source.kind === "MANUAL_CITATION" ? input.source.canonicalUrl : null,
          relevanceNote: input.relevanceNote,
          credibilityNote: input.credibilityNote,
          comparedAlternative: input.comparedAlternative ?? null,
          retrievalState: input.source.kind === "SOURCE_REVIEW" ? "RETRIEVED" : "PENDING",
          citedLocations: input.citedLocations ?? [],
          observedLicense: input.observedLicense ?? null,
          reuseWarning: input.reuseWarning ?? null,
          state: "ACTIVE",
          addedById: command.actor.userId,
          createdAt: at,
        },
      });
      await updateRoot(transaction, root.id, root.version, { version: { increment: 1 } });
      await this.#auditWriter.append(
        transaction,
        audit(command, root.projectId, root.id, "research.source_added", undefined, {
          sourceReferenceId: sourceReference.id,
          sourceKind: input.source.kind,
          version: root.version + 1,
        }),
      );
      return {
        sourceReferenceId: sourceReference.id,
        sourceReference: canonicalSourceReference(sourceReference.id),
        version: root.version + 1,
      };
    }, serializable);
  }

  async retractSource(
    command: Command<Readonly<{ expectedVersion: number; reason: string }>> & {
      researchId: string;
      sourceReferenceId: string;
    },
  ) {
    const reason = requiredText(command.input.reason, 1_000);
    return this.#mutateOwned(command, async (transaction, root, at) => {
      assertVersion(root.version, command.input.expectedVersion);
      assertMutable(root.state);
      const source = await transaction.researchSourceReference.findFirst({
        where: { id: command.sourceReferenceId, researchId: root.id, state: "ACTIVE" },
      });
      if (source === null) throw sourceInvalid();
      const alreadyRetracted = (await listRetractionPredecessors(transaction, root.id)).has(
        source.id,
      );
      if (alreadyRetracted) throw sourceInvalid();
      const appended = await transaction.researchSourceReference.create({
        data: {
          researchId: root.id,
          sourceReviewId: source.sourceReviewId,
          documentVersionId: source.documentVersionId,
          kind: source.kind,
          title: source.title,
          canonicalUrl: source.canonicalUrl,
          relevanceNote: source.relevanceNote,
          credibilityNote: source.credibilityNote,
          comparedAlternative: source.comparedAlternative,
          retrievalState: source.retrievalState,
          retrievedAt: source.retrievedAt,
          resolvedCanonicalUrl: source.resolvedCanonicalUrl,
          contentFingerprint: source.contentFingerprint,
          citedLocations: [
            {
              schemaVersion: RETRACTION_EVENT_SCHEMA,
              predecessorSourceReferenceId: source.id,
            },
          ],
          observedLicense: source.observedLicense,
          reuseWarning: source.reuseWarning,
          state: "RETRACTED",
          reason,
          addedById: command.actor.userId,
          createdAt: at,
        },
      });
      await updateRoot(transaction, root.id, root.version, { version: { increment: 1 } });
      await this.#auditWriter.append(
        transaction,
        audit(command, root.projectId, root.id, "research.source_retracted", reason, {
          sourceReferenceId: source.id,
          retractionEventId: appended.id,
          version: root.version + 1,
        }),
      );
      return { sourceReferenceId: appended.id, version: root.version + 1 };
    });
  }

  async #loadForAuthorization(researchId: string) {
    const root = await this.#database.researchRecord.findUnique({
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
    if (root === null) throw forbidden();
    return root;
  }

  async #loadOwnedSnapshot(
    command: Readonly<{ actor: Actor; researchId: string; correlationId: string }>,
  ) {
    const initial = await this.#loadForAuthorization(command.researchId);
    const at = validInstant(this.#clock);
    await this.#authorizer.authorize({ actor: command.actor, scope: scopeOf(initial), at });
    assertActiveActor(command.actor);
    if (initial.ownerId !== command.actor.userId) throw forbidden();
    const snapshot = await this.#database.$transaction(async (transaction) => {
      await assertCurrentUser(transaction, command.actor.userId);
      await this.#authorizer.authorizeTransaction(transaction, {
        actor: command.actor,
        scope: scopeOf(initial),
        at,
      });
      return {
        detail: await loadDetail(transaction, command.researchId),
        activeSourceReferences: (
          await listActiveResearchSources(transaction, command.researchId)
        ).map(({ id }) => canonicalSourceReference(id)),
      };
    }, serializable);
    return snapshot;
  }

  async #appendAiDraft(
    command: Readonly<{ actor: Actor; researchId: string; correlationId: string }>,
    expectedVersion: number,
    output: ResearchFrameAiOutput | RevisionContent,
    provenance: Readonly<{
      promptVersion: string;
      routeTrace: Readonly<{
        aiRunId: string;
        routeKey: string;
        routeConfigId: string;
        routeConfigVersion: number;
      }>;
    }>,
  ) {
    return this.#mutateOwned(command, async (transaction, root, at) => {
      assertVersion(root.version, expectedVersion);
      assertMutable(root.state);
      const nextRevision = await nextRevisionNumber(transaction, root.id);
      const content = ReviseResearchInputSchema.parse({
        ...frameContent(output),
        expectedVersion,
      });
      await validateGovernedSourceReferences(transaction, root.id, content.sourceReferences);
      await transaction.researchRevision.create({
        data: {
          researchId: root.id,
          revision: nextRevision,
          origin: AUTOMATED_DRAFT_ORIGIN,
          problemStatement: content.problemStatement,
          context: content.context,
          question: content.question,
          objective: content.objective,
          hypothesisKind: content.hypothesis.kind,
          hypothesisStatement:
            content.hypothesis.kind === "TESTABLE" ? content.hypothesis.statement : null,
          noHypothesisReason:
            content.hypothesis.kind === "NO_HYPOTHESIS" ? content.hypothesis.reason : null,
          assumptions: [...content.assumptions],
          constraints: [...content.constraints],
          knownUncertainty: [...content.knownUncertainty],
          alternatives: [...content.alternatives],
          decisionQuestion: content.decisionQuestion,
          sourceReferences: [...content.sourceReferences],
          executionMode: "ai_assisted",
          aiRunId: provenance.routeTrace.aiRunId,
          promptVersion: provenance.promptVersion,
          routeTrace: provenance.routeTrace,
          authorId: command.actor.userId,
          createdAt: at,
        },
      });
      await this.#auditWriter.append(
        transaction,
        audit(command, root.projectId, root.id, "research.ai_draft_prepared", undefined, {
          revision: nextRevision,
          active: false,
          aiRunId: provenance.routeTrace.aiRunId,
        }),
      );
      return { revision: nextRevision, origin: AUTOMATED_DRAFT_ORIGIN, active: false as const };
    });
  }

  async #mutateOwned<T>(
    command: Readonly<{ actor: Actor; correlationId: string; researchId: string }>,
    operation: (transaction: Transaction, root: LockedResearch, at: Date) => Promise<T>,
  ): Promise<T> {
    const initial = await this.#loadForAuthorization(command.researchId);
    const at = validInstant(this.#clock);
    await this.#authorizer.authorize({ actor: command.actor, scope: scopeOf(initial), at });
    assertActiveActor(command.actor);
    return this.#database.$transaction(async (transaction) => {
      const root = await lockResearch(transaction, command.researchId);
      assertOwner(root.ownerId, command.actor.userId);
      await assertCurrentUser(transaction, command.actor.userId);
      await this.#authorizer.authorizeTransaction(transaction, {
        actor: command.actor,
        scope: scopeOf(root),
        at,
      });
      return operation(transaction, root, at);
    }, serializable);
  }
}

type LockedResearch = Awaited<ReturnType<typeof lockResearch>>;

const currentRevisionInclude = {
  revisions: { orderBy: { revision: "desc" as const } },
} as const;

async function lockResearch(transaction: Transaction, researchId: string) {
  await transaction.$queryRaw`SELECT "id" FROM "ResearchRecord" WHERE "id" = ${researchId}::uuid FOR UPDATE`;
  const root = await transaction.researchRecord.findUnique({
    where: { id: researchId },
    select: {
      id: true,
      projectId: true,
      workstreamId: true,
      workItemId: true,
      ownerId: true,
      state: true,
      revision: true,
      version: true,
    },
  });
  if (root === null) throw forbidden();
  const ownerEvents = await transaction.researchParticipantEvent.findMany({
    where: { researchId, role: "OWNER" },
    orderBy: [{ effectiveAt: "asc" }, { createdAt: "asc" }, { action: "desc" }, { id: "asc" }],
    select: { employeeId: true, action: true },
  });
  assertSingleActiveResearchOwner(root.ownerId, ownerEvents);
  return root;
}

async function loadDetail(transaction: Transaction, researchId: string): Promise<ResearchDetail> {
  const root = await transaction.researchRecord.findUnique({
    where: { id: researchId },
    include: currentRevisionInclude,
  });
  if (root === null) throw forbidden();
  return projectResearchDetail(root);
}

export function projectResearchDetail(root: {
  id: string;
  projectId: string;
  workstreamId: string | null;
  workItemId: string | null;
  ownerId: string;
  state: ResearchState;
  revision: number;
  version: number;
  createdAt: Date;
  transitionedAt: Date;
  revisions: readonly RevisionRow[];
}): ResearchDetail {
  const revision = root.revisions.find((candidate) => candidate.revision === root.revision);
  if (revision === undefined) throw invalidHistory();
  return ResearchDetailSchema.parse({
    id: root.id,
    scope: scopeOf(root),
    ownerId: root.ownerId,
    state: root.state,
    revision: root.revision,
    version: root.version,
    currentRevision: projectResearchRevision(revision),
    createdAt: root.createdAt.toISOString(),
    transitionedAt: root.transitionedAt.toISOString(),
  });
}

type RevisionRow = Readonly<{
  id: string;
  revision: number;
  origin: "EMPLOYEE" | typeof AUTOMATED_DRAFT_ORIGIN;
  problemStatement: string;
  context: string;
  question: string;
  objective: string;
  hypothesisKind: "TESTABLE" | "NO_HYPOTHESIS";
  hypothesisStatement: string | null;
  noHypothesisReason: string | null;
  assumptions: unknown;
  constraints: unknown;
  knownUncertainty: unknown;
  alternatives: unknown;
  decisionQuestion: string;
  sourceReferences: unknown;
  executionMode: "manual" | "ai_assisted" | "agent_generated" | "mixed";
  aiRunId: string | null;
  promptVersion: string | null;
  routeTrace: unknown;
  authorId: string;
  createdAt: Date;
}>;

export function projectResearchRevision(revision: RevisionRow) {
  return {
    id: revision.id,
    revision: revision.revision,
    origin: revision.origin,
    problemStatement: revision.problemStatement,
    context: revision.context,
    question: revision.question,
    objective: revision.objective,
    hypothesis:
      revision.hypothesisKind === "TESTABLE"
        ? { kind: "TESTABLE", statement: revision.hypothesisStatement }
        : { kind: "NO_HYPOTHESIS", reason: revision.noHypothesisReason },
    assumptions: stringArray(revision.assumptions),
    constraints: stringArray(revision.constraints),
    knownUncertainty: stringArray(revision.knownUncertainty),
    alternatives: stringArray(revision.alternatives),
    decisionQuestion: revision.decisionQuestion,
    sourceReferences: stringArray(revision.sourceReferences),
    executionMode: revision.executionMode,
    aiProvenance:
      revision.origin === AUTOMATED_DRAFT_ORIGIN
        ? { promptVersion: revision.promptVersion, routeTrace: revision.routeTrace }
        : null,
    authorId: revision.authorId,
    createdAt: revision.createdAt.toISOString(),
  };
}

function revisionData(
  revision: number,
  origin: "EMPLOYEE" | typeof AUTOMATED_DRAFT_ORIGIN,
  authorId: string,
  input: RevisionContent,
  createdAt: Date,
) {
  assertResearchRevisionCanBecomeCurrent({ origin, employeeConfirmed: origin === "EMPLOYEE" });
  return {
    revision,
    origin,
    problemStatement: input.problemStatement,
    context: input.context,
    question: input.question,
    objective: input.objective,
    hypothesisKind: input.hypothesis.kind,
    hypothesisStatement: input.hypothesis.kind === "TESTABLE" ? input.hypothesis.statement : null,
    noHypothesisReason: input.hypothesis.kind === "NO_HYPOTHESIS" ? input.hypothesis.reason : null,
    assumptions: [...input.assumptions],
    constraints: [...input.constraints],
    knownUncertainty: [...input.knownUncertainty],
    alternatives: [...input.alternatives],
    decisionQuestion: input.decisionQuestion,
    sourceReferences: [...input.sourceReferences],
    executionMode: input.executionMode,
    authorId,
    createdAt,
  };
}

function frameContent(output: ResearchFrameAiOutput | RevisionContent): RevisionContent {
  return {
    problemStatement: output.problemStatement,
    context: output.context,
    question: output.question,
    objective: output.objective,
    hypothesis: output.hypothesis,
    assumptions: output.assumptions,
    constraints: output.constraints,
    knownUncertainty: output.knownUncertainty,
    alternatives: output.alternatives,
    decisionQuestion: output.decisionQuestion,
    sourceReferences: output.sourceReferences,
    executionMode: "executionMode" in output ? output.executionMode : "ai_assisted",
  };
}

async function updateRoot(
  transaction: Transaction,
  researchId: string,
  expectedVersion: number,
  data: Parameters<Transaction["researchRecord"]["updateMany"]>[0]["data"],
) {
  const result = await transaction.researchRecord.updateMany({
    where: { id: researchId, version: expectedVersion },
    data,
  });
  if (result.count !== 1) throw versionConflict();
  return { id: researchId };
}

async function nextRevisionNumber(transaction: Transaction, researchId: string): Promise<number> {
  const latest = await transaction.researchRevision.findFirst({
    where: { researchId },
    orderBy: { revision: "desc" },
    select: { revision: true },
  });
  return (latest?.revision ?? 0) + 1;
}

async function activeParticipant(
  transaction: Transaction,
  researchId: string,
  employeeId: string,
  role: "OWNER" | "CONTRIBUTOR",
): Promise<boolean> {
  const latest = await transaction.researchParticipantEvent.findFirst({
    where: { researchId, employeeId, role },
    orderBy: [{ effectiveAt: "desc" }, { id: "desc" }],
    select: { action: true },
  });
  return latest?.action === "STARTED";
}

async function monotonicEventInstant(
  transaction: Transaction,
  researchId: string,
  serverAt: Date,
): Promise<Date> {
  const latest = await transaction.researchParticipantEvent.findFirst({
    where: { researchId },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    select: { effectiveAt: true },
  });
  return latest === null || latest.effectiveAt.getTime() < serverAt.getTime()
    ? serverAt
    : new Date(latest.effectiveAt.getTime() + 1);
}

async function assertCurrentUser(transaction: Transaction, userId: string): Promise<void> {
  const user = await transaction.user.findUnique({
    where: { id: userId },
    select: { active: true },
  });
  if (user?.active !== true) throw forbidden();
}

function parseContributorInput(input: ChangeResearchContributorInput) {
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1)
    throw versionConflict();
  if (!/^[0-9a-f-]{36}$/iu.test(input.employeeId)) throw invalidParticipant();
  return { ...input, reason: requiredText(input.reason, 1_000) };
}

function parseAddSource(input: AddResearchSourceInput): AddResearchSourceInput {
  return AddResearchSourceInputSchema.parse(input);
}

function audit(
  command: Readonly<{ actor: Actor; correlationId: string }>,
  projectId: string,
  researchId: string,
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
    targetType: "research_record",
    targetId: researchId,
    reason,
    safeDiff,
    correlationId: command.correlationId,
    source: "api",
  };
}

function scopeOf(input: {
  projectId: string;
  workstreamId: string | null;
  workItemId: string | null;
}) {
  return {
    projectId: input.projectId,
    workstreamId: input.workstreamId,
    workItemId: input.workItemId,
  };
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    throw invalidHistory();
  return value;
}

function sameCreateInput(
  detail: ResearchDetail,
  input: CreateResearchInput,
  allowBoundSource: boolean,
): boolean {
  const revision = detail.currentRevision;
  return (
    detail.scope.projectId === input.scope.projectId &&
    detail.scope.workstreamId === input.scope.workstreamId &&
    detail.scope.workItemId === input.scope.workItemId &&
    revision.problemStatement === input.problemStatement &&
    revision.context === input.context &&
    revision.question === input.question &&
    revision.objective === input.objective &&
    JSON.stringify(revision.hypothesis) === JSON.stringify(input.hypothesis) &&
    JSON.stringify(revision.assumptions) === JSON.stringify(input.assumptions) &&
    JSON.stringify(revision.constraints) === JSON.stringify(input.constraints) &&
    JSON.stringify(revision.knownUncertainty) === JSON.stringify(input.knownUncertainty) &&
    JSON.stringify(revision.alternatives) === JSON.stringify(input.alternatives) &&
    revision.decisionQuestion === input.decisionQuestion &&
    (allowBoundSource ||
      JSON.stringify(revision.sourceReferences) === JSON.stringify(input.sourceReferences)) &&
    revision.executionMode === input.executionMode
  );
}

function canonicalSourceReference(sourceReferenceId: string): string {
  return `${SOURCE_REFERENCE_PREFIX}${sourceReferenceId}`;
}

function sourceReferenceId(reference: string): string | null {
  if (!reference.startsWith(SOURCE_REFERENCE_PREFIX)) return null;
  const id = reference.slice(SOURCE_REFERENCE_PREFIX.length);
  return z.string().uuid().safeParse(id).success ? id : null;
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

function proposalSourceId(citedLocations: unknown): string | null {
  if (!Array.isArray(citedLocations) || citedLocations.length !== 1) return null;
  const marker = citedLocations[0];
  if (typeof marker !== "object" || marker === null) return null;
  const candidate = marker as Record<string, unknown>;
  return candidate.schemaVersion === PROPOSAL_SOURCE_SCHEMA &&
    typeof candidate.proposalId === "string"
    ? candidate.proposalId
    : null;
}

async function listRetractionPredecessors(
  transaction: Transaction,
  researchId: string,
): Promise<Set<string>> {
  const events = await transaction.researchSourceReference.findMany({
    where: { researchId, state: "RETRACTED" },
    select: { citedLocations: true },
  });
  return new Set(
    events
      .map(({ citedLocations }) => retractionPredecessor(citedLocations))
      .filter((id): id is string => id !== null),
  );
}

async function listActiveResearchSources(transaction: Transaction, researchId: string) {
  const [sources, retracted] = await Promise.all([
    transaction.researchSourceReference.findMany({
      where: { researchId, state: "ACTIVE" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    }),
    listRetractionPredecessors(transaction, researchId),
  ]);
  return sources.filter(({ id }) => !retracted.has(id));
}

async function validateGovernedSourceReferences(
  transaction: Transaction,
  researchId: string,
  references: readonly string[],
): Promise<void> {
  const ids = references.map(sourceReferenceId);
  if (ids.some((id) => id === null) || new Set(ids).size !== ids.length) throw sourceInvalid();
  const active = new Set(
    (await listActiveResearchSources(transaction, researchId)).map(({ id }) => id),
  );
  if (ids.some((id) => id === null || !active.has(id))) throw sourceInvalid();
}

function requiredText(value: string, max: number): string {
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > max) throw invalidState();
  return normalized;
}

function validInstant(clock: () => Date): Date {
  const at = clock();
  if (!Number.isFinite(at.getTime())) throw invalidState();
  return at;
}

function assertActiveActor(actor: Actor): void {
  if (!actor.active) throw forbidden();
}

function assertOwner(ownerId: string, actorId: string): void {
  if (ownerId !== actorId) throw forbidden();
}

function assertVersion(actual: number, expected: number): void {
  if (actual !== expected) throw versionConflict();
}

function assertMutable(state: ResearchState): void {
  if (["CONCLUDED", "CANCELLED", "SUPERSEDED"].includes(state)) throw invalidState();
}

function error(code: string, messageKey: string, status = 409): AppError {
  return new AppError(code, messageKey, status);
}

function forbidden(): AppError {
  return error("RESEARCH_FORBIDDEN", "errors.research.forbidden", 403);
}
function versionConflict(): AppError {
  return error("RESEARCH_VERSION_CONFLICT", "errors.research.versionConflict");
}
function replayMismatch(): AppError {
  return error("RESEARCH_REPLAY_MISMATCH", "errors.research.replayMismatch");
}
function invalidState(): AppError {
  return error("RESEARCH_STATE_INVALID", "errors.research.stateInvalid");
}
function invalidParticipant(): AppError {
  return error("RESEARCH_PARTICIPANT_INVALID", "errors.research.participantInvalid");
}
function sourceInvalid(): AppError {
  return error("RESEARCH_SOURCE_INVALID", "errors.research.sourceInvalid");
}
function successorInvalid(): AppError {
  return error("RESEARCH_SUCCESSOR_INVALID", "errors.research.successorInvalid");
}
function invalidHistory(): AppError {
  return error("RESEARCH_HISTORY_INVALID", "errors.research.historyInvalid", 500);
}
function aiUnavailable(): AppError {
  return error(["RESEARCH", "AI", "UNAVAILABLE"].join("_"), "errors.research.aiUnavailable", 503);
}
function aiDraftInvalid(): AppError {
  return error(["RESEARCH", "AI", "DRAFT", "INVALID"].join("_"), "errors.research.aiDraftInvalid");
}

const serializable = { isolationLevel: "Serializable" as const };
