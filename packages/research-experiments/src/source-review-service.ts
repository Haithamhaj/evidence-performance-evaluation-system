import { createHash } from "node:crypto";

import {
  AppError,
  ConfirmResearchSourceDispositionInputSchema,
  CreateResearchSourceReviewInputSchema,
  ResearchSourceReviewDetailSchema,
  ResearchSourceReviewOutputSchema,
  ResearchSourceReviewProposalSchema,
} from "@evaluation/contracts";

import type { ResearchAiAssistant } from "./ai-assistant.js";
import type { ResearchProjectContextSnapshot } from "./project-context.js";
import type { SourceRetriever } from "./source-retrieval.js";
import { ResearchSourceReviewPersistence, type SealedValue } from "./source-review-persistence.js";

type ResearchScope = import("@evaluation/contracts").ResearchScope;
type ResearchSourceReviewDetail = import("@evaluation/contracts").ResearchSourceReviewDetail;
type ResearchSourceReviewOutput = import("@evaluation/contracts").ResearchSourceReviewOutput;
type ResearchSourceReviewState = import("@evaluation/contracts").ResearchSourceReviewState;
type ResearchSourceReviewProposal = import("@evaluation/contracts").ResearchSourceReviewProposal;
type RetrievedResearchSource = import("./source-retrieval.js").RetrievedResearchSource;
type SourceReviewLoaded = import("./source-review-persistence.js").SourceReviewLoaded;
type ReanalysisCandidate = import("./source-review-persistence.js").ReanalysisCandidate;
type Actor = Readonly<{ userId: string; active: boolean }>;
type ResearchSource =
  | Readonly<{ kind: "URL"; url: string }>
  | Readonly<{ kind: "CONNECTED_CONTEXT"; sourceItemId: string }>
  | Readonly<{ kind: "DOCUMENT_VERSION"; documentVersionId: string }>;
type RetrievalState = "RETRIEVED" | "PARTIAL" | "BLOCKED";

type ScopeAuthorizer = Readonly<{
  authorize(input: Readonly<{ actor: Actor; scope: ResearchScope; at: Date }>): Promise<unknown>;
}>;

type ProjectContextReader = Readonly<{
  readAuthorizedSnapshot(
    input: Readonly<{
      actor: Actor;
      scope: ResearchScope;
      at: Date;
    }>,
  ): Promise<ResearchProjectContextSnapshot>;
}>;

type ConnectedSourceReader = Readonly<{
  readPrivateSourceIntake(input: Readonly<{ actor: Actor; sourceItemId: string }>): Promise<
    Readonly<{
      sourceItemId: string;
      provider: string;
      occurredAt: string;
      title: string;
      summary: string | null;
      sourceUrl: string | null;
      sourceReference: string;
    }>
  >;
}>;

type DocumentReader = Readonly<{
  readApprovedVersion(
    input: Readonly<{
      actor: Actor;
      projectId: string;
      documentVersionId: string;
    }>,
  ): Promise<
    Readonly<{
      projectId: string;
      documentId: string;
      documentVersionId: string;
      documentVersion: number;
      sourceChecksumSha256: string;
      sourceReferences: readonly string[];
      extractedText: string;
    }>
  >;
}>;

type PrivateResearchOutputProtector = Readonly<{
  seal(value: string): Promise<SealedValue>;
  open(value: SealedValue): Promise<string>;
}>;

type Dependencies = Readonly<{
  persistence: ResearchSourceReviewPersistence;
  authorizer: ScopeAuthorizer;
  projectContexts: ProjectContextReader;
  retriever: Pick<SourceRetriever, "retrieve">;
  connectedSources: ConnectedSourceReader;
  documents: DocumentReader;
  assistant: Pick<ResearchAiAssistant, "reviewSource">;
  protector: PrivateResearchOutputProtector;
  systemId: string;
  clock?: () => Date;
  idFactory?: () => string;
  pendingWaitPolicy?: Readonly<{
    staleAfterMs: number;
    pollIntervalMs: number;
    maxWaitMs: number;
    sleep?: (milliseconds: number) => Promise<void>;
  }>;
}>;

type StartInput = Readonly<{
  actor: Actor;
  scope: ResearchScope;
  idempotencyKey: string;
  source: ResearchSource;
  correlationId: string;
}>;

type AcquiredSource = Readonly<{
  retrievalState: RetrievalState;
  retrievalReason: string | null;
  displayUrl: string | null;
  contentFingerprint: string | null;
  text: string | null;
  privatePayload: unknown;
  sourceReferences: readonly string[];
}>;

type BuiltReviewCandidate = Readonly<{
  persistence: ReanalysisCandidate;
  output: ResearchSourceReviewOutput | null;
}>;

