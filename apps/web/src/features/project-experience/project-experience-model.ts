export function buildProjectExperienceModel(
  experience: import("@evaluation/contracts/employee-experience").EmployeeProjectExperienceV1,
) {
  return {
    ...experience,
    progress:
      experience.progress.state === "accepted"
        ? {
            kind: "accepted" as const,
            label: `${experience.progress.percent}%`,
            value: experience.progress.percent,
          }
        : {
            kind: "missing" as const,
            label:
              experience.progress.state === "awaiting_contract"
                ? "Needs a progress contract"
                : "Needs information",
            value: null,
          },
    currentMilestone: experience.milestones.find(({ state }) => state === "current")?.name ?? null,
  };
}
