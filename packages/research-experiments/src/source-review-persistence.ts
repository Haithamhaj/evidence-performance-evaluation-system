import { AppError } from "@evaluation/contracts";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type Transaction = import("@evaluation/database").DatabaseTransaction;

export type SourceReviewScope = Readonly<{
  projectId: string;
  workstreamId: string | null;
  workItemId: string | null;
}>;

export type SealedValue = Readonly<{ ciphertext: string; keyVersion: string }>;

export type SourceReviewProposalInput = Readonly<{
  id: string;
  kind: "RESEARCH" | "EXPERIMENT" | "WORK_ITEM";
  originRevision: number;
  sourceReferences: readonly string[];
  sealedContent: SealedValue;
}>;

export type CreatePendingReviewInput = Readonly<{
  id: string;
  ownerId: string;
  scope: SourceReviewScope;
  idempotencyKey: string;
  sourceKind: "URL" | "CONNECTED_CONTEXT" | "DOCUMENT_VERSION";
  sealedSource: SealedValue & Readonly<{ sourceFingerprint: string }>;
  documentVersionId: string | null;
  createdAt: Date;
  claimedAt?: Date;
  staleBefore?: Date;
}>;

export type AppendReviewedInput = Readonly<{
  reviewId: string;
  ownerId: string;
  expectedVersion: number;
  state: "READY_FOR_REVIEW" | "PARTIAL";
  retrievalState: "RETRIEVED" | "PARTIAL";
  retrievalReason: string | null;
  displayUrl: string | null;
  contentFingerprint: string;
  projectContextFingerprint: string;
  sealedRetrievedContent: string;
  sealedOutput: string;
  citationIdentities: readonly string[];
  schemaVersion: string;
  promptVersion: string;
  routeTrace: Readonly<{
    aiRunId: string;
    routeKey: string;
    routeConfigId: string;
    routeConfigVersion: number;
  }>;
  proposals: readonly SourceReviewProposalInput[];
  actorId: string;
  createdAt: Date;
}>;

export type AppendBlockedInput = Readonly<{
  reviewId: string;
  ownerId: string;
  expectedVersion: number;
  retrievalState: "BLOCKED" | "PARTIAL";
  retrievalReason: string;
  displayUrl: string | null;
  contentFingerprint: string | null;
  projectContextFingerprint: string;
  sealedRetrievedContent: string | null;
  actorId: string;
  createdAt: Date;
}>;

export type AppendStaleInput = Readonly<{
  reviewId: string;
  ownerId: string;
  expectedVersion: number;
  displayUrl: string | null;
  contentFingerprint: string | null;
  projectContextFingerprint: string | null;
  actorId: string;
  createdAt: Date;
}>;

export type ReanalysisCandidate =
  | Readonly<{
      kind: "REVIEWED";
      state: "READY_FOR_REVIEW" | "PARTIAL";
      retrievalState: "RETRIEVED" | "PARTIAL";
      retrievalReason: string | null;
      displayUrl: string | null;
      contentFingerprint: string;
      projectContextFingerprint: string;
      sealedRetrievedContent: string;
      sealedOutput: string;
      citationIdentities: readonly string[];
      schemaVersion: string;
      promptVersion: string;
      routeTrace: AppendReviewedInput["routeTrace"];
      proposals: readonly SourceReviewProposalInput[];
    }>
  | Readonly<{
      kind: "BLOCKED";
      retrievalState: "BLOCKED" | "PARTIAL";
      retrievalReason: string;
      displayUrl: string | null;
      contentFingerprint: string | null;
      projectContextFingerprint: string;
      sealedRetrievedContent: string | null;
    }>;

