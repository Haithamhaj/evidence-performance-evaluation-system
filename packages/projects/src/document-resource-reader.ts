type DatabaseClient = import("@evaluation/database").DatabaseClient;

export type DocumentResourceIdentity = Readonly<{
  kind: "project" | "workstream";
  resourceId: string;
  projectId: string;
  organizationId: string;
  departmentId: string;
  status: "draft" | "active" | "paused" | "completed" | "archived";
}>;

export type DocumentResourceReference = Readonly<{
  kind: "project" | "workstream";
  resourceId: string;
}>;

export interface DocumentResourceIdentityReader {
  read(input: DocumentResourceReference): Promise<DocumentResourceIdentity | null>;
}

export class DocumentResourceReader implements DocumentResourceIdentityReader {
  private readonly database: DatabaseClient;

  constructor(database: DatabaseClient) {
    this.database = database;
  }

  async read(input: DocumentResourceReference): Promise<DocumentResourceIdentity | null> {
    if (input.kind === "project") {
      const project = await this.database.project.findUnique({
        where: { id: input.resourceId },
        select: { id: true, organizationId: true, departmentId: true, status: true },
      });
      if (project === null) return null;
      return {
        kind: "project",
        resourceId: project.id,
        projectId: project.id,
        organizationId: project.organizationId,
        departmentId: project.departmentId,
        status: project.status,
      };
    }
    const workstream = await this.database.workstream.findUnique({
      where: { id: input.resourceId },
      select: {
        id: true,
        projectId: true,
        status: true,
        project: { select: { organizationId: true, departmentId: true } },
      },
    });
    if (workstream === null) return null;
    return {
      kind: "workstream",
      resourceId: workstream.id,
      projectId: workstream.projectId,
      organizationId: workstream.project.organizationId,
      departmentId: workstream.project.departmentId,
      status: workstream.status,
    };
  }
}
