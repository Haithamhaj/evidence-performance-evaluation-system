import {
  AppError,
  CreateWorkItemInputSchema,
  type CreateWorkItemInput,
} from "@evaluation/contracts";
import type { DatabaseClient } from "@evaluation/database";

import {
  SERIALIZABLE,
  assertHumanOwner,
  assertVersion,
  forbidden,
  lockOwnedResearch,
  researchAudit,
  updateResearchVersion,
  type ResearchActor,
  type ResearchAuditWriter,
  type ResearchScopeAuthorizer,
} from "./decision-service.js";

type ConfirmedTaskCreator = Readonly<{
  createConfirmedTask(
    transaction: import("./decision-service.js").ResearchTransaction,
    input: Readonly<{
      actor: ResearchActor;
      correlationId: string;
      workItemId: string;
      input: CreateWorkItemInput;
      reason: string;
    }>,
  ): Promise<Readonly<{ id: string; projectId: string; [key: string]: unknown }>>;
}>;

type Dependencies = Readonly<{
  database: DatabaseClient;
  authorizer: ResearchScopeAuthorizer;
  auditWriter: ResearchAuditWriter;
  confirmedTaskCreator: ConfirmedTaskCreator;
  clock?: () => Date;
}>;

type Command = Readonly<{
  actor: ResearchActor;
  correlationId: string;
  proposalId: string;
  expectedVersion: number;
  researchId: string;
  researchConclusionId: string;
  researchExpectedVersion: number;
  editedTask: CreateWorkItemInput;
  reason: string;
  whatChanged: string;
  causalRationale: string;
}>;

export class ResearchProposalConfirmationService {
  readonly #database: DatabaseClient;
  readonly #authorizer: ResearchScopeAuthorizer;
  readonly #auditWriter: ResearchAuditWriter;
  readonly #confirmedTaskCreator: ConfirmedTaskCreator;
  readonly #clock: () => Date;

  constructor(dependencies: Dependencies) {
    this.#database = dependencies.database;
    this.#authorizer = dependencies.authorizer;
    this.#auditWriter = dependencies.auditWriter;
    this.#confirmedTaskCreator = dependencies.confirmedTaskCreator;
    this.#clock = dependencies.clock ?? (() => new Date());
  }

  async confirmWorkItemProposal(command: Command) {
    const editedTask = CreateWorkItemInputSchema.parse(command.editedTask);
    const reason = requiredText(command.reason, 1_000);
    const whatChanged = requiredText(command.whatChanged, 8_000);
    const causalRationale = requiredText(command.causalRationale, 8_000);
    if (!Number.isInteger(command.expectedVersion) || command.expectedVersion < 1) {
      throw proposalInvalid();
    }
    if (!Number.isInteger(command.researchExpectedVersion) || command.researchExpectedVersion < 1) {
      throw proposalInvalid();
    }
    const at = validInstant(this.#clock());
    const initial = await this.#database.researchProposal.findUnique({
      where: { id: command.proposalId },
      include: { review: true },
    });
    if (
      initial === null ||
      initial.kind !== "WORK_ITEM" ||
      initial.targetId === null ||
      initial.review.state !== "CONFIRMED" ||
      initial.review.ownerId !== command.actor.userId ||
      editedTask.projectId !== initial.review.projectId
    ) {
      throw proposalInvalid();
    }
    assertHumanOwner(command.actor, initial.review.ownerId);
    const scope = {
      projectId: initial.review.projectId,
      workstreamId: editedTask.workstreamId,
      workItemId: null,
    };
    await this.#authorizer.authorize({ actor: command.actor, scope, at });

