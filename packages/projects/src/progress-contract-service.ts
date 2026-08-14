import { databaseAuditWriter } from "@evaluation/audit";
import {
  DatabaseGitHubGovernedSourceReader,
  matchProgressConditions,
} from "@evaluation/github-integration";
import {
  AppError,
  ProgressContractDecisionInputSchema,
  type AuditWriter,
} from "@evaluation/contracts";
import { z } from "zod";

import { validateProgressContractDraft } from "./progress-contract-invariants.js";
import {
  type ApprovedProgressSource,
  assertProposalAuthority,
  serializeProgressContract,
  supersedePrevious,
  validProgressClock,
} from "./progress-contract-support.js";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type Transaction = import("@evaluation/database").DatabaseTransaction;

export interface ProgressDocumentSourceReader {
  getApprovedSourceIn(
    transaction: Transaction,
    input: { documentVersionId: string },
  ): Promise<ApprovedProgressSource | null>;
}

const ActorSchema = z.object({ userId: z.string().uuid(), active: z.literal(true) }).strict();
const ProposalCommandSchema = z
  .object({
    actor: ActorSchema,
    correlationId: z.string().uuid(),
    reason: z.string().trim().min(1).max(500),
    draft: z.unknown(),
  })
  .strict();
const DecisionCommandSchema = z
  .object({
    actor: ActorSchema,
    correlationId: z.string().uuid(),
    projectId: z.string().uuid(),
    contractId: z.string().uuid(),
    input: ProgressContractDecisionInputSchema,
  })
  .strict();
const GitHubSourceCommandSchema = z.object({ sourceEventId: z.string().uuid() }).strict();

export type GitHubSourceEvaluation =
  | Readonly<{
      state: "matched";
      sourceEventId: string;
      projectId: string;
      contractId: string;
      contractVersion: number;
      componentId: string;
      ruleId: string;
    }>
  | Readonly<{
      state: "owner_review_required";
      sourceEventId: string;
      projectId: string;
      disposition: "no_match" | "ambiguous";
      candidateRuleIds: readonly string[];
    }>;

export class ProgressContractService {
  private readonly client: DatabaseClient;
  private readonly auditWriter: AuditWriter<Transaction>;
  private readonly documentReader: ProgressDocumentSourceReader;
  private readonly identityReader: Pick<
    import("./criteria-review-reader.js").CriteriaReviewReader,
    "snapshotIn"
  >;
  private readonly clock: () => Date;
  private readonly githubSourceReader: import("@evaluation/github-integration").GitHubGovernedSourceReader;

  constructor(
    client: DatabaseClient,
    auditWriter: AuditWriter<Transaction>,
    documentReader: ProgressDocumentSourceReader,
    identityReader: Pick<import("./criteria-review-reader.js").CriteriaReviewReader, "snapshotIn">,
    clock: () => Date,
    githubSourceReader: import("@evaluation/github-integration").GitHubGovernedSourceReader,
  ) {
    this.client = client;
    this.auditWriter = auditWriter;
    this.documentReader = documentReader;
    this.identityReader = identityReader;
    this.clock = clock;
    this.githubSourceReader = githubSourceReader;
  }