export type SourceReviewLoaded = Readonly<{
  id: string;
  projectId: string;
  workstreamId: string | null;
  workItemId: string | null;
  ownerId: string;
  idempotencyKey: string;
  sourceKind: "URL" | "CONNECTED_CONTEXT" | "DOCUMENT_VERSION";
  sealedSource: unknown;
  documentVersionId: string | null;
  state:
    | "PENDING_RETRIEVAL"
    | "READY_FOR_REVIEW"
    | "PARTIAL"
    | "BLOCKED"
    | "CONFIRMED"
    | "DISMISSED"
    | "STALE";
  retrievalState: "PENDING" | "RETRIEVED" | "PARTIAL" | "BLOCKED" | "STALE";
  retrievalReason: string | null;
  displayUrl: string | null;
  contentFingerprint: string | null;
  currentRevision: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  revisions: readonly Readonly<{
    revision: number;
    retrievalState: "PENDING" | "RETRIEVED" | "PARTIAL" | "BLOCKED" | "STALE";
    retrievalReason: string | null;
    displayUrl: string | null;
    contentFingerprint: string | null;
    projectContextFingerprint: string | null;
    sealedRetrievedContent: string | null;
    sealedOutput: string | null;
    schemaVersion: string | null;
    promptVersion: string | null;
    routeTrace: unknown;
  }>[];
  proposals: readonly Readonly<{
    id: string;
    kind: "RESEARCH" | "EXPERIMENT" | "WORK_ITEM";
    state: "DRAFT" | "CONFIRMED" | "DISMISSED";
    title: string;
    rationale: string;
    content: unknown;
    sourceReferences: unknown;
    version: number;
  }>[];
}>;

export type SourceReviewClaim = SourceReviewLoaded & Readonly<{ processingClaimed: boolean }>;

export class ResearchSourceReviewPersistence {
  readonly #database: DatabaseClient;

  constructor(database: DatabaseClient) {
    this.#database = database;
  }

