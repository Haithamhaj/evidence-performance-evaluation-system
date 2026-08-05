import { ConfirmedEvidenceFactSchema, ProjectContributionFactSchema } from "@evaluation/contracts";

type DatabaseClient = import("@evaluation/database").DatabaseClient;
type EvaluationSourceReadInput = Readonly<{
  subjectEmployeeId: string;
  cycleStart: string;
  cycleEnd: string;
}>;

export class UpdateEvidenceEvaluationFactReader {
  private readonly database: DatabaseClient;

  constructor(database: DatabaseClient) {
    this.database = database;
  }

  async readAuthorizedFacts(input: EvaluationSourceReadInput): Promise<
    Readonly<{
      projectFacts: readonly import("@evaluation/contracts").ProjectContributionFact[];
      confirmedEvidence: readonly import("@evaluation/contracts").ConfirmedEvidenceFact[];
    }>
  > {
    const range = { gte: new Date(input.cycleStart), lte: new Date(input.cycleEnd) };
    const [updates, evidence] = await Promise.all([
      this.database.acceptedUpdateEvent.findMany({
        where: { employeeId: input.subjectEmployeeId, occurredAt: range },
        orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          projectId: true,
          workstreamId: true,
          workItemId: true,
          occurredAt: true,
          sourceReferences: true,
          confirmation: {
            select: {
              draftRevision: {
                select: { revision: true, summary: true, result: true },
              },
            },
          },
        },
      }),
      this.database.acceptedEvidenceEvent.findMany({
        where: {
          evidence: { employeeId: input.subjectEmployeeId },
          occurredAt: range,
        },
        orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          evidenceId: true,
          projectId: true,
          workstreamId: true,
          occurredAt: true,
          sourceReferences: true,
          evidence: { select: { workItemId: true } },
          confirmation: {
            select: {
              evidenceRevision: {
                select: {
                  id: true,
                  revision: true,
                  supportedClaim: true,
                  contributionContext: true,
                  links: {
                    select: {
                      dynamicCriterion: {
                        select: {
                          position: true,
                          criteriaSet: { select: { projectId: true, workstreamId: true } },
                        },
                      },
                    },
                  },
                  verifications: {
                    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                    take: 1,
                    select: { outcome: true },
                  },
                  attributions: {
                    where: { employeeId: input.subjectEmployeeId },
                    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                    select: { employeeId: true, state: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      projectFacts: updates.map((event) => {
        const revision = event.confirmation.draftRevision;
        return ProjectContributionFactSchema.parse({
          kind: "source_fact",
          sourceType: "project_contribution",
          sourceId: event.id,
          sourceOccurredAt: event.occurredAt.toISOString(),
          projectId: event.projectId,
          workstreamId: event.workstreamId,
          relatedWorkItemId: event.workItemId,
          criterionStableId: null,
          criterionVersionId: null,
          summary: revision.summary,
          result: revision.result || null,
          verificationState: "self_reported",
          attributionState: "employee_confirmed",
          responsibilityWindowIds: [],
          sourceReferences: [timelineReference(event.id, revision.revision, event.occurredAt)],
        });
      }),
      confirmedEvidence: evidence.map((event) => {
        const revision = event.confirmation.evidenceRevision;
        const criterion = revision.links.find(
          ({ dynamicCriterion }) => dynamicCriterion !== null,
        )?.dynamicCriterion;
        return ConfirmedEvidenceFactSchema.parse({
          kind: "source_fact",
          sourceType: "confirmed_evidence",
          sourceId: event.id,
          sourceOccurredAt: event.occurredAt.toISOString(),
          projectId: event.projectId,
          workstreamId: event.workstreamId,
          relatedWorkItemId: event.evidence.workItemId,
          relatedCriterionStableId: criterion == null ? null : criterionStableId(criterion),
          supportedClaim: revision.supportedClaim,
          contributionContext: revision.contributionContext,
          verificationState: mapVerification(revision.verifications[0]?.outcome),
          attributionState: revision.attributions.some(({ state }) => state === "disputed")
            ? "disputed"
            : "employee_confirmed",
          sourceReferences: [evidenceReference(event.id, revision.revision, event.occurredAt)],
        });
      }),
    };
  }
}

function timelineReference(sourceId: string, version: number, occurredAt: Date) {
  return {
    sourceType: "timeline_event" as const,
    sourceId,
    sourceVersion: version,
    occurredAt: occurredAt.toISOString(),
    url: null,
  };
}

function evidenceReference(sourceId: string, version: number, occurredAt: Date) {
  return {
    sourceType: "evidence" as const,
    sourceId,
    sourceVersion: version,
    occurredAt: occurredAt.toISOString(),
    url: null,
  };
}

function mapVerification(
  outcome:
    "unverified" | "pending" | "supported" | "partial" | "conflicting" | "rejected" | undefined,
): import("@evaluation/contracts").ConfirmedEvidenceFact["verificationState"] {
  if (outcome === "supported") return "source_supported";
  if (outcome === "partial") return "partially_supported";
  if (outcome === "conflicting" || outcome === "rejected") return "conflicting";
  return "unable_to_verify";
}

function criterionStableId(
  criterion: Readonly<{
    position: number;
    criteriaSet: { projectId: string | null; workstreamId: string | null };
  }>,
): string {
  const scope = criterion.criteriaSet.workstreamId === null ? "project" : "workstream";
  const resourceId = criterion.criteriaSet.workstreamId ?? criterion.criteriaSet.projectId;
  if (resourceId === null) throw new Error("Dynamic criterion has no resource scope");
  return `${scope}:${resourceId}:position:${criterion.position}`;
}