  async propose(
    command: unknown,
    transaction?: Transaction,
  ): Promise<import("@evaluation/contracts").ProgressContract> {
    const parsed = ProposalCommandSchema.parse(command);
    const draft = validateProgressContractDraft(parsed.draft);
    const now = validProgressClock(this.clock);
    const proposeUsing = async (transaction: Transaction) => {
      const source = await this.documentReader.getApprovedSourceIn(transaction, {
        documentVersionId: draft.sourceDocumentVersionId,
      });
      const identity = await this.identityReader.snapshotIn(transaction, {
        kind: draft.scopeKind,
        resourceId: draft.workstreamId ?? draft.projectId,
        at: now,
      });
      assertProposalAuthority(parsed.actor.userId, draft, source, identity);
      const previous = await transaction.progressContract.findFirst({
        where: {
          projectId: draft.projectId,
          workstreamId: draft.workstreamId,
          state: "active",
        },
        orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
        select: { id: true, contractVersion: true },
      });
      const latest = await transaction.progressContract.findFirst({
        where: {
          projectId: draft.projectId,
          workstreamId: draft.workstreamId,
        },
        orderBy: [{ contractVersion: "desc" }, { createdAt: "desc" }],
        select: { contractVersion: true },
      });
      const id = crypto.randomUUID();
      const row = await transaction.progressContract.create({
        data: {
          id,
          scopeKind: draft.scopeKind,
          projectId: draft.projectId,
          workstreamId: draft.workstreamId,
          sourceDocumentId: draft.sourceDocumentId,
          sourceDocumentVersionId: draft.sourceDocumentVersionId,
          sourceDocumentVersionNo: draft.sourceDocumentVersion,
          calculationKind: draft.calculationKind,
          calculationSchemaVersion: draft.calculationSchemaVersion,
          contractVersion: (latest?.contractVersion ?? 0) + 1,
          ownerId: identity!.primaryOwnerId,
          effectiveAt: new Date(draft.effectiveAt),
          previousContractId: previous?.id ?? null,
          createdById: parsed.actor.userId,
          components: {
            create: draft.components.map((component, index) => ({
              ...component,
              position: index + 1,
            })),
          },
        },
        include: { components: { orderBy: { position: "asc" } } },
      });
      await this.auditWriter.append(transaction, {
        eventType: "progress_contract.proposed",
        actor: { kind: "human", id: parsed.actor.userId },
        effectiveSubjectId: parsed.actor.userId,
        scopeType: draft.scopeKind,
        scopeId: draft.workstreamId ?? draft.projectId,
        targetType: "progress_contract",
        targetId: id,
        reason: parsed.reason,
        safeDiff: {
          state: "draft",
          version: 1,
          sourceDocumentVersionId: draft.sourceDocumentVersionId,
        },
        correlationId: parsed.correlationId,
        source: "api",
      });
      return serializeProgressContract(row);
    };
    if (transaction !== undefined) return proposeUsing(transaction);
    return this.client.$transaction(proposeUsing, { isolationLevel: "Serializable" });
  }

  submitForApproval(command: unknown): Promise<import("@evaluation/contracts").ProgressContract> {
    return this.transition(command, "draft", "pending_approval");
  }

  approve(command: unknown): Promise<import("@evaluation/contracts").ProgressContract> {
    return this.transition(command, "pending_approval", "active");
  }

  reject(command: unknown): Promise<import("@evaluation/contracts").ProgressContract> {
    return this.transition(command, "pending_approval", "rejected");
  }

