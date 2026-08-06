import { createHash } from "node:crypto";

import {
  AppError,
  ConfirmResearchSourceDispositionInputSchema,
  CreateResearchSourceReviewInputSchema,
  ResearchSourceReviewDetailSchema,
  ResearchSourceReviewOutputSchema,
} from "@evaluation/contracts";

import type { ResearchAiAssistant } from "./ai-assistant.js";
import type { ResearchProjectContextSnapshot } from "./project-context.js";
import type { SourceRetriever } from "./source-retrieval.js";
import { ResearchSourceReviewPersistence, type SealedValue } from "./source-review-persistence.js";

type ResearchScope = import("@evaluation/contracts").ResearchScope;
type ResearchSourceReviewDetail = import("@evaluation/contracts").ResearchSourceReviewDetail;
type ResearchSourceReviewOutput = import("@evaluation/contracts").ResearchSourceReviewOutput;
type ResearchSourceReviewState = import("@evaluation/contracts").ResearchSourceReviewState;
type RetrievedResearchSource = import("./source-retrieval.js").RetrievedResearchSource;
type SourceReviewLoaded = import("./source-review-persistence.js").SourceReviewLoaded;
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

  constructor(dependencies: Dependencies) {
    this.#dependencies = {
      ...dependencies,
      clock: dependencies.clock ?? (() => new Date()),
      idFactory: dependencies.idFactory ?? (() => crypto.randomUUID()),
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
    });
    if (review.state !== "PENDING_RETRIEVAL") {
      return this.#materialize(review, parsed.source);
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
    await this.#dependencies.authorizer.authorize({
      actor: input.actor,
      scope,
      at: this.#dependencies.clock(),
    });
    const source = await this.#openJson<ResearchSource>(review.sealedSource);
    return this.#materialize(review, source);
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
      latest !== undefined &&
      latest.contentFingerprint === source.contentFingerprint &&
      latest.projectContextFingerprint === context.fingerprintSha256
    ) {
      return this.#materialize(review, sourceInput);
    }
    assertSourceReviewTransition(review.state, "STALE");
    const stale = await this.#dependencies.persistence.appendStale({
      reviewId: review.id,
      ownerId: input.actor.userId,
      expectedVersion: input.expectedVersion,
      displayUrl: source.displayUrl,
      contentFingerprint: source.contentFingerprint,
      projectContextFingerprint: context.fingerprintSha256,
      actorId: input.actor.userId,
      createdAt: at,
    });
    return this.#analyze({
      actor: input.actor,
      scope,
      review: stale,
      source,
      context,
      correlationId: input.correlationId,
      at,
      sourceInput,
    });
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
    await this.#dependencies.authorizer.authorize({
      actor: input.actor,
      scope,
      at: this.#dependencies.clock(),
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
          })
        : await this.#dependencies.persistence.dismiss({
            reviewId: review.id,
            ownerId: input.actor.userId,
            expectedVersion: disposition.expectedVersion,
            proposalIds: disposition.proposalIds,
            reason: disposition.reason,
            actorId: input.actor.userId,
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
    if (input.source.retrievalState === "BLOCKED" || input.source.text === null) {
      const blockedState = input.source.retrievalState === "PARTIAL" ? "PARTIAL" : "BLOCKED";
      const sealedRetrieved =
        input.source.privatePayload === null
          ? null
          : await sealJson(this.#dependencies.protector, input.source.privatePayload);
      const updated = await this.#dependencies.persistence.appendBlocked({
        reviewId: input.review.id,
        ownerId: input.actor.userId,
        expectedVersion: input.review.version,
        retrievalState: blockedState,
        retrievalReason: input.source.retrievalReason ?? "SOURCE_UNAVAILABLE",
        displayUrl: input.source.displayUrl,
        contentFingerprint: input.source.contentFingerprint,
        projectContextFingerprint: input.context.fingerprintSha256,
        sealedRetrievedContent: sealedRetrieved,
        actorId: input.actor.userId,
        createdAt: input.at,
      });
      return this.#materialize(updated, input.sourceInput);
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
          sourceReferences: proposal.sourceReferences,
          sealedContent: await this.#dependencies.protector.seal(JSON.stringify(proposal)),
        })),
      ),
    ]);
    const state = input.source.retrievalState === "PARTIAL" ? "PARTIAL" : "READY_FOR_REVIEW";
    assertSourceReviewTransition(input.review.state, state);
    const updated = await this.#dependencies.persistence.appendReviewed({
      reviewId: input.review.id,
      ownerId: input.actor.userId,
      expectedVersion: input.review.version,
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
      actorId: input.actor.userId,
      createdAt: input.at,
    });
    return this.#detail(updated, input.sourceInput, output);
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
    const revision = review.revisions.at(-1);
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
    const revision = review.revisions.at(-1);
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
