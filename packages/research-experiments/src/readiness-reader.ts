type DatabaseClient = import("@evaluation/database").DatabaseClient;

export type ResearchReadinessActionCode =
  | "RESEARCH_QUESTION_MISSING"
  | "EXPERIMENT_METHOD_INCOMPLETE"
  | "RUN_INTERPRETATION_MISSING"
  | "EXPERIMENT_CONCLUSION_MISSING"
  | "RESEARCH_DECISION_MISSING"
  | "APPLIED_LEARNING_UNLINKED"
  | "EVIDENCE_ATTRIBUTION_UNRESOLVED";

export type ResearchReadinessGap = Readonly<{
  actionCode: ResearchReadinessActionCode;
  projectId: string;
  workstreamId: string | null;
  workItemId: string | null;
  researchId: string;
  experimentId: string | null;
}>;

/** Employee-only, non-scoring readiness hints derived from confirmed Research lifecycle state. */
export class ResearchReadinessReader {
  readonly #database: DatabaseClient;

  constructor(database: DatabaseClient) {
    this.#database = database;
  }

  async readEmployeeProjectGaps(
    input: Readonly<{
      employeeId: string;
      projectId: string;
      startsAt: string;
      endsAt: string;
    }>,
  ): Promise<ResearchReadinessGap[]> {
    const research = await (this.#database as any).researchRecord.findMany({
      where: {
        projectId: input.projectId,
        state: { notIn: ["DRAFT", "CANCELLED", "SUPERSEDED"] },
        OR: [
          { ownerId: input.employeeId },
          { participantEvents: { some: { employeeId: input.employeeId, action: "STARTED" } } },
        ],
        createdAt: { lt: new Date(input.endsAt) },
      },
      include: {
        revisions: { where: { origin: "EMPLOYEE" }, orderBy: { revision: "desc" }, take: 1 },
        experiments: {
          where: { state: { notIn: ["ABANDONED", "SUPERSEDED"] } },
          include: {
            methodRevisions: { orderBy: { revision: "desc" }, take: 1 },
            runs: true,
            conclusions: true,
          },
        },
        researchConclusions: true,
        appliedLearning: true,
      },
    });
    const gaps: ResearchReadinessGap[] = [];
    for (const root of research as any[]) {
      const base = {
        projectId: root.projectId,
        workstreamId: root.workstreamId ?? null,
        workItemId: root.workItemId ?? null,
        researchId: root.id,
      };
      if (!root.revisions[0]?.question?.trim()) {
        gaps.push({ ...base, experimentId: null, actionCode: "RESEARCH_QUESTION_MISSING" });
      }
      for (const experiment of root.experiments as any[]) {
        const experimentBase = {
          ...base,
          workstreamId: experiment.workstreamId ?? base.workstreamId,
          workItemId: experiment.workItemId ?? base.workItemId,
          experimentId: experiment.id,
        };
        if (experiment.state === "DRAFT" || experiment.methodRevisions.length === 0) {
          gaps.push({ ...experimentBase, actionCode: "EXPERIMENT_METHOD_INCOMPLETE" });
        }
        if (experiment.runs.length > 0 && experiment.conclusions.length === 0) {
          gaps.push({ ...experimentBase, actionCode: "RUN_INTERPRETATION_MISSING" });
        }
        if (experiment.state === "RESULT_RECORDED" && experiment.conclusions.length === 0) {
          gaps.push({ ...experimentBase, actionCode: "EXPERIMENT_CONCLUSION_MISSING" });
        }
      }
      if (root.state === "ACTIVE" && root.researchConclusions.length === 0) {
        gaps.push({ ...base, experimentId: null, actionCode: "RESEARCH_DECISION_MISSING" });
      }
      if (root.researchConclusions.length > 0 && root.appliedLearning.length === 0) {
        gaps.push({ ...base, experimentId: null, actionCode: "APPLIED_LEARNING_UNLINKED" });
      }
    }
    return uniqueGaps(gaps);
  }
}

function uniqueGaps(gaps: readonly ResearchReadinessGap[]): ResearchReadinessGap[] {
  return [
    ...new Map(
      gaps.map((gap) => [`${gap.actionCode}:${gap.researchId}:${gap.experimentId ?? ""}`, gap]),
    ).values(),
  ];
}
