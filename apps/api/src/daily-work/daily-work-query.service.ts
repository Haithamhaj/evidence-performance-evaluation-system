export class DailyWorkQueryService {
  private readonly workItems: import("@evaluation/work-items").WorkItemQueryService;
  private readonly progress: import("@evaluation/projects").ProgressQueryService;

  constructor(
    workItems: import("@evaluation/work-items").WorkItemQueryService,
    progress: import("@evaluation/projects").ProgressQueryService,
  ) {
    this.workItems = workItems;
    this.progress = progress;
  }

  myWork(actorId: string): Promise<import("@evaluation/contracts").MyWorkResponse> {
    return this.workItems.listMyWork({ actorId });
  }

  async updateContext(
    actorId: string,
  ): Promise<import("@evaluation/contracts").UpdateComposerContext> {
    const [projects, workItems] = await Promise.all([
      this.progress.listUpdateScopes({ actorId }),
      this.workItems.listUpdatable({ actorId }),
    ]);
    const { UpdateComposerContextSchema } = await import("@evaluation/contracts");
    return UpdateComposerContextSchema.parse({
      projects: projects.map((project) => ({
        ...project,
        workItems: workItems
          .filter((item) => item.projectId === project.id)
          .map(({ id, title, workstreamId }) => ({ id, title, workstreamId })),
      })),
    });
  }

  projects(actorId: string): Promise<unknown> {
    return this.progress.listPortfolio({ actorId });
  }

  project(actorId: string, projectId: string): Promise<unknown> {
    return this.progress.getProjectProgress({ actorId, projectId });
  }
}