  async createOrReplayPending(input: CreatePendingReviewInput): Promise<SourceReviewClaim> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.#database.$transaction(async (transaction) => {
          const existing = await findReplay(transaction, input);
          if (existing !== null) return claimPendingIfStale(transaction, existing, input);
          const claimedAt = input.claimedAt ?? input.createdAt;
          await transaction.researchSourceReview.create({
            data: {
              id: input.id,
              projectId: input.scope.projectId,
              workstreamId: input.scope.workstreamId,
              workItemId: input.scope.workItemId,
              ownerId: input.ownerId,
              idempotencyKey: input.idempotencyKey,
              sourceKind: input.sourceKind,
              sealedSource: input.sealedSource,
              documentVersionId: input.documentVersionId,
              state: "PENDING_RETRIEVAL",
              retrievalState: "PENDING",
              createdAt: input.createdAt,
              updatedAt: claimedAt,
            },
          });
          return withClaim(await loadReview(transaction, input.id), true);
        }, serializable);
      } catch (error) {
        if (!hasDatabaseRaceCode(error) || attempt === 2) throw error;
        const winner = await findReplay(this.#database, input);
        if (winner !== null) {
          return this.#database.$transaction(
            (transaction) => claimPendingIfStale(transaction, winner, input),
            serializable,
          );
        }
      }
    }
    throw versionConflict();
  }

  async loadOwned(
    input: Readonly<{ reviewId: string; ownerId: string }>,
  ): Promise<SourceReviewLoaded> {
    const review = await this.#database.researchSourceReview.findFirst({
      where: { id: input.reviewId, ownerId: input.ownerId },
      include: reviewInclude,
    });
    if (review === null) throw forbidden();
    return review;
  }

  async appendReviewed(input: AppendReviewedInput): Promise<SourceReviewLoaded> {
    return this.#database.$transaction(async (transaction) => {
      const review = await lockOwned(transaction, input.reviewId, input.ownerId);
      assertExpectedVersion(review.version, input.expectedVersion);
      assertMutableReviewState(review.state);
      const revision = review.currentRevision + 1;
      await transaction.researchSourceReviewRevision.create({
        data: {
          reviewId: input.reviewId,
          revision,
          retrievalState: input.retrievalState,
          retrievalReason: input.retrievalReason,
          displayUrl: input.displayUrl,
          contentFingerprint: input.contentFingerprint,
          projectContextFingerprint: input.projectContextFingerprint,
          sealedRetrievedContent: input.sealedRetrievedContent,
          sealedOutput: input.sealedOutput,
          citations: [...input.citationIdentities],
          schemaVersion: input.schemaVersion,
          promptVersion: input.promptVersion,
          routeTrace: input.routeTrace,
          aiRunId: input.routeTrace.aiRunId,
          createdById: input.actorId,
          createdAt: input.createdAt,
        },
      });
      assertProposalOrigins(input.proposals, revision);
      await createProposals(transaction, input.reviewId, input.proposals);
      await transaction.researchSourceReview.update({
        where: { id: input.reviewId },
        data: {
          state: input.state,
          retrievalState: input.retrievalState,
          retrievalReason: input.retrievalReason,
          displayUrl: input.displayUrl,
          contentFingerprint: input.contentFingerprint,
          currentRevision: revision,
          version: { increment: 1 },
          updatedAt: input.createdAt,
        },
      });
      return loadReview(transaction, input.reviewId);
    }, serializable);
  }

  async appendBlocked(input: AppendBlockedInput): Promise<SourceReviewLoaded> {
    return this.#database.$transaction(async (transaction) => {
      const review = await lockOwned(transaction, input.reviewId, input.ownerId);
      assertExpectedVersion(review.version, input.expectedVersion);
      assertMutableReviewState(review.state);
      const revision = review.currentRevision + 1;
      const state = input.retrievalState === "BLOCKED" ? "BLOCKED" : "PARTIAL";
      await transaction.researchSourceReviewRevision.create({
        data: {
          reviewId: input.reviewId,
          revision,
          retrievalState: input.retrievalState,
          retrievalReason: input.retrievalReason,
          displayUrl: input.displayUrl,
          contentFingerprint: input.contentFingerprint,
          projectContextFingerprint: input.projectContextFingerprint,
          sealedRetrievedContent: input.sealedRetrievedContent,
          sealedOutput: null,
          citations: [],
          schemaVersion: null,
          promptVersion: null,
          aiRunId: null,
          createdById: input.actorId,
          createdAt: input.createdAt,
        },
      });
      await transaction.researchSourceReview.update({
        where: { id: input.reviewId },
        data: {
          state,
          retrievalState: input.retrievalState,
          retrievalReason: input.retrievalReason,
          displayUrl: input.displayUrl,
          contentFingerprint: input.contentFingerprint,
          currentRevision: revision,
          version: { increment: 1 },
          updatedAt: input.createdAt,
        },
      });
      return loadReview(transaction, input.reviewId);
    }, serializable);
  }

  async appendStale(input: AppendStaleInput): Promise<SourceReviewLoaded> {
    return this.#database.$transaction(async (transaction) => {
      const review = await lockOwned(transaction, input.reviewId, input.ownerId);
      assertExpectedVersion(review.version, input.expectedVersion);
      if (!new Set(["READY_FOR_REVIEW", "PARTIAL"]).has(review.state)) throw invalidState();
      const revision = review.currentRevision + 1;
      await transaction.researchSourceReviewRevision.create({
        data: {
          reviewId: input.reviewId,
          revision,
          retrievalState: "STALE",
          retrievalReason: "SOURCE_OR_PROJECT_CONTEXT_CHANGED",
          displayUrl: input.displayUrl,
          contentFingerprint: input.contentFingerprint,
          projectContextFingerprint: input.projectContextFingerprint,
          sealedRetrievedContent: null,
          sealedOutput: null,
          citations: [],
          schemaVersion: null,
          promptVersion: null,
          aiRunId: null,
          createdById: input.actorId,
          createdAt: input.createdAt,
        },
      });
      await transaction.researchSourceReview.update({
        where: { id: input.reviewId },
        data: {
          state: "STALE",
          retrievalState: "STALE",
          retrievalReason: "SOURCE_OR_PROJECT_CONTEXT_CHANGED",
          currentRevision: revision,
          version: { increment: 1 },
          updatedAt: input.createdAt,
        },
      });
      return loadReview(transaction, input.reviewId);
    }, serializable);
  }

  async appendReanalysis(
    input: Readonly<{
      reviewId: string;
      ownerId: string;
      expectedVersion: number;
      candidate: ReanalysisCandidate;
      actorId: string;
      createdAt: Date;
    }>,
  ): Promise<SourceReviewLoaded> {
    return this.#database.$transaction(async (transaction) => {
      const review = await lockOwned(transaction, input.reviewId, input.ownerId);
      assertExpectedVersion(review.version, input.expectedVersion);
      if (!new Set(["READY_FOR_REVIEW", "PARTIAL", "STALE"]).has(review.state)) {
        throw invalidState();
      }
      const needsStaleRevision = review.state !== "STALE";
      let terminalRevision = review.currentRevision + 1;
      if (needsStaleRevision) {
        await transaction.researchSourceReviewRevision.create({
          data: {
            reviewId: input.reviewId,
            revision: terminalRevision,
            retrievalState: "STALE",
            retrievalReason: "SOURCE_OR_PROJECT_CONTEXT_CHANGED",
            displayUrl: input.candidate.displayUrl,
            contentFingerprint: input.candidate.contentFingerprint,
            projectContextFingerprint: input.candidate.projectContextFingerprint,
            sealedRetrievedContent: null,
            sealedOutput: null,
            citations: [],
            schemaVersion: null,
            promptVersion: null,
            aiRunId: null,
            createdById: input.actorId,
            createdAt: input.createdAt,
          },
        });
        terminalRevision += 1;
      }
      await supersedeDraftProposals(transaction, review.id, terminalRevision, input);
      if (input.candidate.kind === "REVIEWED") {
        assertProposalOrigins(input.candidate.proposals, terminalRevision);
        await transaction.researchSourceReviewRevision.create({
          data: {
            reviewId: input.reviewId,
            revision: terminalRevision,
            retrievalState: input.candidate.retrievalState,
            retrievalReason: input.candidate.retrievalReason,
            displayUrl: input.candidate.displayUrl,
            contentFingerprint: input.candidate.contentFingerprint,
            projectContextFingerprint: input.candidate.projectContextFingerprint,
            sealedRetrievedContent: input.candidate.sealedRetrievedContent,
            sealedOutput: input.candidate.sealedOutput,
            citations: [...input.candidate.citationIdentities],
            schemaVersion: input.candidate.schemaVersion,
            promptVersion: input.candidate.promptVersion,
            routeTrace: input.candidate.routeTrace,
            aiRunId: input.candidate.routeTrace.aiRunId,
            createdById: input.actorId,
            createdAt: input.createdAt,
          },
        });
        await createProposals(transaction, input.reviewId, input.candidate.proposals);
      } else {
        await transaction.researchSourceReviewRevision.create({
          data: {
            reviewId: input.reviewId,
            revision: terminalRevision,
            retrievalState: input.candidate.retrievalState,
            retrievalReason: input.candidate.retrievalReason,
            displayUrl: input.candidate.displayUrl,
            contentFingerprint: input.candidate.contentFingerprint,
            projectContextFingerprint: input.candidate.projectContextFingerprint,
            sealedRetrievedContent: input.candidate.sealedRetrievedContent,
            sealedOutput: null,
            citations: [],
            schemaVersion: null,
            promptVersion: null,
            aiRunId: null,
            createdById: input.actorId,
            createdAt: input.createdAt,
          },
        });
      }
      const terminalState =
        input.candidate.kind === "REVIEWED"
          ? input.candidate.state
          : input.candidate.retrievalState === "BLOCKED"
            ? "BLOCKED"
            : "PARTIAL";
      await transaction.researchSourceReview.update({
        where: { id: input.reviewId },
        data: {
          state: terminalState,
          retrievalState: input.candidate.retrievalState,
          retrievalReason: input.candidate.retrievalReason,
          displayUrl: input.candidate.displayUrl,
          contentFingerprint: input.candidate.contentFingerprint,
          currentRevision: terminalRevision,
          version: { increment: needsStaleRevision ? 2 : 1 },
          updatedAt: input.createdAt,
        },
      });
      return loadReview(transaction, input.reviewId);
    }, serializable);
  }

  async editProposal(
    input: Readonly<{
      reviewId: string;
      ownerId: string;
      reviewRevision: number;
      proposalId: string;
      expectedProposalVersion: number;
      successor: SourceReviewProposalInput;
      reason: string;
      actorId: string;
    }>,
  ): Promise<SourceReviewLoaded> {
    return this.#database.$transaction(async (transaction) => {
      const review = await lockOwned(transaction, input.reviewId, input.ownerId);
      if (
        !new Set(["READY_FOR_REVIEW", "PARTIAL"]).has(review.state) ||
        review.currentRevision !== input.reviewRevision
      ) {
        throw proposalInvalid();
      }
      const proposal = await transaction.researchProposal.findFirst({
        where: { id: input.proposalId, reviewId: input.reviewId },
      });
      if (proposal === null) throw proposalInvalid();
      if (proposal.version !== input.expectedProposalVersion) throw proposalVersionConflict();
      if (proposal.state !== "DRAFT") throw proposalInvalid();
      if (
        input.successor.originRevision !== input.reviewRevision ||
        input.successor.id === proposal.id
      ) {
        throw proposalInvalid();
      }
      await transaction.researchProposal.update({
        where: { id: proposal.id },
        data: { state: "DISMISSED", version: { increment: 1 } },
      });
      await transaction.researchProposalTransition.create({
        data: {
          proposalId: proposal.id,
          kind: "DISMISSED",
          reason: "Private proposal edit; reason is sealed in the successor proposal.",
          actorId: input.actorId,
          resultingVersion: proposal.version + 1,
        },
      });
      await transaction.researchProposal.create({
        data: {
          id: input.successor.id,
          reviewId: input.reviewId,
          kind: input.successor.kind,
          state: "DRAFT",
          title: `Private ${input.successor.kind} proposal`,
          rationale: "Private employee draft; open the authorized review to inspect it.",
          content: input.successor.sealedContent,
          sourceReferences: [...input.successor.sourceReferences],
          version: proposal.version + 1,
        },
      });
      return loadReview(transaction, input.reviewId);
    }, serializable);
  }

  async confirm(input: DispositionInput): Promise<SourceReviewLoaded> {
    return this.#applyDisposition({ ...input, terminalState: "CONFIRMED" });
  }

  async dismiss(input: DispositionInput): Promise<SourceReviewLoaded> {
    return this.#applyDisposition({ ...input, terminalState: "DISMISSED" });
  }

  async #applyDisposition(
    input: DispositionInput & Readonly<{ terminalState: "CONFIRMED" | "DISMISSED" }>,
  ): Promise<SourceReviewLoaded> {
    return this.#database.$transaction(async (transaction) => {
      const review = await lockOwned(transaction, input.reviewId, input.ownerId);
      if (review.state === input.terminalState && review.version === input.expectedVersion + 1) {
        const transitions = await transaction.researchProposalTransition.findMany({
          where: { proposal: { reviewId: input.reviewId } },
          select: { proposalId: true, kind: true },
        });
        const confirmedIds = transitions
          .filter(({ kind }) => kind === "CONFIRMED")
          .map(({ proposalId }) => proposalId)
          .sort();
        const expectedIds = [...input.proposalIds].sort();
        if (JSON.stringify(confirmedIds) === JSON.stringify(expectedIds)) {
          return loadReview(transaction, input.reviewId);
        }
      }
      assertExpectedVersion(review.version, input.expectedVersion);
      if (!new Set(["READY_FOR_REVIEW", "PARTIAL"]).has(review.state)) throw invalidState();
      const proposals = await transaction.researchProposal.findMany({
        where: { reviewId: input.reviewId },
        orderBy: { id: "asc" },
      });
      const drafts = proposals.filter(({ state }) => state === "DRAFT");
      const selected = new Set(input.proposalIds);
      if (input.terminalState === "CONFIRMED") {
        if ([...selected].some((id) => !drafts.some((proposal) => proposal.id === id))) {
          throw proposalInvalid();
        }
      } else if (selected.size !== 0) {
        throw proposalInvalid();
      }
      for (const proposal of drafts) {
        const kind =
          input.terminalState === "CONFIRMED" && selected.has(proposal.id)
            ? "CONFIRMED"
            : "DISMISSED";
        await transaction.researchProposal.update({
          where: { id: proposal.id },
          data: { state: kind, version: { increment: 1 } },
        });
        await transaction.researchProposalTransition.create({
          data: {
            proposalId: proposal.id,
            kind,
            reason: "Private disposition reason is sealed in the review revision.",
            actorId: input.actorId,
            resultingVersion: proposal.version + 1,
          },
        });
      }
      const latest =
        review.currentRevision === 0
          ? null
          : await transaction.researchSourceReviewRevision.findUnique({
              where: {
                reviewId_revision: { reviewId: review.id, revision: review.currentRevision },
              },
            });
      if (latest === null) throw invalidState();
      const dispositionRevision = review.currentRevision + 1;
      await transaction.researchSourceReviewRevision.create({
        data: {
          reviewId: review.id,
          revision: dispositionRevision,
          retrievalState: review.retrievalState,
          retrievalReason: review.retrievalReason,
          displayUrl: review.displayUrl,
          contentFingerprint: review.contentFingerprint,
          projectContextFingerprint: latest.projectContextFingerprint,
          sealedRetrievedContent: input.sealedDisposition,
          sealedOutput: null,
          citations: [],
          schemaVersion: null,
          promptVersion: null,
          aiRunId: null,
          createdById: input.actorId,
          createdAt: input.createdAt,
        },
      });
      await transaction.researchSourceReview.update({
        where: { id: input.reviewId },
        data: {
          state: input.terminalState,
          currentRevision: dispositionRevision,
          version: { increment: 1 },
          updatedAt: input.createdAt,
        },
      });
      return loadReview(transaction, input.reviewId);
    }, serializable);
  }
}

