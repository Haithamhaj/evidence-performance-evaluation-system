import { ResponsibilityWindowFactSchema } from "@evaluation/contracts";

type DatabaseClient = import("@evaluation/database").DatabaseClient;

type EvaluationSourceReadInput = Readonly<{
  subjectEmployeeId: string;
  cycleStart: string;
  cycleEnd: string;
}>;

export type EmployeeEvaluationScopes = Readonly<{
  projectIds: readonly string[];
  workstreamIds: readonly string[];
}>;

export interface EmployeeEvaluationScopeReader {
  readEmployeeScopes(input: EvaluationSourceReadInput): Promise<EmployeeEvaluationScopes>;
}

export class ProjectEvaluationFactReader implements EmployeeEvaluationScopeReader {
  private readonly database: DatabaseClient;

  constructor(database: DatabaseClient) {
    this.database = database;
  }

  async readAuthorizedFacts(input: EvaluationSourceReadInput): Promise<
    Readonly<{
      responsibilityWindows: readonly import("@evaluation/contracts").ResponsibilityWindowFact[];
    }>
  > {
    const windows = await this.readWindows(input);
    return {
      responsibilityWindows: windows.map((window) =>
        ResponsibilityWindowFactSchema.parse({
          kind: "source_fact",
          sourceType: "responsibility_window",
          sourceId: window.id,
          sourceOccurredAt: window.createdAt.toISOString(),
          projectId: projectIdFor(window),
          workstreamId: window.workstreamId,
          responsibilityType: mapResponsibilityType(window.responsibilityType),
          startedAt: window.startsAt.toISOString(),
          endedAt: window.endsAt?.toISOString() ?? null,
          sourceReferences: [
            {
              sourceType: "responsibility_window",
              sourceId: window.id,
              sourceVersion: null,
              occurredAt: window.createdAt.toISOString(),
              url: null,
            },
          ],
        }),
      ),
    };
  }

  async readEmployeeScopes(input: EvaluationSourceReadInput): Promise<EmployeeEvaluationScopes> {
    const windows = await this.readWindows(input);
    return {
      projectIds: unique(windows.map(projectIdFor)),
      workstreamIds: unique(
        windows.flatMap(({ workstreamId }) => (workstreamId === null ? [] : [workstreamId])),
      ),
    };
  }

  private readWindows(input: EvaluationSourceReadInput) {
    return this.database.responsibilityWindow.findMany({
      where: {
        employeeId: input.subjectEmployeeId,
        startsAt: { lte: new Date(input.cycleEnd) },
        OR: [{ endsAt: null }, { endsAt: { gt: new Date(input.cycleStart) } }],
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        projectId: true,
        workstreamId: true,
        workstream: { select: { projectId: true } },
        responsibilityType: true,
        startsAt: true,
        endsAt: true,
        createdAt: true,
      },
    });
  }
}

function projectIdFor(
  window: Readonly<{ projectId: string | null; workstream: { projectId: string } | null }>,
): string {
  const projectId = window.projectId ?? window.workstream?.projectId;
  if (projectId === undefined) throw new Error("Responsibility window has no project scope");
  return projectId;
}

function mapResponsibilityType(
  value: "original" | "acting" | "permanent" | "contributor",
): import("@evaluation/contracts").ResponsibilityWindowFact["responsibilityType"] {
  if (value === "original") return "original_owner";
  if (value === "acting") return "acting_owner";
  if (value === "permanent") return "permanent_owner";
  return "contributor";
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
