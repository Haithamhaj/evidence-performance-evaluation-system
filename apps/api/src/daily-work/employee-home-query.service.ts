import { AppError, EmployeeHomeV1Schema } from "@evaluation/contracts";

type Actor = Readonly<{
  userId: string;
  email: string;
  active: boolean;
  roles: readonly string[];
}>;
type DailyWorkspaceReader = Pick<DailyWorkQueryService, "dailyWorkspace" | "project">;
type DailyWorkQueryService = import("./daily-work-query.service.js").DailyWorkQueryService;
type ExperienceReader = Pick<
  import("../operations/experience-event-runtime.js").ExperienceEventRuntime,
  "listWhatChanged"
>;
type Source = import("@evaluation/contracts").EmployeeExperienceSourceRefV1;

type ProjectProgressView = {
  project: { id: string; name: string; description: string; status: "active" | "paused" };
  contract: null | {
    id: string;
    components: Array<{
      id: string;
      kind: "milestone" | "deliverable" | "operational_kpi";
      name: string;
      baseline: number | null;
      target: number | null;
      unit: string | null;
      direction: "increase" | "decrease" | "maintain" | null;
    }>;
  };
  progress:
    | { state: "awaiting_contract" | "awaiting_information" }
    | { state: "accepted"; percent: number; reason: string; updatedAt: string };
  pulse: {
    milestoneStates: Array<{
      componentId: string;
      name: string;
      kind: "milestone" | "deliverable" | "operational_kpi";
      percent: number | null;
      measuredValue?: number;
      observedAt?: string;
      state: "awaiting_evidence" | "not_started" | "in_progress" | "complete";
    }>;
    nextRequiredEvidence: Array<{ componentId: string; componentName: string; label: string }>;
    explanation: Array<{ text: string; observedAt: string }>;
  };
};

export class EmployeeHomeQueryService {
  private readonly dailyWork: DailyWorkspaceReader;
  private readonly experience: ExperienceReader;
  private readonly now: () => Date;

  constructor(
    dailyWork: DailyWorkspaceReader,
    experience: ExperienceReader,
    now: () => Date = () => new Date(),
  ) {
    this.dailyWork = dailyWork;
    this.experience = experience;
    this.now = now;
  }

  async load(actor: Actor): Promise<import("@evaluation/contracts").EmployeeHomeV1> {
    if (!actor.active) {
      throw new AppError("HOME_ACCESS_FORBIDDEN", "errors.authorization.inactivePrincipal", 403);
    }
    const [workspace, changed] = await Promise.all([
      this.dailyWork.dailyWorkspace({
        userId: actor.userId,
        active: actor.active,
        roles: actor.roles,
      }),
      this.experience.listWhatChanged({ actorId: actor.userId, afterCursor: null }),
    ]);
    const details = await Promise.all(
      workspace.projectPulse.slice(0, 3).map(async (project) => ({
        summary: project,
        view: (await this.dailyWork.project(actor.userId, project.id)) as ProjectProgressView,
      })),
    );
    const projectById = new Map(details.map(({ summary }) => [summary.id, summary.name]));
    const projects = details.map(({ summary, view }) => projectSummary(summary, view));
    const now = changed.items
      .map((item) => receiptTimeline(item, projectById))
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, 20);
    const firstActionProject = projects.find((project) => project.nextAction !== null) ?? null;
    const smartBrief =
      firstActionProject === null
        ? null
        : {
            title: firstActionProject.nextAction!.label,
            body: `${firstActionProject.name} has one source-backed next action ready for review.`,
            source: sourceFor(firstActionProject.progress),
            why: "It is the smallest authorized action that can move the current Project state.",
            consequence:
              "Opening it shows the existing protected review; nothing is confirmed automatically.",
            action: firstActionProject.nextAction!,
          };
    const verifiedChanges = now.filter(({ kind }) => kind === "verified_change").length;

    return EmployeeHomeV1Schema.parse({
      schemaVersion: "employee-home.v1",
      generatedAt: this.now().toISOString(),
      greetingName: displayName(actor.email),
      signals: {
        decisions: workspace.needsMyAction.length,
        dueToday: workspace.today.length,
        verifiedChanges,
      },
      projects,
      smartBrief,
      now,
    });
  }
}

function projectSummary(
  summary: import("@evaluation/contracts").ProjectPulseItem,
  view: ProjectProgressView,
) {
  const progress = operationalProgress(view);
  return {
    id: summary.id,
    name: summary.name,
    description: view.project.description,
    status: summary.status,
    progress,
    milestones: milestoneJourney(view),
    kpi: selectKpi(view),
    nextAction: nextAction(summary.id, view),
  };
}