type DispositionInput = Readonly<{
  reviewId: string;
  ownerId: string;
  expectedVersion: number;
  proposalIds: readonly string[];
  reason: string;
  actorId: string;
  sealedDisposition: string;
  createdAt: Date;
}>;

const serializable = { isolationLevel: "Serializable" as const };
const reviewInclude = {
  revisions: { orderBy: { revision: "asc" as const } },
  proposals: { orderBy: { createdAt: "asc" as const } },
} as const;

async function loadReview(
  transaction: DatabaseClient | Transaction,
  reviewId: string,
): Promise<SourceReviewLoaded> {
  const review = await transaction.researchSourceReview.findUnique({
    where: { id: reviewId },
    include: reviewInclude,
  });
  if (review === null) throw forbidden();
  return review as unknown as SourceReviewLoaded;
}

async function findReplay(
  database: DatabaseClient | Transaction,
  input: CreatePendingReviewInput,
): Promise<SourceReviewLoaded | null> {
  const existing = await database.researchSourceReview.findUnique({
    where: {
      ownerId_projectId_idempotencyKey: {
        ownerId: input.ownerId,
        projectId: input.scope.projectId,
        idempotencyKey: input.idempotencyKey,
      },
    },
    include: reviewInclude,
  });
  if (existing === null) return null;
  const loaded = existing as unknown as SourceReviewLoaded;
  assertReplayMatches(loaded, input);
  return loaded;
}