  async evaluateGitHubSource(command: unknown): Promise<GitHubSourceEvaluation> {
    const parsed = GitHubSourceCommandSchema.parse(command);
    const source = await this.githubSourceReader.getVerifiedSource({
      sourceEventId: parsed.sourceEventId,
    });
    if (source === null) {
      throw new AppError("GITHUB_SOURCE_EVENT_INVALID", "errors.github.sourceEventInvalid", 409);
    }
    return this.client.$transaction(
      async (transaction) => {
        const activeContract = await transaction.progressContract.findFirst({
          where: {
            projectId: source.projectId,
            state: "active",
            effectiveAt: { lte: source.occurredAt },
          },
          orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
          select: { id: true, contractVersion: true, state: true },
        });
        if (activeContract === null) {
          const evaluation = {
            sourceEventId: source.sourceEventId,
            bindingId: source.bindingId,
            projectId: source.projectId,
            disposition: "no_match",
            candidateRuleIds: [],
            contractId: null,
            contractVersion: null,
          } as const;
          await this.recordGitHubEvaluation(transaction, evaluation);
          return this.ownerReviewRequired(evaluation);
        }
        const rules = await transaction.gitHubContractRule.findMany({
          where: {
            bindingId: source.bindingId,
            contractId: activeContract.id,
            contractVersion: activeContract.contractVersion,
            effectiveAt: { lte: source.occurredAt },
            OR: [{ expiresAt: null }, { expiresAt: { gt: source.occurredAt } }],
          },
          select: {
            id: true,
            componentId: true,
            sourceId: true,
            eventKind: true,
            acceptanceState: true,
          },
        });
        const matchesByRuleId = new Map(
          source.governedFacts
            .flatMap((fact) =>
              rules
                .filter((rule) => rule.eventKind === fact.kind)
                .map((rule) =>
                  matchProgressConditions({
                    source: {
                      eventId: source.sourceEventId,
                      installationId: source.installationId,
                      repositoryId: source.repositoryId,
                      sourceId: source.sourceId,
                      acceptanceState: fact.state,
                    },
                    activeContract: {
                      id: activeContract.id,
                      version: activeContract.contractVersion,
                      state: activeContract.state,
                    },
                    conditions: [
                      {
                        id: rule.id,
                        contractId: activeContract.id,
                        contractVersion: activeContract.contractVersion,
                        componentId: rule.componentId,
                        sourceIdentity: {
                          installationId: source.installationId,
                          repositoryId: source.repositoryId,
                          sourceId: rule.sourceId,
                        },
                        acceptanceState: rule.acceptanceState,
                      },
                    ],
                  }),
                ),
            )
            .filter((match) => match.state === "matched")
            .map((match) => [match.conditionId, match] as const),
        );
        const matched = [...matchesByRuleId.values()];
        if (matched.length === 1) {
          const match = matched[0]!;
          await this.recordGitHubEvaluation(transaction, {
            sourceEventId: source.sourceEventId,
            bindingId: source.bindingId,
            projectId: source.projectId,
            disposition: "matched",
            candidateRuleIds: [match.conditionId],
            contractId: activeContract.id,
            contractVersion: activeContract.contractVersion,
          });
          return {
            state: "matched",
            sourceEventId: source.sourceEventId,
            projectId: source.projectId,
            contractId: match.contractId,
            contractVersion: match.contractVersion,
            componentId: match.componentId,
            ruleId: match.conditionId,
          };
        }
        const evaluation = {
          sourceEventId: source.sourceEventId,
          bindingId: source.bindingId,
          projectId: source.projectId,
          disposition: matched.length === 0 ? "no_match" : "ambiguous",
          candidateRuleIds: matched.map((match) => match.conditionId).sort(),
          contractId: activeContract.id,
          contractVersion: activeContract.contractVersion,
        } as const;
        await this.recordGitHubEvaluation(transaction, evaluation);
        return this.ownerReviewRequired(evaluation);
      },
      { isolationLevel: "Serializable" },
    );
  }

  private async recordGitHubEvaluation(
    transaction: Transaction,
    input: Readonly<{
      sourceEventId: string;
      bindingId: string;
      projectId: string;
      disposition: "matched" | "no_match" | "ambiguous";
      candidateRuleIds: readonly string[];
      contractId: string | null;
      contractVersion: number | null;
    }>,
  ): Promise<void> {
    const latest = await transaction.gitHubProgressReview.findFirst({
      where: { sourceEventId: input.sourceEventId },
      orderBy: { evaluationSequence: "desc" },
      select: { evaluationSequence: true },
    });
    const review = await transaction.gitHubProgressReview.create({
      data: {
        sourceEventId: input.sourceEventId,
        bindingId: input.bindingId,
        projectId: input.projectId,
        contractId: input.contractId,
        contractVersion: input.contractVersion,
        evaluationSequence: (latest?.evaluationSequence ?? 0) + 1,
        disposition: input.disposition,
      },
    });
    const contractId = input.contractId;
    const contractVersion = input.contractVersion;
    if (contractId !== null && contractVersion !== null && input.candidateRuleIds.length > 0) {
      await transaction.gitHubProgressReviewCandidate.createMany({
        data: input.candidateRuleIds.map((ruleId) => ({
          reviewId: review.id,
          ruleId,
          sourceEventId: input.sourceEventId,
          bindingId: input.bindingId,
          projectId: input.projectId,
          contractId,
          contractVersion,
        })),
      });
    }
  }

  private ownerReviewRequired(
    input: Readonly<{
      sourceEventId: string;
      projectId: string;
      disposition: "no_match" | "ambiguous";
      candidateRuleIds: readonly string[];
    }>,
  ): GitHubSourceEvaluation {
    return {
      state: "owner_review_required",
      sourceEventId: input.sourceEventId,
      projectId: input.projectId,
      disposition: input.disposition,
      candidateRuleIds: input.candidateRuleIds,
    };
  }