function operationalProgress(view: ProjectProgressView) {
  if (view.progress.state === "accepted") {
    return {
      state: "accepted" as const,
      percent: view.progress.percent,
      source: progressSource(view.progress.updatedAt),
      explanation: view.progress.reason,
    };
  }
  if (view.progress.state === "awaiting_contract") return { state: "awaiting_contract" as const };
  const missing = unique(view.pulse.nextRequiredEvidence.map(({ label }) => label));
  return {
    state: "awaiting_information" as const,
    missing: missing.length === 0 ? ["Approved measurable progress information"] : missing,
  };
}

function milestoneJourney(view: ProjectProgressView) {
  const currentIndex = view.pulse.milestoneStates.findIndex(({ state }) =>
    ["in_progress", "awaiting_evidence"].includes(state),
  );
  return view.pulse.milestoneStates.map((component, index) => ({
    componentId: component.componentId,
    name: component.name,
    kind: component.kind,
    percent: component.percent,
    state:
      component.state === "complete"
        ? ("complete" as const)
        : index === currentIndex
          ? ("current" as const)
          : currentIndex >= 0 && index === currentIndex + 1
            ? ("next" as const)
            : component.state === "awaiting_evidence"
              ? ("awaiting_evidence" as const)
              : ("not_started" as const),
  }));
}

function selectKpi(view: ProjectProgressView) {
  if (view.progress.state !== "accepted") return null;
  for (const component of view.contract?.components ?? []) {
    if (
      component.kind !== "operational_kpi" ||
      component.baseline === null ||
      component.target === null ||
      component.unit === null ||
      component.direction === null
    ) {
      continue;
    }
    const state = view.pulse.milestoneStates.find(
      ({ componentId }) => componentId === component.id,
    );
    if (state?.measuredValue === undefined) continue;
    return {
      componentId: component.id,
      name: component.name,
      baseline: component.baseline,
      current: state.measuredValue,
      target: component.target,
      unit: component.unit,
      direction: component.direction,
      source: progressSource(state.observedAt ?? view.progress.updatedAt),
    };
  }
  return null;
}

function nextAction(projectId: string, view: ProjectProgressView) {
  const next = view.pulse.milestoneStates.find(({ state }) =>
    ["in_progress", "awaiting_evidence", "not_started"].includes(state),
  );
  if (next === undefined) return null;
  return {
    label:
      next.state === "awaiting_evidence"
        ? `Add evidence for ${next.name}`
        : `Continue ${next.name}`,
    href: `/en/projects/${projectId}`,
  };
}

function receiptTimeline(
  receipt: Awaited<ReturnType<ExperienceReader["listWhatChanged"]>>["items"][number],
  projectNames: ReadonlyMap<string, string>,
) {
  const refs = Array.isArray(receipt.entityRefs) ? receipt.entityRefs : [];
  const projectRef = refs.find(
    (ref) =>
      typeof ref === "object" &&
      ref !== null &&
      "entityType" in ref &&
      ref.entityType === "project" &&
      "entityId" in ref &&
      typeof ref.entityId === "string",
  ) as { entityId: string } | undefined;
  if (projectRef === undefined) return null;
  const projectName = projectNames.get(projectRef.entityId);
  if (projectName === undefined) return null;
  return {
    id: `receipt:${receipt.receiptId}`,
    kind: "verified_change" as const,
    occurredAt: receipt.occurredAt,
    title: "Verified work change",
    projectId: projectRef.entityId,
    projectName,
    statusLabel: receipt.state === "acknowledged" ? "Reviewed" : "Verified",
    href: `/en/projects/${projectRef.entityId}`,
    source: {
      kind: sourceKind(receipt.source),
      label: sourceLabel(receipt.source),
      observedAt: receipt.occurredAt,
      freshness: "fresh" as const,
    },
  };
}

function sourceKind(value: string): Source["kind"] {
  if (value === "updates_evidence") return "evidence";
  if (value === "connected_work_context") return "google_gmail";
  if (value === "projects") return "progress_contract";
  return "work_item";
}

function sourceLabel(value: string): string {
  if (value === "updates_evidence") return "Confirmed Update or Evidence";
  if (value === "connected_work_context") return "Connected work source";
  if (value === "projects") return "Approved Project state";
  return "Authorized Work Item change";
}

function progressSource(observedAt: string): Source {
  return {
    kind: "progress_contract",
    label: "Approved Project contract",
    observedAt,
    freshness: "fresh",
  };
}

function sourceFor(progress: ReturnType<typeof operationalProgress>): Source {
  return progress.state === "accepted"
    ? progress.source
    : {
        kind: "progress_contract",
        label: "Project progress requirements",
        freshness: "unknown",
      };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function displayName(email: string): string {
  const localPart = email.split("@")[0]?.trim();
  return localPart === undefined || localPart === "" ? "Employee" : localPart;
}