export type PrivateSourceReviewRevision = Readonly<{
  reviewId: string;
  revision: number;
  retrievalState: "PENDING" | "RETRIEVED" | "PARTIAL" | "BLOCKED" | "STALE";
  retrievalReason: string | null;
  displayUrl: string | null;
  contentFingerprint: string | null;
  projectContextFingerprint: string | null;
  retrievedContent: unknown | null;
  output: ResearchSourceReviewOutput | null;
  outputProvenance: Readonly<{
    promptVersion: string;
    routeTrace: NonNullable<ReturnType<typeof asRouteTrace>>;
  }> | null;
  disposition: Readonly<{ kind: "CONFIRM" | "DISMISS"; reason: string }> | null;
}>;

type PrivateProposalEnvelope = Readonly<{
  schemaVersion: "research-proposal-private.v1";
  originRevision: number;
  predecessorProposalId: string | null;
  editReason: string | null;
  proposal: ResearchSourceReviewProposal;
}>;

export type EditedPrivateProposal = Readonly<{
  proposalId: string;
  proposalVersion: number;
  predecessorProposalId: string;
  originRevision: number;
  proposal: ResearchSourceReviewProposal;
}>;

const ALLOWED_TRANSITIONS: Readonly<
  Record<ResearchSourceReviewState, readonly ResearchSourceReviewState[]>
> = {
  PENDING_RETRIEVAL: ["READY_FOR_REVIEW", "PARTIAL", "BLOCKED"],
  READY_FOR_REVIEW: ["CONFIRMED", "DISMISSED", "STALE"],
  PARTIAL: ["CONFIRMED", "DISMISSED", "STALE"],
  BLOCKED: [],
  CONFIRMED: [],
  DISMISSED: [],
  STALE: ["READY_FOR_REVIEW", "PARTIAL", "BLOCKED"],
};

const RECOVERY_OPTIONS = [
  {
    kind: "UPLOAD_DOCUMENT" as const,
    explanation: "Upload an approved document when the source cannot be retrieved safely.",
  },
  {
    kind: "ADD_MANUAL_CITATION" as const,
    explanation: "Add a manual citation and source excerpt for employee review.",
  },
  {
    kind: "TRY_AGAIN" as const,
    explanation: "Try retrieving the same source again later.",
  },
] as const;

export function assertSourceReviewTransition(
  from: ResearchSourceReviewState,
  to: ResearchSourceReviewState,
): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) throw invalidState();
}

export function recoveryOptionsFor(state: RetrievalState | "PENDING" | "STALE") {
  return state === "PARTIAL" || state === "BLOCKED" ? [...RECOVERY_OPTIONS] : [];
}

export function sourceInputFingerprint(source: ResearchSource): string {
  return sha256(JSON.stringify(source));
}

export function sanitizeResearchDisplayUrl(value: string): string {
  const url = new URL(value);
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/u, url.pathname === "/" ? "/" : "");
}