    return this.#database.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "ResearchProposal" WHERE "id" = ${command.proposalId}::uuid FOR UPDATE`;
      const proposal = await transaction.researchProposal.findUnique({
        where: { id: command.proposalId },
        include: { review: true, transitions: true },
      });
      if (
        proposal === null ||
        proposal.kind !== "WORK_ITEM" ||
        proposal.targetId === null ||
        proposal.review.state !== "CONFIRMED" ||
        proposal.review.ownerId !== command.actor.userId ||
        proposal.review.projectId !== editedTask.projectId
      ) {
        throw proposalInvalid();
      }
      await this.#authorizer.authorizeTransaction(transaction, {
        actor: command.actor,
        scope,
        at,
      });
      const root = await lockOwnedResearch(transaction, command.researchId, command.actor, at);
      if (root.projectId !== proposal.review.projectId || root.state !== "CONCLUDED") {
        throw proposalInvalid();
      }
      const conclusion = await transaction.researchConclusion.findFirst({
        where: { id: command.researchConclusionId, researchId: root.id },
        select: { id: true },
      });
      if (conclusion === null) throw proposalInvalid();

      if (proposal.state === "CONFIRMED") {
        const existingLearning = await transaction.appliedLearning.findFirst({
          where: {
            researchId: root.id,
            researchConclusionId: conclusion.id,
            targetKind: "WORK_ITEM",
            targetId: proposal.targetId,
            confirmerId: command.actor.userId,
          },
          select: { id: true },
        });
        if (existingLearning === null) throw proposalInvalid();
        return this.#createOrReplayTask(
          transaction,
          command,
          proposal.targetId,
          editedTask,
          reason,
        );
      }
      if (proposal.state !== "DRAFT") throw proposalInvalid();
      assertVersion(proposal.version, command.expectedVersion);
      assertVersion(root.version, command.researchExpectedVersion);

      const task = await this.#createOrReplayTask(
        transaction,
        command,
        proposal.targetId,
        editedTask,
        reason,
      );
      const updated = await transaction.researchProposal.updateMany({
        where: { id: proposal.id, state: "DRAFT", version: proposal.version },
        data: { state: "CONFIRMED", version: { increment: 1 }, updatedAt: at },
      });
      if (updated.count !== 1) throw proposalInvalid();
      await transaction.researchProposalTransition.create({
        data: {
          proposalId: proposal.id,
          kind: "CONFIRMED",
          reason,
          actorId: command.actor.userId,
          resultingVersion: proposal.version + 1,
          createdAt: at,
        },
      });
      const learning = await transaction.appliedLearning.create({
        data: {
          researchId: root.id,
          researchConclusionId: conclusion.id,
          targetKind: "WORK_ITEM",
          targetId: task.id,
          targetResearchId: null,
          targetExperimentId: null,
          documentVersionId: null,
          whatChanged,
          causalRationale,
          confirmerId: command.actor.userId,
          confirmedAt: at,
          createdAt: at,
        },
      });
      await updateResearchVersion(transaction, root.id, root.version, {
        version: { increment: 1 },
      });
      await this.#auditWriter.append(
        transaction,
        researchAudit(
          command,
          root.projectId,
          root.id,
          "research.work_item_proposal_confirmed",
          {
            proposalId: proposal.id,
            workItemId: task.id,
            appliedLearningId: learning.id,
            proposalVersion: proposal.version + 1,
            researchVersion: root.version + 1,
          },
          reason,
        ),
      );
      return task;
    }, SERIALIZABLE);
  }

  async #createOrReplayTask(
    transaction: import("./decision-service.js").ResearchTransaction,
    command: Command,
    workItemId: string,
    editedTask: CreateWorkItemInput,
    reason: string,
  ) {
    const task = await this.#confirmedTaskCreator.createConfirmedTask(transaction, {
      actor: command.actor,
      correlationId: command.correlationId,
      workItemId,
      input: editedTask,
      reason,
    });
    if (task.id !== workItemId || task.projectId !== editedTask.projectId) throw proposalInvalid();
    return task;
  }
}

function requiredText(value: string, maximum: number) {
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > maximum) throw proposalInvalid();
  return normalized;
}

function validInstant(at: Date) {
  if (!Number.isFinite(at.getTime())) throw forbidden();
  return at;
}

function proposalInvalid(): AppError {
  return new AppError("RESEARCH_PROPOSAL_INVALID", "errors.research.proposalInvalid", 409);
}
