import { describe, expect, it } from "vitest";

const cycle = {
  id: crypto.randomUUID(),
  startsAt: "2026-07-01T00:00:00.000Z",
  endsAt: "2026-09-30T23:59:59.999Z",
  rubricVersionId: crypto.randomUUID(),
} as const;

describe("evaluation fact view service", () => {
  it("composes authorized readers for a historical employee without mutating retained source references", async () => {
    const employeeId = crypto.randomUUID();
    const managerId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const sourceId = crypto.randomUUID();
    const sourceReference = {
      sourceType: "timeline_event",
      sourceId,
      sourceVersion: 1,
      occurredAt: "2026-08-14T10:00:00.000Z",
      url: null,
    } as const;
    const reader = {
      readAuthorizedFacts: async () => ({
        projectFacts: [
          {
            kind: "source_fact",
            sourceType: "project_contribution",
            sourceId,
            sourceOccurredAt: sourceReference.occurredAt,
            projectId,
            workstreamId: null,
            relatedWorkItemId: null,
            criterionStableId: null,
            criterionVersionId: null,
            summary: "A retained historical result.",
            result: "The acceptance condition passed during the responsibility period.",
            verificationState: "source_supported",
            attributionState: "employee_confirmed",
            responsibilityWindowIds: [],
            sourceReferences: [sourceReference],
          },
        ],
        sourceCoverageNotes: [
          {
            kind: "coverage_note",
            code: "approved_leave_excluded",
            scope: "cycle",
            projectId: null,
            workstreamId: null,
            messageKey: "evaluationFacts.coverage.approvedLeaveExcluded",
            sourceFactIds: [],
            neutral: true,
          },
        ],
      }),
    };
    const module = (await import("./index.js")) as Record<string, unknown>;
    const Service = module.EvaluationFactViewService as
      | (new (
          readers: readonly (typeof reader)[],
          clock: () => Date,
        ) => {
          read: (input: unknown) => Promise<{
            subjectEmployeeId: string;
            projectFacts: readonly {
              sourceId: string;
              sourceReferences: readonly { sourceVersion: number | null }[];
            }[];
            sourceCoverageNotes: readonly { code: string }[];
          }>;
        })
      | undefined;

    expect(Service).toBeTypeOf("function");
    const service = new Service!([reader], () => new Date("2026-10-01T08:00:00.000Z"));
    const view = await service.read({
      cycle,
      subjectEmployeeId: employeeId,
      requester: {
        actorId: managerId,
        subjectEmployeeId: employeeId,
        access: "assigned_manager",
        active: true,
      },
    });

    expect(view.subjectEmployeeId).toBe(employeeId);
    expect(view.projectFacts.map(({ sourceId: id }) => id)).toEqual([sourceId]);
    expect(view.sourceCoverageNotes.map(({ code }) => code)).toEqual(["approved_leave_excluded"]);
    expect(() => {
      (
        view.projectFacts[0]!.sourceReferences[0] as { sourceVersion: number | null }
      ).sourceVersion = 2;
    }).toThrow();
  });
});