export class ResearchSourceReviewService {
  readonly #dependencies: Required<Pick<Dependencies, "clock" | "idFactory">> & Dependencies;
  readonly #pendingWaitPolicy: Readonly<{
    staleAfterMs: number;
    pollIntervalMs: number;
    maxWaitMs: number;
    sleep: (milliseconds: number) => Promise<void>;
  }>;

  constructor(dependencies: Dependencies) {
    this.#dependencies = {
      ...dependencies,
      clock: dependencies.clock ?? (() => new Date()),
      idFactory: dependencies.idFactory ?? (() => crypto.randomUUID()),
    };
    this.#pendingWaitPolicy = {
      staleAfterMs: dependencies.pendingWaitPolicy?.staleAfterMs ?? 30_000,
      pollIntervalMs: dependencies.pendingWaitPolicy?.pollIntervalMs ?? 5,
      maxWaitMs: dependencies.pendingWaitPolicy?.maxWaitMs ?? 60_000,
      sleep:
        dependencies.pendingWaitPolicy?.sleep ??
        ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))),
    };
  }

  async start(input: StartInput): Promise<ResearchSourceReviewDetail> {
    assertActive(input.actor);
    const parsed = CreateResearchSourceReviewInputSchema.parse({
      scope: input.scope,
      idempotencyKey: input.idempotencyKey,
      source: input.source,
    });
    const at = this.#dependencies.clock();
    await this.#dependencies.authorizer.authorize({ actor: input.actor, scope: parsed.scope, at });
    const sourceFingerprint = sourceInputFingerprint(parsed.source);
    const sealedSource = await this.#dependencies.protector.seal(JSON.stringify(parsed.source));
    const review = await this.#dependencies.persistence.createOrReplayPending({
      id: this.#dependencies.idFactory(),
      ownerId: input.actor.userId,
      scope: parsed.scope,
      idempotencyKey: parsed.idempotencyKey,
      sourceKind: parsed.source.kind,
      sealedSource: { ...sealedSource, sourceFingerprint },
      documentVersionId:
        parsed.source.kind === "DOCUMENT_VERSION" ? parsed.source.documentVersionId : null,
      createdAt: at,
      claimedAt: at,
      staleBefore: new Date(at.getTime() - this.#pendingWaitPolicy.staleAfterMs),
    });
    if (review.state !== "PENDING_RETRIEVAL") {
      return this.#materialize(review, parsed.source);
    }
    if (!review.processingClaimed) {
      return this.#waitForPendingWinner({
        actor: input.actor,
        source: parsed.source,
        correlationId: input.correlationId,
        pendingInput: {
          id: review.id,
          ownerId: input.actor.userId,
          scope: parsed.scope,
          idempotencyKey: parsed.idempotencyKey,
          sourceKind: parsed.source.kind,
          sealedSource: { ...sealedSource, sourceFingerprint },
          documentVersionId:
            parsed.source.kind === "DOCUMENT_VERSION" ? parsed.source.documentVersionId : null,
          createdAt: review.createdAt,
        },
      });
    }
    const context = await this.#dependencies.projectContexts.readAuthorizedSnapshot({
      actor: input.actor,
      scope: parsed.scope,
      at,
    });
    const source = await this.#acquire(input.actor, parsed.scope, parsed.source);
    return this.#analyze({
      actor: input.actor,
      scope: parsed.scope,
      review,
      source,
      context,
      correlationId: input.correlationId,
      at,
      sourceInput: parsed.source,
    });
  }

  async #waitForPendingWinner(
    input: Readonly<{
      actor: Actor;
      source: ResearchSource;
      correlationId: string;
      pendingInput: Omit<
        import("./source-review-persistence.js").CreatePendingReviewInput,
        "claimedAt" | "staleBefore"
      >;
    }>,
  ): Promise<ResearchSourceReviewDetail> {
    let waitedMs = 0;
    while (waitedMs < this.#pendingWaitPolicy.maxWaitMs) {
      await this.#pendingWaitPolicy.sleep(this.#pendingWaitPolicy.pollIntervalMs);
      waitedMs += this.#pendingWaitPolicy.pollIntervalMs;
      const now = this.#dependencies.clock();
      const claim = await this.#dependencies.persistence.createOrReplayPending({
        ...input.pendingInput,
        claimedAt: now,
        staleBefore: new Date(now.getTime() - this.#pendingWaitPolicy.staleAfterMs),
      });
      if (claim.state !== "PENDING_RETRIEVAL") return this.#materialize(claim, input.source);
      if (claim.processingClaimed) {
        const context = await this.#dependencies.projectContexts.readAuthorizedSnapshot({
          actor: input.actor,
          scope: input.pendingInput.scope,
          at: now,
        });
        const source = await this.#acquire(input.actor, input.pendingInput.scope, input.source);
        return this.#analyze({
          actor: input.actor,
          scope: input.pendingInput.scope,
          review: claim,
          source,
          context,
          correlationId: input.correlationId,
          at: now,
          sourceInput: input.source,
        });
      }
    }
    throw pendingReview();
  }

  async getPrivate(
    input: Readonly<{
      actor: Actor;
      reviewId: string;
    }>,
  ): Promise<ResearchSourceReviewDetail> {
    assertActive(input.actor);
    const review = await this.#dependencies.persistence.loadOwned({
      reviewId: input.reviewId,
      ownerId: input.actor.userId,
    });
    const scope = scopeOf(review);
    const at = this.#dependencies.clock();
    await this.#dependencies.authorizer.authorize({
      actor: input.actor,
      scope,
      at,
    });
    const source = await this.#openJson<ResearchSource>(review.sealedSource);
    return this.#materialize(review, source);
  }

  async getPrivateRevision(
    input: Readonly<{ actor: Actor; reviewId: string; revision: number }>,
  ): Promise<PrivateSourceReviewRevision> {
    assertActive(input.actor);
    const review = await this.#dependencies.persistence.loadOwned({
      reviewId: input.reviewId,
      ownerId: input.actor.userId,
    });
    await this.#dependencies.authorizer.authorize({
      actor: input.actor,
      scope: scopeOf(review),
      at: this.#dependencies.clock(),
    });
    const revision = review.revisions.find((candidate) => candidate.revision === input.revision);
    if (revision === undefined) throw revisionNotFound();
    const retrievedContent =
      revision.sealedRetrievedContent === null
        ? null
        : JSON.parse(
            await this.#dependencies.protector.open(parseSealed(revision.sealedRetrievedContent)),
          );
    const output =
      revision.sealedOutput === null
        ? null
        : ResearchSourceReviewOutputSchema.parse(
            JSON.parse(await this.#dependencies.protector.open(parseSealed(revision.sealedOutput))),
          );
    const routeTrace = asRouteTrace(revision.routeTrace);
    return {
      reviewId: review.id,
      revision: revision.revision,
      retrievalState: revision.retrievalState,
      retrievalReason: revision.retrievalReason,
      displayUrl: revision.displayUrl,
      contentFingerprint: revision.contentFingerprint,
      projectContextFingerprint: revision.projectContextFingerprint,
      retrievedContent,
      output,
      outputProvenance:
        output === null || revision.promptVersion === null || routeTrace === null
          ? null
          : { promptVersion: revision.promptVersion, routeTrace },
      disposition: parseDisposition(retrievedContent),
    };
  }

  async reanalyze(
    input: Readonly<{
      actor: Actor;
      reviewId: string;
      expectedVersion: number;
      correlationId: string;
    }>,
  ): Promise<ResearchSourceReviewDetail> {
    assertActive(input.actor);
    const review = await this.#dependencies.persistence.loadOwned({
      reviewId: input.reviewId,
      ownerId: input.actor.userId,
    });
    if (review.version !== input.expectedVersion) throw versionConflict();
    const scope = scopeOf(review);
    const at = this.#dependencies.clock();
    await this.#dependencies.authorizer.authorize({ actor: input.actor, scope, at });
    const sourceInput = await this.#openJson<ResearchSource>(review.sealedSource);
    const [source, context] = await Promise.all([
      this.#acquire(input.actor, scope, sourceInput),
      this.#dependencies.projectContexts.readAuthorizedSnapshot({ actor: input.actor, scope, at }),
    ]);
    const latest = review.revisions.at(-1);
    if (
      review.state !== "STALE" &&
      latest !== undefined &&
      latest.contentFingerprint === source.contentFingerprint &&
      latest.projectContextFingerprint === context.fingerprintSha256
    ) {
      return this.#materialize(review, sourceInput);
    }
    if (review.state !== "STALE") assertSourceReviewTransition(review.state, "STALE");
    const targetRevision = review.currentRevision + (review.state === "STALE" ? 1 : 2);
    const candidate = await this.#buildCandidate({
      scope,
      review,
      source,
      context,
      correlationId: input.correlationId,
      targetRevision,
    });
    const updated = await this.#dependencies.persistence.appendReanalysis({
      reviewId: review.id,
      ownerId: input.actor.userId,
      expectedVersion: input.expectedVersion,
      candidate: candidate.persistence,
      actorId: input.actor.userId,
      createdAt: at,
    });
    return candidate.output === null
      ? this.#materialize(updated, sourceInput)
      : this.#detail(updated, sourceInput, candidate.output);
  }

  async editProposal(
    input: Readonly<{
      actor: Actor;
      reviewId: string;
      proposalId: string;
      expectedProposalVersion: number;
      reason: string;
      replacement: ResearchSourceReviewProposal;
      correlationId: string;
    }>,
  ): Promise<EditedPrivateProposal> {
    assertActive(input.actor);
    const replacement = ResearchSourceReviewProposalSchema.parse(input.replacement);
    if (
      !Number.isInteger(input.expectedProposalVersion) ||
      input.expectedProposalVersion < 1 ||
      input.reason.trim().length === 0 ||
      input.reason.length > 1_000
    ) {
      throw proposalInvalid();
    }
    const review = await this.#dependencies.persistence.loadOwned({
      reviewId: input.reviewId,
      ownerId: input.actor.userId,
    });
    await this.#dependencies.authorizer.authorize({
      actor: input.actor,
      scope: scopeOf(review),
      at: this.#dependencies.clock(),
    });
    const current = review.proposals.find(({ id }) => id === input.proposalId);
    if (current === undefined) throw proposalInvalid();
    if (current.version !== input.expectedProposalVersion) throw proposalVersionConflict();
    if (current.state !== "DRAFT") throw proposalInvalid();
    const currentEnvelope = await this.#openProposalEnvelope(current.content);
    if (
      currentEnvelope.originRevision !== review.currentRevision ||
      currentEnvelope.proposal.kind !== replacement.kind ||
      replacement.id === current.id
    ) {
      throw proposalInvalid();
    }
    const successorEnvelope: PrivateProposalEnvelope = {
      schemaVersion: "research-proposal-private.v1",
      originRevision: review.currentRevision,
      predecessorProposalId: current.id,
      editReason: input.reason.trim(),
      proposal: replacement,
    };
    const updated = await this.#dependencies.persistence.editProposal({
      reviewId: review.id,
      ownerId: input.actor.userId,
      reviewRevision: review.currentRevision,
      proposalId: current.id,
      expectedProposalVersion: input.expectedProposalVersion,
      successor: {
        id: replacement.id,
        kind: replacement.kind,
        originRevision: review.currentRevision,
        sourceReferences: replacement.sourceReferences,
        sealedContent: await this.#dependencies.protector.seal(JSON.stringify(successorEnvelope)),
      },
      reason: input.reason.trim(),
      actorId: input.actor.userId,
    });
    const successor = updated.proposals.find(({ id }) => id === replacement.id);
    if (successor === undefined) throw proposalInvalid();
    return {
      proposalId: successor.id,
      proposalVersion: successor.version,
      predecessorProposalId: current.id,
      originRevision: review.currentRevision,
      proposal: replacement,
    };
  }

  async confirmDisposition(
    input: Readonly<{
      actor: Actor;
      reviewId: string;
      correlationId: string;
      input: Readonly<{
        expectedVersion: number;
        disposition: "CONFIRM" | "DISMISS";
        reason: string;
        proposalIds: readonly string[];
      }>;
    }>,
  ): Promise<ResearchSourceReviewDetail> {
    assertActive(input.actor);
    const disposition = ConfirmResearchSourceDispositionInputSchema.parse(input.input);
    const review = await this.#dependencies.persistence.loadOwned({
      reviewId: input.reviewId,
      ownerId: input.actor.userId,
    });
    const scope = scopeOf(review);
    const at = this.#dependencies.clock();
    await this.#dependencies.authorizer.authorize({
      actor: input.actor,
      scope,
      at,
    });
    if (review.version !== disposition.expectedVersion) throw versionConflict();
    for (const proposalId of disposition.proposalIds) {
      const proposal = review.proposals.find(({ id }) => id === proposalId);
      if (proposal === undefined || proposal.state !== "DRAFT") throw proposalInvalid();
      const envelope = await this.#openProposalEnvelope(proposal.content);
      if (envelope.originRevision !== review.currentRevision) throw proposalInvalid();
    }
    const sealedDisposition = await sealJson(this.#dependencies.protector, {
      schemaVersion: "research-source-review-disposition.v1",
      kind: disposition.disposition,
      reason: disposition.reason,
    });
    const updated =
      disposition.disposition === "CONFIRM"
        ? await this.#dependencies.persistence.confirm({
            reviewId: review.id,
            ownerId: input.actor.userId,
            expectedVersion: disposition.expectedVersion,
            proposalIds: disposition.proposalIds,
            reason: disposition.reason,
            actorId: input.actor.userId,
            sealedDisposition,
            createdAt: at,
          })
        : await this.#dependencies.persistence.dismiss({
            reviewId: review.id,
            ownerId: input.actor.userId,
            expectedVersion: disposition.expectedVersion,
            proposalIds: disposition.proposalIds,
            reason: disposition.reason,
            actorId: input.actor.userId,
            sealedDisposition,
            createdAt: at,
          });
    const source = await this.#openJson<ResearchSource>(updated.sealedSource);
    return this.#materialize(updated, source);
  }

  async dismiss(
    input: Readonly<{
      actor: Actor;
      reviewId: string;
      expectedVersion: number;
      reason: string;
      correlationId: string;
    }>,
  ): Promise<ResearchSourceReviewDetail> {
    return this.confirmDisposition({
      actor: input.actor,
      reviewId: input.reviewId,
      correlationId: input.correlationId,
      input: {
        expectedVersion: input.expectedVersion,
        disposition: "DISMISS",
        reason: input.reason,
        proposalIds: [],
      },
    });
  }

  async #analyze(
    input: Readonly<{
      actor: Actor;
      scope: ResearchScope;
      review: SourceReviewLoaded;
      source: AcquiredSource;
      context: ResearchProjectContextSnapshot;
      correlationId: string;
      at: Date;
      sourceInput: ResearchSource;
    }>,
  ): Promise<ResearchSourceReviewDetail> {
    const candidate = await this.#buildCandidate({
      scope: input.scope,
      review: input.review,
      source: input.source,
      context: input.context,
      correlationId: input.correlationId,
      targetRevision: input.review.currentRevision + 1,
    });
    if (candidate.persistence.kind === "BLOCKED") {
      const updated = await this.#dependencies.persistence.appendBlocked({
        reviewId: input.review.id,
        ownerId: input.actor.userId,
        expectedVersion: input.review.version,
        retrievalState: candidate.persistence.retrievalState,
        retrievalReason: candidate.persistence.retrievalReason,
        displayUrl: candidate.persistence.displayUrl,
        contentFingerprint: candidate.persistence.contentFingerprint,
        projectContextFingerprint: candidate.persistence.projectContextFingerprint,
        sealedRetrievedContent: candidate.persistence.sealedRetrievedContent,
        actorId: input.actor.userId,
        createdAt: input.at,
      });
      return this.#materialize(updated, input.sourceInput);
    }
    assertSourceReviewTransition(input.review.state, candidate.persistence.state);
    const updated = await this.#dependencies.persistence.appendReviewed({
      reviewId: input.review.id,
      ownerId: input.actor.userId,
      expectedVersion: input.review.version,
      state: candidate.persistence.state,
      retrievalState: candidate.persistence.retrievalState,
      retrievalReason: candidate.persistence.retrievalReason,
      displayUrl: candidate.persistence.displayUrl,
      contentFingerprint: candidate.persistence.contentFingerprint,
      projectContextFingerprint: candidate.persistence.projectContextFingerprint,
      sealedRetrievedContent: candidate.persistence.sealedRetrievedContent,
      sealedOutput: candidate.persistence.sealedOutput,
      citationIdentities: candidate.persistence.citationIdentities,
      schemaVersion: candidate.persistence.schemaVersion,
      promptVersion: candidate.persistence.promptVersion,
      routeTrace: candidate.persistence.routeTrace,
      proposals: candidate.persistence.proposals,
      actorId: input.actor.userId,
      createdAt: input.at,
    });
    return this.#detail(updated, input.sourceInput, candidate.output!);
  }

  async #buildCandidate(
    input: Readonly<{
      scope: ResearchScope;
      review: SourceReviewLoaded;
      source: AcquiredSource;
      context: ResearchProjectContextSnapshot;
      correlationId: string;
      targetRevision: number;
    }>,
  ): Promise<BuiltReviewCandidate> {
    if (input.source.retrievalState === "BLOCKED" || input.source.text === null) {
      const blockedState = input.source.retrievalState === "PARTIAL" ? "PARTIAL" : "BLOCKED";
      const sealedRetrieved =
        input.source.privatePayload === null
          ? null
          : await sealJson(this.#dependencies.protector, input.source.privatePayload);
      return {
        output: null,
        persistence: {
          kind: "BLOCKED",
          retrievalState: blockedState,
          retrievalReason: input.source.retrievalReason ?? "SOURCE_UNAVAILABLE",
          displayUrl: input.source.displayUrl,
          contentFingerprint: input.source.contentFingerprint,
          projectContextFingerprint: input.context.fingerprintSha256,
          sealedRetrievedContent: sealedRetrieved,
        },
      };
    }
    const retrievalReference = `retrieval:${input.source.contentFingerprint ?? sha256(input.source.text)}`;
    const sourceReferences = unique([
      retrievalReference,
      ...input.source.sourceReferences,
      ...input.context.sourceReferences,
    ]);
    const outputReference = `research-source-review:${input.review.id}`;
    const governed = await this.#dependencies.assistant.reviewSource(
      {
        projectId: input.scope.projectId,
        systemId: this.#dependencies.systemId,
        correlationId: input.correlationId,
        inputReference: outputReference,
        outputReference,
        sourceReferences,
        payload: {
          retrievalState: input.source.retrievalState,
          retrievedText: input.source.text,
          retrievalReason: input.source.retrievalReason,
          projectContext: input.context,
        },
      },
      async (_transaction, output) => {
        ResearchSourceReviewOutputSchema.parse(output);
        return { outputReference };
      },
    );
    const output = ResearchSourceReviewOutputSchema.parse(governed.output);
    const [sealedRetrievedContent, sealedOutput, sealedProposals] = await Promise.all([
      sealJson(this.#dependencies.protector, {
        text: input.source.text,
        privatePayload: input.source.privatePayload,
      }),
      sealJson(this.#dependencies.protector, output),
      Promise.all(
        output.proposals.map(async (proposal) => ({
          id: proposal.id,
          kind: proposal.kind,
          originRevision: input.targetRevision,
          sourceReferences: proposal.sourceReferences,
          sealedContent: await this.#dependencies.protector.seal(
            JSON.stringify({
              schemaVersion: "research-proposal-private.v1",
              originRevision: input.targetRevision,
              predecessorProposalId: null,
              editReason: null,
              proposal,
            }),
          ),
        })),
      ),
    ]);
    const state = input.source.retrievalState === "PARTIAL" ? "PARTIAL" : "READY_FOR_REVIEW";
    return {
      output,
      persistence: {
        kind: "REVIEWED",
        state,
        retrievalState: input.source.retrievalState,
        retrievalReason: input.source.retrievalReason,
        displayUrl: input.source.displayUrl,
        contentFingerprint: input.source.contentFingerprint ?? sha256(input.source.text),
        projectContextFingerprint: input.context.fingerprintSha256,
        sealedRetrievedContent,
        sealedOutput,
        citationIdentities: output.citations.map(({ sourceReference }) => sourceReference),
        schemaVersion: output.schemaVersion,
        promptVersion: governed.promptVersion,
        routeTrace: governed.routeTrace,
        proposals: sealedProposals,
      },
    };
  }

  async #acquire(
    actor: Actor,
    scope: ResearchScope,
    source: ResearchSource,
  ): Promise<AcquiredSource> {
    if (source.kind === "DOCUMENT_VERSION") {
      const document = await this.#dependencies.documents.readApprovedVersion({
        actor,
        projectId: scope.projectId,
        documentVersionId: source.documentVersionId,
      });
      const text = document.extractedText.trim();
      return {
        retrievalState: text.length === 0 ? "BLOCKED" : "RETRIEVED",
        retrievalReason: text.length === 0 ? "DOCUMENT_TEXT_UNAVAILABLE" : null,
        displayUrl: null,
        contentFingerprint: document.sourceChecksumSha256,
        text: text.length === 0 ? null : text,
        privatePayload: document,
        sourceReferences: document.sourceReferences,
      };
    }
    if (source.kind === "CONNECTED_CONTEXT") {
      const connected = await this.#dependencies.connectedSources.readPrivateSourceIntake({
        actor,
        sourceItemId: source.sourceItemId,
      });
      if (connected.sourceUrl !== null) {
        const retrieved = await this.#retrieveSafely(connected.sourceUrl);
        return acquiredFromRetrieved(retrieved, {
          privatePayload: { connected, retrievedText: retrieved.text },
          sourceReferences: [connected.sourceReference],
        });
      }
      const text = [connected.title, connected.summary].filter(isPresent).join("\n").trim();
      return {
        retrievalState: text.length === 0 ? "BLOCKED" : "PARTIAL",
        retrievalReason:
          text.length === 0 ? "CONNECTED_CONTEXT_EMPTY" : "CONNECTED_CONTEXT_METADATA_ONLY",
        displayUrl: null,
        contentFingerprint: text.length === 0 ? null : sha256(text),
        text: text.length === 0 ? null : text,
        privatePayload: connected,
        sourceReferences: [connected.sourceReference],
      };
    }
    const retrieved = await this.#retrieveSafely(source.url);
    return acquiredFromRetrieved(retrieved, { privatePayload: retrieved, sourceReferences: [] });
  }

  async #retrieveSafely(url: string): Promise<RetrievedResearchSource> {
    try {
      return await this.#dependencies.retriever.retrieve({ url });
    } catch {
      return {
        state: "BLOCKED",
        sourceKind: "GENERIC",
        sourceLabel: "EXPLICIT_PAGE",
        requestedUrl: url,
        resolvedUrl: url,
        retrievedAt: this.#dependencies.clock().toISOString(),
        title: null,
        mimeType: null,
        byteSize: 0,
        contentFingerprintSha256: null,
        text: null,
        reason: "SOURCE_RETRIEVAL_FAILED",
        recoveryOptions: [],
        redirectCount: 0,
      };
    }
  }

  async #materialize(
    review: SourceReviewLoaded,
    source: ResearchSource,
  ): Promise<ResearchSourceReviewDetail> {
    const latest = review.revisions.at(-1);
    const revision =
      review.state === "CONFIRMED" || review.state === "DISMISSED"
        ? [...review.revisions].reverse().find(({ sealedOutput }) => sealedOutput !== null)
        : latest;
    const output =
      revision?.sealedOutput === null || revision?.sealedOutput === undefined
        ? null
        : ResearchSourceReviewOutputSchema.parse(
            JSON.parse(await this.#dependencies.protector.open(parseSealed(revision.sealedOutput))),
          );
    return this.#detail(review, source, output);
  }

  #detail(
    review: SourceReviewLoaded,
    source: ResearchSource,
    output: ResearchSourceReviewOutput | null,
  ): ResearchSourceReviewDetail {
    const revision =
      output === null
        ? review.revisions.at(-1)
        : [...review.revisions].reverse().find(({ sealedOutput }) => sealedOutput !== null);
    const routeTrace = asRouteTrace(revision?.routeTrace);
    const promptVersion = revision?.promptVersion ?? null;
    return ResearchSourceReviewDetailSchema.parse({
      id: review.id,
      scope: scopeOf(review),
      ownerId: review.ownerId,
      state: review.state,
      version: review.version,
      source,
      displayUrl: review.displayUrl,
      retrievalState: review.retrievalState,
      retrievalReason: review.retrievalReason,
      contentFingerprint: review.contentFingerprint,
      output,
      outputProvenance:
        output === null || promptVersion === null || routeTrace === null
          ? null
          : { promptVersion, routeTrace },
      recoveryOptions: recoveryOptionsFor(review.retrievalState),
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
    });
  }

  async #openJson<T>(value: unknown): Promise<T> {
    const plain = await this.#dependencies.protector.open(parseSealed(value));
    return JSON.parse(plain) as T;
  }

  async #openProposalEnvelope(value: unknown): Promise<PrivateProposalEnvelope> {
    const plain = await this.#dependencies.protector.open(parseSealed(value));
    const parsed = JSON.parse(plain) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw invalidPrivateData();
    }
    const record = parsed as Record<string, unknown>;
    if (
      record.schemaVersion !== "research-proposal-private.v1" ||
      !Number.isInteger(record.originRevision) ||
      typeof record.originRevision !== "number" ||
      (record.predecessorProposalId !== null && typeof record.predecessorProposalId !== "string") ||
      (record.editReason !== null && typeof record.editReason !== "string")
    ) {
      throw invalidPrivateData();
    }
    return {
      schemaVersion: "research-proposal-private.v1",
      originRevision: record.originRevision,
      predecessorProposalId: record.predecessorProposalId,
      editReason: record.editReason,
      proposal: ResearchSourceReviewProposalSchema.parse(record.proposal),
    };
  }
}