async function claimPendingIfStale(
  transaction: Transaction,
  existing: SourceReviewLoaded,
  input: CreatePendingReviewInput,
): Promise<SourceReviewClaim> {
  const claimedAt = input.claimedAt ?? input.createdAt;
  const staleBefore = input.staleBefore ?? new Date(input.createdAt.getTime() - 60_000);
  if (existing.state !== "PENDING_RETRIEVAL" || existing.updatedAt > staleBefore) {
    return withClaim(existing, false);
  }
  const claimed = await transaction.researchSourceReview.updateMany({
    where: {
      id: existing.id,
      ownerId: input.ownerId,
      state: "PENDING_RETRIEVAL",
      version: existing.version,
      updatedAt: { lte: staleBefore },
    },
    data: { version: { increment: 1 }, updatedAt: claimedAt },
  });
  if (claimed.count !== 1) return withClaim(await loadReview(transaction, existing.id), false);
  return withClaim(await loadReview(transaction, existing.id), true);
}

function withClaim(review: SourceReviewLoaded, processingClaimed: boolean): SourceReviewClaim {
  return { ...review, processingClaimed };
}

async function createProposals(
  transaction: Transaction,
  reviewId: string,
  proposals: readonly SourceReviewProposalInput[],
): Promise<void> {
  if (proposals.length === 0) return;
  await transaction.researchProposal.createMany({
    data: proposals.map((proposal) => ({
      id: proposal.id,
      reviewId,
      kind: proposal.kind,
      state: "DRAFT" as const,
      title: `Private ${proposal.kind} proposal`,
      rationale: "Private employee draft; open the authorized review to inspect it.",
      content: proposal.sealedContent,
      sourceReferences: [...proposal.sourceReferences],
    })),
  });
}