  private async transition(
    command: unknown,
    fromState: "draft" | "pending_approval",
    toState: "pending_approval" | "active" | "rejected",
  ): Promise<import("@evaluation/contracts").ProgressContract> {
    const parsed = DecisionCommandSchema.parse(command);
    const now = validProgressClock(this.clock);
    return this.client.$transaction(
      async (transaction) => {
        await transaction.$queryRaw`
          SELECT id FROM "ProgressContract"
          WHERE id = ${parsed.contractId}::uuid
          FOR UPDATE
        `;
        const current = await transaction.progressContract.findUnique({
          where: { id: parsed.contractId },
          include: { components: { orderBy: { position: "asc" } } },
        });
        if (current === null)
          throw new AppError(
            "PROGRESS_CONTRACT_NOT_FOUND",
            "errors.progressContract.notFound",
            404,
          );
        if (current.projectId !== parsed.projectId)
          throw new AppError("SCOPE_MISMATCH", "errors.authorization.scopeMismatch", 403);
        const resourceId = current.workstreamId ?? current.projectId;
        const identity = await this.identityReader.snapshotIn(transaction, {
          kind: current.scopeKind,
          resourceId,
          at: now,
        });
        if (
          identity === null ||
          identity.kind !== current.scopeKind ||
          identity.resourceId !== resourceId ||
          identity.projectId !== current.projectId ||
          identity.primaryOwnerId !== parsed.actor.userId
        )
          throw new AppError("PROGRESS_CONTRACT_FORBIDDEN", "errors.common.forbidden", 403);
        if (current.state !== fromState)
          throw new AppError(
            "PROGRESS_CONTRACT_STATE_INVALID",
            "errors.progressContract.stateInvalid",
            409,
          );
        if (current.version !== parsed.input.expectedVersion)
          throw new AppError(
            "PROGRESS_CONTRACT_VERSION_CONFLICT",
            "errors.progressContract.versionConflict",
            409,
          );

        if (toState === "active" && current.previousContractId !== null) {
          await supersedePrevious(
            transaction,
            current.previousContractId,
            parsed.actor.userId,
            parsed.input.reason,
            now,
          );
        }
        const resultingVersion = current.version + 1;
        const updated = await transaction.progressContract.update({
          where: { id: current.id },
          data: {
            state: toState,
            version: { increment: 1 },
            ...(toState === "active" ? { approverId: parsed.actor.userId, approvedAt: now } : {}),
          },
          include: { components: { orderBy: { position: "asc" } } },
        });
        await transaction.progressContractTransition.create({
          data: {
            contractId: current.id,
            fromState,
            toState,
            actorId: parsed.actor.userId,
            reason: parsed.input.reason,
            resultingVersion,
          },
        });
        await this.auditWriter.append(transaction, {
          eventType: `progress_contract.${toState}`,
          actor: { kind: "human", id: parsed.actor.userId },
          effectiveSubjectId: parsed.actor.userId,
          scopeType: current.scopeKind,
          scopeId: current.workstreamId ?? current.projectId,
          targetType: "progress_contract",
          targetId: current.id,
          reason: parsed.input.reason,
          safeDiff: {
            fromState,
            toState,
            version: resultingVersion,
            contractVersion: current.contractVersion,
            sourceDocumentVersion: current.sourceDocumentVersionNo,
          },
          correlationId: parsed.correlationId,
          source: "api",
        });
        return serializeProgressContract(updated);
      },
      { isolationLevel: "Serializable" },
    );
  }
}

export function createProgressContractService(
  client: DatabaseClient,
  documentReader: ProgressDocumentSourceReader,
  identityReader: Pick<import("./criteria-review-reader.js").CriteriaReviewReader, "snapshotIn">,
  writer: AuditWriter<Transaction> = databaseAuditWriter as AuditWriter<Transaction>,
  clock: () => Date = () => new Date(),
): ProgressContractService {
  return new ProgressContractService(
    client,
    writer,
    documentReader,
    identityReader,
    clock,
    new DatabaseGitHubGovernedSourceReader(client),
  );
}