function acquiredFromRetrieved(
  retrieved: RetrievedResearchSource,
  supplemental: Readonly<{ privatePayload: unknown; sourceReferences: readonly string[] }>,
): AcquiredSource {
  return {
    retrievalState: retrieved.state,
    retrievalReason: retrieved.reason,
    displayUrl: sanitizeResearchDisplayUrl(retrieved.resolvedUrl),
    contentFingerprint: retrieved.contentFingerprintSha256,
    text: retrieved.text,
    privatePayload: supplemental.privatePayload,
    sourceReferences: supplemental.sourceReferences,
  };
}

function scopeOf(review: SourceReviewLoaded): ResearchScope {
  return {
    projectId: review.projectId,
    workstreamId: review.workstreamId,
    workItemId: review.workItemId,
  };
}

function parseSealed(value: unknown): SealedValue {
  if (typeof value === "string") return parseSealed(JSON.parse(value));
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw invalidPrivateData();
  const record = value as Record<string, unknown>;
  if (typeof record.ciphertext !== "string" || typeof record.keyVersion !== "string") {
    throw invalidPrivateData();
  }
  return { ciphertext: record.ciphertext, keyVersion: record.keyVersion };
}

function asRouteTrace(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.aiRunId !== "string" ||
    typeof record.routeKey !== "string" ||
    typeof record.routeConfigId !== "string" ||
    typeof record.routeConfigVersion !== "number"
  )
    return null;
  return {
    aiRunId: record.aiRunId,
    routeKey: record.routeKey,
    routeConfigId: record.routeConfigId,
    routeConfigVersion: record.routeConfigVersion,
  };
}

