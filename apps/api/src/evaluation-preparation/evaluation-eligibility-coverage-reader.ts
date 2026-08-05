import { SourceCoverageNoteSchema } from "@evaluation/contracts";

type DatabaseClient = import("@evaluation/database").DatabaseClient;

export class EvaluationEligibilityCoverageReader {
  private readonly database: DatabaseClient;

  constructor(database: DatabaseClient) {
    this.database = database;
  }

  async readAuthorizedFacts(
    input: import("@evaluation/evaluation-preparation").EvaluationSourceReadInput,
  ) {
    const entry = await this.database.eligibilityEntry.findUnique({
      where: {
        cycleId_employeeId: {
          cycleId: input.cycleId,
          employeeId: input.subjectEmployeeId,
        },
      },
      select: { state: true },
    });
    if (entry?.state !== "approved_leave") return { sourceCoverageNotes: [] };
    return {
      sourceCoverageNotes: [
        SourceCoverageNoteSchema.parse({
          kind: "coverage_note",
          code: "approved_leave_excluded",
          scope: "cycle",
          projectId: null,
          workstreamId: null,
          messageKey: "evaluationFacts.coverage.approvedLeaveExcluded",
          sourceFactIds: [],
          neutral: true,
        }),
      ],
    };
  }
}
