export function buildProjectExperienceModel(
  experience: import("@evaluation/contracts/employee-experience").EmployeeProjectExperienceV1,
) {
  const current = experience.milestones.find(({ state }) => state === "current") ?? null;
  const next = experience.milestones.find(({ state }) => state === "next") ?? null;
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
    currentMilestone: current?.name ?? null,
    overview: {
      current,
      next,
      blocker: experience.attention[0] ?? null,
      latestChange: experience.timeline[0] ?? null,
      nextAction: experience.smartBrief?.action ?? null,
    },
    plan: {
      ownerName: experience.project.ownerName,
      workstreams: experience.project.workstreams,
      milestones: experience.milestones,
      document: experience.document,
      progressState: experience.progress.state,
    },
    progressReview: experience.progressReview ?? {
      contract: null,
      latestSnapshot: null,
      pendingChange: null,
      ambiguities:
        experience.progress.state === "awaiting_information" ? experience.progress.missing : [],
    },
    documentWorkspace: experience.documentWorkspace ?? null,
    criteriaContract: experience.criteriaContract ?? {
      sourceDocumentVersion: experience.document?.version ?? null,
      status: experience.document ? ("proposal_required" as const) : ("source_required" as const),
      proposal: null,
      nextAction: experience.document
        ? ("request_proposal" as const)
        : ("connect_document" as const),
      actionOwner: "project_owner" as const,
    },
  };
}
