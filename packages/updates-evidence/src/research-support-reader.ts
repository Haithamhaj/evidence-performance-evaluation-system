import { AnalysisSourceReferenceSchema, AppError } from "@evaluation/contracts";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type Transaction = import("@evaluation/database").DatabaseTransaction;
type Actor = Readonly<{ userId: string; active: boolean }>;

export type ConfirmedResearchEvidenceReference = Readonly<{
  evidenceId: string;
  evidenceRevisionId: string;
  evidenceRevision: number;
  projectId: string;
  workstreamId: string | null;
  workItemId: string | null;
  sourceKind: string;
  supportedClaim: string;
  confirmedAt: string;
  sourceReferences: readonly string[];
}>;

type ResearchEvidenceScopeReader = Readonly<{
  authorizeIn(
    transaction: Transaction,
    input: Readonly<{
      actor: Actor;
      projectId: string;
      workstreamId: string | null;
      workItemId: string | null;
      progressComponentId: null;
      dynamicCriterionId: null;
      at: Date;
    }>,
  ): Promise<void>;
}>;

export class ConfirmedResearchEvidenceReader {
  private readonly database: DatabaseClient;
  private readonly scopes: ResearchEvidenceScopeReader;
  private readonly clock: () => Date;

  constructor(
    database: DatabaseClient,
    scopes: ResearchEvidenceScopeReader,
    clock: () => Date = () => new Date(),
  ) {
    this.database = database;
    this.scopes = scopes;
    this.clock = clock;
  }

  async getConfirmedEvidence(
    input: Readonly<{
      actor: Actor;
      evidenceId: string;
      projectId: string;
    }>,
  ): Promise<ConfirmedResearchEvidenceReference> {
    const at = this.clock();
    if (!Number.isFinite(at.getTime())) throw notConfirmed();
    return this.database.$transaction(async (transaction) => {
      if (!input.actor.active) throw forbidden();
      const user = await transaction.user.findUnique({
        where: { id: input.actor.userId },
        select: { active: true },
      });
      if (user?.active !== true) throw forbidden();
      const event = await transaction.acceptedEvidenceEvent.findFirst({
        where: {
          evidenceId: input.evidenceId,
          projectId: input.projectId,
          evidence: { state: "confirmed" },
        },
        select: {
          evidenceId: true,
          projectId: true,
          workstreamId: true,
          sourceReferences: true,
          occurredAt: true,
          evidence: { select: { workItemId: true } },
          confirmation: {
            select: {
              evidenceRevision: {
                select: {
                  id: true,
                  revision: true,
                  sourceKind: true,
                  supportedClaim: true,
                },
              },
            },
          },
        },
      });
      if (event === null) throw notConfirmed();
      try {
        await this.scopes.authorizeIn(transaction, {
          actor: input.actor,
          projectId: event.projectId,
          workstreamId: event.workstreamId,
          workItemId: event.evidence.workItemId,
          progressComponentId: null,
          dynamicCriterionId: null,
          at,
        });
      } catch (error) {
        if (error instanceof AppError && error.status === 403) throw forbidden();
        throw error;
      }
      const revision = event.confirmation.evidenceRevision;
      return {
        evidenceId: event.evidenceId,
        evidenceRevisionId: revision.id,
        evidenceRevision: revision.revision,
        projectId: event.projectId,
        workstreamId: event.workstreamId,
        workItemId: event.evidence.workItemId,
        sourceKind: revision.sourceKind,
        supportedClaim: revision.supportedClaim,
        confirmedAt: event.occurredAt.toISOString(),
        sourceReferences: sourceReferences(event.sourceReferences),
      };
    });
  }
}

function sourceReferences(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => AnalysisSourceReferenceSchema.parse(item));
}

function notConfirmed(): AppError {
  return new AppError(
    "RESEARCH_EVIDENCE_NOT_CONFIRMED",
    "errors.research.evidenceNotConfirmed",
    409,
  );
}

function forbidden(): AppError {
  return new AppError("RESEARCH_SCOPE_FORBIDDEN", "errors.research.scopeForbidden", 403);
}
