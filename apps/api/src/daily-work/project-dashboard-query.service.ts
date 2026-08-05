export class ProjectDashboardQueryService {
  private readonly progress: import("@evaluation/projects").ProgressQueryService;

  constructor(progress: import("@evaluation/projects").ProgressQueryService) {
    this.progress = progress;
  }

  async load(actorId: string, projectId: string): Promise<unknown> {
    const view = await this.progress.getProjectProgress({ actorId, projectId });
    if (typeof view !== "object" || view === null || !("pulse" in view)) {
      throw new Error("Project progress reader did not return the approved pulse projection");
    }
    return view;
  }
}