function assertProposalOrigins(
  proposals: readonly SourceReviewProposalInput[],
  expectedRevision: number,
): void {
  if (proposals.some(({ originRevision }) => originRevision !== expectedRevision)) {
    throw proposalInvalid();
  }
}

async function supersedeDraftProposals(
  transaction: Transaction,
  reviewId: string,
  successorRevision: number,
  input: Readonly<{ actorId: string }>,
): Promise<void> {
  const drafts = await transaction.researchProposal.findMany({
    where: { reviewId, state: "DRAFT" },
    orderBy: { id: "asc" },
  });
  for (const draft of drafts) {
    const reason = `Superseded by private review revision ${String(successorRevision)}.`;
    await transaction.researchProposal.update({
      where: { id: draft.id },
      data: { state: "DISMISSED", version: { increment: 1 } },
    });
    await transaction.researchProposalTransition.create({
      data: {
        proposalId: draft.id,
        kind: "DISMISSED",
        reason,
        actorId: input.actorId,
        resultingVersion: draft.version + 1,
      },
    });
  }
}

async function lockOwned(transaction: Transaction, reviewId: string, ownerId: string) {
  await transaction.$queryRaw`
    SELECT id FROM "ResearchSourceReview" WHERE id = ${reviewId}::uuid FOR UPDATE
  `;
  const review = await transaction.researchSourceReview.findFirst({
    where: { id: reviewId, ownerId },
  });
  if (review === null) throw forbidden();
  return review;
}

