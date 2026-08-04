export class ProjectDashboardQueryService {
  private readonly progress: import("@evaluation/projects").ProgressQueryService;

  constructor(progress: import("@evaluation/projects").ProgressQueryService) {
    this.progress = progress;
  }

  load(actorId: string, projectId: string): Promise<unknown> {
    return this.progress.getProjectProgress({ actorId, projectId });
  }
}
