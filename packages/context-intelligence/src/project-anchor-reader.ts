import { PROJECT_ANCHOR_KINDS, ProjectAnchorSchema } from "@evaluation/contracts";

type ProjectAnchor = import("@evaluation/contracts").ProjectAnchor;
type ProjectCandidate = import("./matching-policy.js").ProjectCandidate;

export type GovernedProjectAnchor = Readonly<{
  projectId: string;
  kind: string;
  reference: string;
  conflicts: boolean;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
}>;

export interface GovernedProjectAnchorPublicReader {
  readProjectAnchors(
    input: Readonly<{
      employeeId: string;
      sourceItemId: string;
    }>,
  ): Promise<readonly GovernedProjectAnchor[]>;
}

export interface EmployeeProjectAccessPublicReader {
  canAccessProject(employeeId: string, projectId: string, at: Date): Promise<boolean>;
}

export class ProjectAnchorReader {
  private readonly anchors: GovernedProjectAnchorPublicReader;
  private readonly access: EmployeeProjectAccessPublicReader;

  constructor(
    anchors: GovernedProjectAnchorPublicReader,
    access: EmployeeProjectAccessPublicReader,
  ) {
    this.anchors = anchors;
    this.access = access;
  }

  async read(
    input: Readonly<{
      employeeId: string;
      sourceItemId: string;
      at: Date;
    }>,
  ): Promise<ProjectCandidate[]> {
    const records = await this.anchors.readProjectAnchors({
      employeeId: input.employeeId,
      sourceItemId: input.sourceItemId,
    });
    const byProject = new Map<string, GovernedProjectAnchor[]>();
    for (const record of records) {
      assertBoundedKind(record.kind);
      const values = byProject.get(record.projectId) ?? [];
      values.push(record);
      byProject.set(record.projectId, values);
    }

    return Promise.all(
      [...byProject].map(async ([projectId, projectAnchors]) => ({
        projectId,
        accessible: await this.access.canAccessProject(input.employeeId, projectId, input.at),
        anchors: projectAnchors.map((record) => ({
          anchor: ProjectAnchorSchema.parse({
            kind: record.kind,
            reference: record.reference,
            conflicts: record.conflicts,
          }),
          current:
            record.effectiveFrom.getTime() <= input.at.getTime() &&
            (record.effectiveUntil === null ||
              input.at.getTime() < record.effectiveUntil.getTime()),
        })),
      })),
    );
  }
}

function assertBoundedKind(kind: string): asserts kind is ProjectAnchor["kind"] {
  if (!(PROJECT_ANCHOR_KINDS as readonly string[]).includes(kind)) {
    throw new Error("Unsupported Project anchor kind");
  }
}
