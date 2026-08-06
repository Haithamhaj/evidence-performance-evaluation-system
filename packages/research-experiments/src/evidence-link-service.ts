import { AppError, LinkResearchEvidenceInputSchema } from "@evaluation/contracts";
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
  type ResearchAuditWriter,
  type ResearchScopeAuthorizer,
} from "./decision-service.js";

type EvidenceReader = Readonly<{
  getConfirmedEvidence(
    input: Readonly<{
      actor: import("./decision-service.js").ResearchActor;
      evidenceId: string;
      projectId: string;
    }>,
  ): Promise<
    Readonly<{
      evidenceId: string;
      evidenceRevisionId: string;
      projectId: string;
      [key: string]: unknown;
    }>
  >;
}>;

type Dependencies = Readonly<{
  database: DatabaseClient;
  authorizer: ResearchScopeAuthorizer;
  auditWriter: ResearchAuditWriter;
  evidenceReader: EvidenceReader;
  clock?: () => Date;
}>;

export class ResearchEvidenceLinkService {
  readonly #database: DatabaseClient;
  readonly #authorizer: ResearchScopeAuthorizer;
  readonly #auditWriter: ResearchAuditWriter;
  readonly #evidenceReader: EvidenceReader;
  readonly #clock: () => Date;

  constructor(dependencies: Dependencies) {
    this.#database = dependencies.database;
    this.#authorizer = dependencies.authorizer;
    this.#auditWriter = dependencies.auditWriter;
    this.#evidenceReader = dependencies.evidenceReader;
    this.#clock = dependencies.clock ?? (() => new Date());
  }

  async link(
    command: Readonly<{
      actor: import("./decision-service.js").ResearchActor;
      correlationId: string;
      researchId: string;
      input: import("@evaluation/contracts").LinkResearchEvidenceInput;
    }>,
  ): Promise<ResearchEvidenceLinkResult> {
    const input = LinkResearchEvidenceInputSchema.parse(command.input);
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
    const evidence = await this.#evidenceReader.getConfirmedEvidence({
      actor: command.actor,
      evidenceId: input.evidenceId,
      projectId: initial.projectId,
    });
    if (
      evidence.projectId !== initial.projectId ||
      evidence.evidenceId !== input.evidenceId ||
      evidence.evidenceRevisionId !== input.evidenceRevisionId
    ) {
      throw evidenceInvalid();
    }

    return this.#database.$transaction(async (transaction) => {
      const root = await lockOwnedResearch(transaction, command.researchId, command.actor, at);
      assertVersion(root.version, input.expectedVersion);
      if (["CANCELLED", "SUPERSEDED"].includes(root.state)) throw evidenceInvalid();
      await this.#authorizer.authorizeTransaction(transaction, {
        actor: command.actor,
        scope: scopeOf(root),
        at,
      });
      await validateEvidenceLineage(transaction, root.id, input);
      const link = await transaction.researchEvidenceLink.create({
        data: {
          researchId: root.id,
          evidenceId: input.evidenceId,
          evidenceRevisionId: input.evidenceRevisionId,
          supportedClaim: input.supportedClaim,
          experimentId: input.experimentId,
          experimentRunId: input.experimentRunId,
          experimentConclusionId: input.experimentConclusionId,
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
        researchAudit(command, root.projectId, root.id, "research.evidence_link_confirmed", {
          researchEvidenceLinkId: link.id,
          evidenceId: link.evidenceId,
          evidenceRevisionId: link.evidenceRevisionId,
          experimentId: link.experimentId,
          experimentRunId: link.experimentRunId,
          experimentConclusionId: link.experimentConclusionId,
          version: root.version + 1,
        }),
      );
      return link;
    }, SERIALIZABLE);
  }
}

async function validateEvidenceLineage(
  transaction: import("./decision-service.js").ResearchTransaction,
  researchId: string,
  input: import("@evaluation/contracts").LinkResearchEvidenceInput,
) {
  if (input.experimentId === null) {
    if (input.experimentRunId !== null || input.experimentConclusionId !== null) {
      throw evidenceInvalid();
    }
    return;
  }
  const experiment = await transaction.experiment.findFirst({
    where: { id: input.experimentId, researchId },
    select: { id: true },
  });
  if (experiment === null) throw evidenceInvalid();
  if (input.experimentRunId !== null) {
    const run = await transaction.experimentRun.findFirst({
      where: { id: input.experimentRunId, experimentId: experiment.id },
      select: { id: true },
    });
    if (run === null) throw evidenceInvalid();
  }
  if (input.experimentConclusionId !== null) {
    const conclusion = await transaction.experimentConclusion.findFirst({
      where: { id: input.experimentConclusionId, experimentId: experiment.id },
      select: { id: true },
    });
    if (conclusion === null) throw evidenceInvalid();
  }
}

export type ResearchEvidenceLinkResult = Readonly<{
  id: string;
  researchId: string;
  evidenceId: string;
  evidenceRevisionId: string;
  supportedClaim: string;
  experimentId: string | null;
  experimentRunId: string | null;
  experimentConclusionId: string | null;
  confirmerId: string;
  confirmedAt: Date;
  createdAt: Date;
}>;

function validInstant(at: Date) {
  if (!Number.isFinite(at.getTime())) throw forbidden();
  return at;
}

function evidenceInvalid(): AppError {
  return new AppError("RESEARCH_EVIDENCE_INVALID", "errors.research.evidenceInvalid", 409);
}