function parseDisposition(
  value: unknown,
): Readonly<{ kind: "CONFIRM" | "DISMISS"; reason: string }> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== "research-source-review-disposition.v1") return null;
  if (
    (record.kind !== "CONFIRM" && record.kind !== "DISMISS") ||
    typeof record.reason !== "string"
  ) {
    throw invalidPrivateData();
  }
  return { kind: record.kind, reason: record.reason };
}

async function sealJson(
  protector: PrivateResearchOutputProtector,
  value: unknown,
): Promise<string> {
  return JSON.stringify(await protector.seal(JSON.stringify(value)));
}

function assertActive(actor: Actor): void {
  if (!actor.active) {
    throw new AppError("RESEARCH_SCOPE_FORBIDDEN", "errors.research.scopeForbidden", 403);
  }
}

function isPresent(value: string | null): value is string {
  return value !== null && value.trim().length > 0;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function invalidState(): AppError {
  return new AppError(
    "RESEARCH_SOURCE_REVIEW_STATE_INVALID",
    "errors.research.sourceReviewStateInvalid",
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

function invalidPrivateData(): AppError {
  return new AppError(
    "RESEARCH_SOURCE_REVIEW_PRIVATE_DATA_INVALID",
    "errors.research.sourceReviewPrivateDataInvalid",
    500,
  );
}

function pendingReview(): AppError {
  return new AppError("RESEARCH_SOURCE_REVIEW_PENDING", "errors.research.sourceReviewPending", 409);
}

function revisionNotFound(): AppError {
  return new AppError(
    "RESEARCH_SOURCE_REVIEW_REVISION_NOT_FOUND",
    "errors.research.sourceReviewRevisionNotFound",
    404,
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
