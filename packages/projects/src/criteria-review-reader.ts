type DatabaseClient = import("@evaluation/database").DatabaseClient;

export type CriteriaReviewIdentity = Readonly<{
  kind: "project" | "workstream";
  resourceId: string;
  projectId: string;
  organizationId: string;
  departmentId: string;
  primaryOwnerId: string;
  contributorIds: readonly string[];
}>;

export class CriteriaReviewReader {
  private readonly database: DatabaseClient;

  constructor(database: DatabaseClient) {
    this.database = database;
  }

  async snapshot(
    input: Readonly<{
      kind: "project" | "workstream";
      resourceId: string;
      at: Date;
    }>,
  ): Promise<CriteriaReviewIdentity | null> {
    let resource: Readonly<{
      id: string;
      projectId: string;
      organizationId: string;
      departmentId: string;
    }> | null;
    if (input.kind === "project") {
      const project = await this.database.project.findUnique({
        where: { id: input.resourceId },
        select: { id: true, organizationId: true, departmentId: true },
      });
      resource =
        project === null
          ? null
          : {
              id: project.id,
              projectId: project.id,
              organizationId: project.organizationId,
              departmentId: project.departmentId,
            };
    } else {
      const workstream = await this.database.workstream.findUnique({
        where: { id: input.resourceId },
        select: {
          id: true,
          projectId: true,
          project: { select: { organizationId: true, departmentId: true } },
        },
      });
      resource =
        workstream === null
          ? null
          : {
              id: workstream.id,
              projectId: workstream.projectId,
              organizationId: workstream.project.organizationId,
              departmentId: workstream.project.departmentId,
            };
    }
    if (resource === null) return null;

    const windows = await this.database.responsibilityWindow.findMany({
      where: {
        ...(input.kind === "project"
          ? { projectId: input.resourceId }
          : { workstreamId: input.resourceId }),
        startsAt: { lte: input.at },
        OR: [{ endsAt: null }, { endsAt: { gt: input.at } }],
      },
      select: { employeeId: true, responsibilityType: true },
    });
    const owners = windows.filter(({ responsibilityType }) =>
      ["original", "permanent", "acting"].includes(responsibilityType),
    );
    if (owners.length !== 1) return null;

    return {
      kind: input.kind,
      resourceId: input.resourceId,
      projectId: resource.projectId,
      organizationId: resource.organizationId,
      departmentId: resource.departmentId,
      primaryOwnerId: owners[0]!.employeeId,
      contributorIds: [
        ...new Set(
          windows
            .filter(({ responsibilityType }) => responsibilityType === "contributor")
            .map(({ employeeId }) => employeeId),
        ),
      ].sort(),
    };
  }
}
