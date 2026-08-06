import { AnalysisSourceReferenceSchema, AppError } from "@evaluation/contracts";

type Actor = Readonly<{ userId: string; active: boolean }>;

export type ResearchProspectiveProposalReference = Readonly<{
  proposalId: string;
  projectId: string;
  workstreamId: string | null;
  kind: "project" | "workstream";
  proposalNumber: number;
  version: number;
  state: "approved";
  sourceDocumentVersionId: string;
  approvedAt: string;
  sourceReference: string;
}>;

type ScopeAuthorizer = Readonly<{
  authorize(
    input: Readonly<{
      actor: Actor;
      scope: import("@evaluation/contracts").ResearchScope;
      at: Date;
    }>,
  ): Promise<unknown>;
}>;

export class ResearchCriterionProposalReader {
  private readonly database: import("@evaluation/database").DatabaseClient;
  private readonly scopes: ScopeAuthorizer;
  private readonly clock: () => Date;

  constructor(
    database: import("@evaluation/database").DatabaseClient,
    scopes: ScopeAuthorizer,
    clock: () => Date = () => new Date(),
  ) {
    this.database = database;
    this.scopes = scopes;
    this.clock = clock;
  }

  async getProspectiveCriterionProposal(
    input: Readonly<{
      actor: Actor;
      proposalId: string;
      projectId: string;
    }>,
  ): Promise<ResearchProspectiveProposalReference> {
    const proposal = await this.database.dynamicCriteriaProposal.findUnique({
      where: { id: input.proposalId },
      select: {
        id: true,
        kind: true,
        projectId: true,
        workstreamId: true,
        workstream: { select: { projectId: true } },
        sourceDocumentVersionId: true,
        proposalNumber: true,
        version: true,
        state: true,
        approvedAt: true,
      },
    });
    const proposalProjectId = proposal?.projectId ?? proposal?.workstream?.projectId ?? null;
    if (
      proposal === null ||
      proposalProjectId !== input.projectId ||
      proposal.state !== "approved" ||
      proposal.approvedAt === null
    ) {
      throw invalidProposal();
    }
    const at = this.clock();
    if (!Number.isFinite(at.getTime())) throw invalidProposal();
    await this.scopes.authorize({
      actor: input.actor,
      scope: {
        projectId: input.projectId,
        workstreamId: proposal.workstreamId,
        workItemId: null,
      },
      at,
    });
    return {
      proposalId: proposal.id,
      projectId: input.projectId,
      workstreamId: proposal.workstreamId,
      kind: proposal.kind,
      proposalNumber: proposal.proposalNumber,
      version: proposal.version,
      state: proposal.state,
      sourceDocumentVersionId: proposal.sourceDocumentVersionId,
      approvedAt: proposal.approvedAt.toISOString(),
      sourceReference: AnalysisSourceReferenceSchema.parse(`criterion-proposal:${proposal.id}`),
    };
  }
}

function invalidProposal(): AppError {
  return new AppError(
    "RESEARCH_CRITERION_PROPOSAL_INVALID",
    "errors.research.criterionProposalInvalid",
    409,
  );
}
