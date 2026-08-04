type DatabaseClient = import("@evaluation/database").DatabaseClient;
type DatabaseTransaction = import("@evaluation/database").DatabaseTransaction;

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
    return this.snapshotUsing(this.database, input);
  }

  async snapshotIn(
    transaction: DatabaseTransaction,
    input: Readonly<{
      kind: "project" | "workstream";
      resourceId: string;
      at: Date;
    }>,
  ): Promise<CriteriaReviewIdentity | null> {
    await lockIdentityRows(transaction, input);
    return this.snapshotUsing(transaction, input);
  }

  private async snapshotUsing(
    database: Pick<DatabaseClient, "project" | "workstream" | "responsibilityWindow">,
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
      const project = await database.project.findUnique({
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
      const workstream = await database.workstream.findUnique({
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

    const windows = await database.responsibilityWindow.findMany({
      where: {
        ...(input.kind === "project"
          ? { projectId: input.resourceId }
          : { workstreamId: input.resourceId }),
        startsAt: { lte: input.at },
        OR: [{ endsAt: null }, { endsAt: { gt: input.at } }],
        employee: { active: true },
      },
      select: {
        employeeId: true,
        responsibilityType: true,
        employee: { select: { active: true } },
      },
    });
    const activeWindows = windows.filter(({ employee }) => employee.active);
    const owners = activeWindows.filter(({ responsibilityType }) =>
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
          activeWindows
            .filter(({ responsibilityType }) => responsibilityType === "contributor")
            .map(({ employeeId }) => employeeId),
        ),
      ].sort(),
    };
  }
}

async function lockIdentityRows(
  transaction: DatabaseTransaction,
  input: Readonly<{
    kind: "project" | "workstream";
    resourceId: string;
    at: Date;
  }>,
): Promise<void> {
  if (input.kind === "project") {
    await transaction.$queryRaw`SELECT id FROM "Project" WHERE id = ${input.resourceId}::uuid FOR UPDATE`;
    await transaction.$queryRaw`
      SELECT id FROM "ResponsibilityWindow"
      WHERE "projectId" = ${input.resourceId}::uuid
        AND "startsAt" <= ${input.at}
        AND ("endsAt" IS NULL OR "endsAt" > ${input.at})
      FOR UPDATE
    `;
    return;
  }
  await transaction.$queryRaw`SELECT id FROM "Workstream" WHERE id = ${input.resourceId}::uuid FOR UPDATE`;
  await transaction.$queryRaw`
    SELECT id FROM "ResponsibilityWindow"
    WHERE "workstreamId" = ${input.resourceId}::uuid
      AND "startsAt" <= ${input.at}
      AND ("endsAt" IS NULL OR "endsAt" > ${input.at})
    FOR UPDATE
  `;
}
