import type { EmployeeHomeV1 } from "@evaluation/contracts/employee-experience";

type Home = EmployeeHomeV1;

export function buildHomeOverviewModel(home: Home) {
  return {
    generatedAt: home.generatedAt,
    greetingName: displayName(home.greetingName),
    signals: home.signals,
    smartBrief: home.smartBrief,
    now: home.now,
    projects: home.projects.map((project) => ({
      ...project,
      progress: progressModel(project.progress),
      progressProvenance:
        project.progress.state === "accepted"
          ? project.progress.source.label
          : "Approved Project progress requirements",
      currentMilestone: project.milestones.find(({ state }) => state === "current")?.name ?? null,
      nextMilestone: project.milestones.find(({ state }) => state === "next")?.name ?? null,
    })),
  };
}

function progressModel(progress: Home["projects"][number]["progress"]) {
  if (progress.state === "accepted") {
    return {
      kind: "accepted" as const,
      label: `${formatNumber(progress.percent)}%`,
      value: progress.percent,
    };
  }
  if (progress.state === "awaiting_contract") {
    return { kind: "missing" as const, label: "Needs a progress contract", missing: [] };
  }
  return {
    kind: "missing" as const,
    label: "Needs information",
    missing: progress.missing,
  };
}

function displayName(value: string) {
  return value.includes("@") ? value.slice(0, value.indexOf("@")) : value;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value);
}
