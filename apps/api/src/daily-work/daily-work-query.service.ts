export class DailyWorkQueryService {
  private readonly workItems: import("@evaluation/work-items").WorkItemQueryService;
  private readonly progress: import("@evaluation/projects").ProgressQueryService;
  private readonly inbox: import("@evaluation/work-items").PrivateInboxQueryService | undefined;
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
    inbox?: import("@evaluation/work-items").PrivateInboxQueryService,
  ) {
    this.workItems = workItems;
    this.progress = progress;
    this.sourceRequests = sourceRequests;
    this.inbox = inbox;
  }

  myWork(actorId: string): Promise<import("@evaluation/contracts").MyWorkResponse> {
    return this.workItems.listMyWork({ actorId });
  }

  async dailyWorkspace(actor: {
    userId: string;
    active: boolean;
  }): Promise<import("@evaluation/contracts").DailyWorkspaceSnapshot> {
    const [myWork, inbox, projectPulse] = await Promise.all([
      this.workItems.listMyWork({ actorId: actor.userId }),
      this.inbox?.list({
        actor,
        input: { status: "open", limit: 20, cursor: null },
      }) ?? Promise.resolve({ items: [], nextCursor: null }),
      this.progress.listPortfolio({ actorId: actor.userId }),
    ]);
    const group = (key: import("@evaluation/contracts").MyWorkResponse["groups"][number]["key"]) =>
      myWork.groups.find((entry) => entry.key === key)?.items ?? [];
    const needsMyAction = group("needs_my_action");
    const { DailyWorkspaceSnapshotSchema } = await import("@evaluation/contracts");
    return DailyWorkspaceSnapshotSchema.parse({
      needsMyAction,
      today: group("today"),
      overdue: group("overdue"),
      reviewQueue: [],
      inbox: inbox.items,
      projectPulse,
      upcoming: group("this_week"),
    });
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