function assertReplayMatches(
  existing: Awaited<ReturnType<typeof loadReview>>,
  input: CreatePendingReviewInput,
): void {
  const sealed = asRecord(existing.sealedSource);
  if (
    existing.workstreamId !== input.scope.workstreamId ||
    existing.workItemId !== input.scope.workItemId ||
    existing.sourceKind !== input.sourceKind ||
    existing.documentVersionId !== input.documentVersionId ||
    sealed.sourceFingerprint !== input.sealedSource.sourceFingerprint
  ) {
    throw replayMismatch();
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function hasDatabaseRaceCode(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  const code = (error as { code?: unknown }).code;
  return code === "P2002" || code === "P2034";
}

function assertExpectedVersion(actual: number, expected: number): void {
  if (actual !== expected) throw versionConflict();
}

function assertMutableReviewState(state: string): void {
  if (!new Set(["PENDING_RETRIEVAL", "STALE"]).has(state)) throw invalidState();
}

function forbidden(): AppError {
  return new AppError(
    "RESEARCH_SOURCE_REVIEW_FORBIDDEN",
    "errors.research.sourceReviewForbidden",
    403,
  );
}

function replayMismatch(): AppError {
  return new AppError(
    "RESEARCH_SOURCE_REVIEW_REPLAY_MISMATCH",
    "errors.research.sourceReviewReplayMismatch",
    409,
  );
}

function versionConflict(): AppError {
  return new AppError(
    "RESEARCH_SOURCE_REVIEW_VERSION_CONFLICT",
    "errors.research.sourceReviewVersionConflict",
    409,
  );
}

function invalidState(): AppError {
  return new AppError(
    "RESEARCH_SOURCE_REVIEW_STATE_INVALID",
    "errors.research.sourceReviewStateInvalid",
    409,
  );
}

function proposalInvalid(): AppError {
  return new AppError(
    "RESEARCH_SOURCE_REVIEW_PROPOSAL_INVALID",
    "errors.research.sourceReviewProposalInvalid",
    409,
  );
}

function proposalVersionConflict(): AppError {
  return new AppError(
    "RESEARCH_SOURCE_REVIEW_PROPOSAL_VERSION_CONFLICT",
    "errors.research.sourceReviewProposalVersionConflict",
    409,
  );
}
