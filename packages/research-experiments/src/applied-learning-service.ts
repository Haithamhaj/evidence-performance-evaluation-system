import {
  AppError,
  CreateAppliedLearningInputSchema,
  type CreateAppliedLearningInput,
} from "@evaluation/contracts";
import type { DatabaseClient } from "@evaluation/database";

import {
  SERIALIZABLE,
  assertHumanOwner,
  assertVersion,
  forbidden,
  lockOwnedResearch,
  researchAudit,
  scopeOf,
  updateResearchVersion,
  type ResearchActor,
  type ResearchAuditWriter,
  type ResearchScopeAuthorizer,
} from "./decision-service.js";

type ProjectReference = Readonly<{ projectId: string }>;
type TargetReaders = Readonly<{
  workItem?: Readonly<{
    authorizeProjectItem(
      input: Readonly<{
        actor: ResearchActor;
        projectId: string;
        workItemId: string;
        at: Date;
      }>,
    ): Promise<ProjectReference & Readonly<{ id: string }>>;
  }>;
  update?: Readonly<{
    getConfirmedUpdate(
      input: Readonly<{
        actor: ResearchActor;
        projectId: string;
        updateId: string;
      }>,
    ): Promise<ProjectReference & Readonly<{ id: string }>>;
  }>;
  document?: Readonly<{
    readApprovedVersion(
      input: Readonly<{
        actor: ResearchActor;
        projectId: string;
        documentVersionId: string;
      }>,
    ): Promise<ProjectReference & Readonly<{ documentVersionId: string }>>;
  }>;
  progressContractProposal?: Readonly<{
    getProspectiveProgressProposal(
      input: Readonly<{
        actor: ResearchActor;
        projectId: string;
        proposalId: string;
      }>,
    ): Promise<ProjectReference & Readonly<{ proposalId: string }>>;
  }>;
  criterionProposal?: Readonly<{
    getProspectiveCriterionProposal(
      input: Readonly<{
        actor: ResearchActor;
        projectId: string;
        proposalId: string;
      }>,
    ): Promise<ProjectReference & Readonly<{ proposalId: string }>>;
  }>;
}>;

type Dependencies = Readonly<{
  database: DatabaseClient;
  authorizer: ResearchScopeAuthorizer;
  auditWriter: ResearchAuditWriter;
  targetReaders: TargetReaders;
  clock?: () => Date;
}>;

type Command = Readonly<{
  actor: ResearchActor;
  correlationId: string;
  researchId: string;
  input: CreateAppliedLearningInput;
}>;

export type AppliedLearningResult = Readonly<{
  id: string;
  researchId: string;
  researchConclusionId: string;
  targetKind: CreateAppliedLearningInput["target"]["kind"];
  targetId: string;
  targetResearchId: string | null;
  targetExperimentId: string | null;
  documentVersionId: string | null;
  whatChanged: string;
  causalRationale: string;
  confirmerId: string;
  confirmedAt: Date;
  createdAt: Date;
}>;

export class AppliedLearningService {
  readonly #database: DatabaseClient;
  readonly #authorizer: ResearchScopeAuthorizer;
  readonly #auditWriter: ResearchAuditWriter;
  readonly #targetReaders: TargetReaders;
  readonly #clock: () => Date;

  constructor(dependencies: Dependencies) {
    this.#database = dependencies.database;
    this.#authorizer = dependencies.authorizer;
    this.#auditWriter = dependencies.auditWriter;
    this.#targetReaders = dependencies.targetReaders;
    this.#clock = dependencies.clock ?? (() => new Date());
  }

