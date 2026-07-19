export class DailyWorkQueryService {
  private readonly workItems: import("@evaluation/work-items").WorkItemQueryService;
  private readonly progress: import("@evaluation/projects").ProgressQueryService;
  private readonly sourceRequests:
    | Pick<
        import("@evaluation/documents").ProgressContractDraftSourceLocator,
        "locateApprovedProjectVersion"
      >
    | undefined;

  constructor(
    workItems: import("@evaluation/work-items").WorkItemQueryService,
    progress: import("@evaluation/projects").ProgressQueryService,
    sourceRequests?: Pick<
      import("@evaluation/documents").ProgressContractDraftSourceLocator,
      "locateApprovedProjectVersion"
    >,
  ) {
    this.workItems = workItems;
    this.progress = progress;
    this.sourceRequests = sourceRequests;
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

  async project(actorId: string, projectId: string): Promise<unknown> {
    const [view, contractDraftSourceRequest] = await Promise.all([
      this.progress.getProjectProgress({ actorId, projectId }),
      this.sourceRequests?.locateApprovedProjectVersion({
        actor: { userId: actorId, active: true },
        projectId,
      }) ?? Promise.resolve(null),
    ]);
    return { ...(view as object), contractDraftSourceRequest };
  }
}