  async create(command: Command): Promise<AppliedLearningResult> {
    const input = CreateAppliedLearningInputSchema.parse(command.input);
    const at = validInstant(this.#clock());
    const initial = await this.#database.researchRecord.findUnique({
      where: { id: command.researchId },
      select: {
        projectId: true,
        workstreamId: true,
        workItemId: true,
        ownerId: true,
      },
    });
    if (initial === null) throw forbidden();
    assertHumanOwner(command.actor, initial.ownerId);
    await this.#authorizer.authorize({ actor: command.actor, scope: scopeOf(initial), at });
    const externalTarget = await this.#validateExternalTarget(
      command.actor,
      initial.projectId,
      input.target,
      at,
    );

    return this.#database.$transaction(async (transaction) => {
      const root = await lockOwnedResearch(transaction, command.researchId, command.actor, at);
      assertVersion(root.version, input.expectedVersion);
      if (["CANCELLED", "SUPERSEDED"].includes(root.state)) throw appliedTargetInvalid();
      await this.#authorizer.authorizeTransaction(transaction, {
        actor: command.actor,
        scope: scopeOf(root),
        at,
      });
      const conclusion = await transaction.researchConclusion.findFirst({
        where: { id: input.researchConclusionId, researchId: root.id },
        select: { id: true },
      });
      if (conclusion === null) throw appliedTargetInvalid();
      await validateLocalOrExternalTarget(
        transaction,
        root.projectId,
        input.target,
        externalTarget,
      );
      const targetId =
        input.target.kind === "KNOWLEDGE_TRANSFER"
          ? input.target.documentVersionId
          : input.target.id;
      const learning = await transaction.appliedLearning.create({
        data: {
          researchId: root.id,
          researchConclusionId: conclusion.id,
          targetKind: input.target.kind,
          targetId,
          targetResearchId: input.target.kind === "RESEARCH" ? targetId : null,
          targetExperimentId: input.target.kind === "EXPERIMENT" ? targetId : null,
          documentVersionId:
            input.target.kind === "DOCUMENT_VERSION" || input.target.kind === "KNOWLEDGE_TRANSFER"
              ? targetId
              : null,
          whatChanged: input.whatChanged,
          causalRationale: input.causalRationale,
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
        researchAudit(command, root.projectId, root.id, "research.applied_learning_confirmed", {
          appliedLearningId: learning.id,
          researchConclusionId: conclusion.id,
          targetKind: input.target.kind,
          targetId,
          version: root.version + 1,
        }),
      );
      return learning;
    }, SERIALIZABLE);
  }

  async #validateExternalTarget(
    actor: ResearchActor,
    projectId: string,
    target: CreateAppliedLearningInput["target"],
    at: Date,
  ): Promise<ProjectReference | null> {
    let reference: ProjectReference | null = null;
    switch (target.kind) {
      case "WORK_ITEM":
        reference =
          (await this.#targetReaders.workItem?.authorizeProjectItem({
            actor,
            projectId,
            workItemId: target.id,
            at,
          })) ?? null;
        break;
      case "UPDATE":
        reference =
          (await this.#targetReaders.update?.getConfirmedUpdate({
            actor,
            projectId,
            updateId: target.id,
          })) ?? null;
        break;
      case "DOCUMENT_VERSION":
      case "KNOWLEDGE_TRANSFER": {
        const documentVersionId =
          target.kind === "KNOWLEDGE_TRANSFER" ? target.documentVersionId : target.id;
        reference =
          (await this.#targetReaders.document?.readApprovedVersion({
            actor,
            projectId,
            documentVersionId,
          })) ?? null;
        break;
      }
      case "PROGRESS_CONTRACT_PROPOSAL":
        reference =
          (await this.#targetReaders.progressContractProposal?.getProspectiveProgressProposal({
            actor,
            projectId,
            proposalId: target.id,
          })) ?? null;
        break;
      case "CRITERION_PROPOSAL":
        reference =
          (await this.#targetReaders.criterionProposal?.getProspectiveCriterionProposal({
            actor,
            projectId,
            proposalId: target.id,
          })) ?? null;
        break;
      case "RESEARCH":
      case "EXPERIMENT":
        return null;
    }
    if (reference === null || reference.projectId !== projectId) throw appliedTargetInvalid();
    return reference;
  }
}

async function validateLocalOrExternalTarget(
  transaction: import("./decision-service.js").ResearchTransaction,
  projectId: string,
  target: CreateAppliedLearningInput["target"],
  external: ProjectReference | null,
) {
  if (target.kind === "RESEARCH") {
    const row = await transaction.researchRecord.findFirst({
      where: { id: target.id, projectId },
      select: { id: true },
    });
    if (row === null) throw appliedTargetInvalid();
    return;
  }
  if (target.kind === "EXPERIMENT") {
    const row = await transaction.experiment.findFirst({
      where: { id: target.id, research: { projectId } },
      select: { id: true },
    });
    if (row === null) throw appliedTargetInvalid();
    return;
  }
  if (external?.projectId !== projectId) throw appliedTargetInvalid();
}

function validInstant(at: Date) {
  if (!Number.isFinite(at.getTime())) throw forbidden();
  return at;
}

function appliedTargetInvalid(): AppError {
  return new AppError(
    "RESEARCH_APPLIED_TARGET_INVALID",
    "errors.research.appliedTargetInvalid",
    409,
  );
}
