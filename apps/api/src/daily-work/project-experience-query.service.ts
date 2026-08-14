import { AppError, EmployeeProjectExperienceV1Schema } from "@evaluation/contracts";

type Actor = Readonly<{ userId: string; active: boolean }>;
type Readers = Readonly<{
  project(actorId: string, projectId: string): Promise<unknown>;
  document(actorId: string, projectId: string): Promise<unknown | null>;
  myWork(actorId: string): Promise<any>;
  timeline(input: {
    actorId: string;
    projectId: string;
    workstreamId: null;
    limit: number;
    cursor: null;
  }): Promise<any>;
}>;

export class ProjectExperienceQueryService {
  private readonly readers: Readers;
  private readonly now: () => Date;

  constructor(readers: Readers, now: () => Date = () => new Date()) {
    this.readers = readers;
    this.now = now;
  }

  async load(actor: Actor, projectId: string) {
    if (!actor.active) {
      throw new AppError(
        "PROJECT_EXPERIENCE_FORBIDDEN",
        "errors.authorization.inactivePrincipal",
        403,
      );
    }
    const [raw, documentDetail, work, timeline] = await Promise.all([
      this.readers.project(actor.userId, projectId),
      this.readers.document(actor.userId, projectId),
      this.readers.myWork(actor.userId),
      this.readers.timeline({
        actorId: actor.userId,
        projectId,
        workstreamId: null,
        limit: 20,
        cursor: null,
      }),
    ]);
    const view = raw as any;
    const progress = operationalProgress(view);
    const source = progressSource(view.progress?.updatedAt ?? this.now().toISOString());
    const workItems = (work.groups ?? [])
      .flatMap((group: any) => group.items ?? [])
      .filter((item: any) => item.projectId === projectId);
    const timelineItems = (timeline.items ?? [])
      .filter((item: any) => item.projectId === projectId)
      .filter(isMeaningfulTimelineItem)
      .map((item: any) => ({
        id: `timeline:${item.id}`,
        kind: timelineKind(item.kind),
        occurredAt: item.occurredAt,
        title: item.title,
        detail: item.detail,
        contextLabel: timelineContext(item),
        projectId,
        projectName: view.project.name,
        statusLabel: timelineStatusLabel(item),
        href: `/en/projects/${projectId}`,
        source: {
          ...source,
          kind: timelineSourceKind(item),
          label: timelineSourceLabel(item),
        },
      }));
    const document = documentSummary(view, projectId, source);
    const milestones = milestoneJourney(view);
    const kpi = selectKpi(view, source);
    const attention = attentionItems(view, document, source, projectId);
    const workCollection = workItems.map((item: any) => ({
      id: `work:${item.id}`,
      title: item.title,
      subtitle: `${item.status}${item.dueAt ? ` · Due ${item.dueAt.slice(0, 10)}` : ""}`,
      href: `/en/tasks?item=${item.id}`,
      source: { ...source, kind: "work_item" as const, label: "Work Item" },
    }));
    const collectionFromTimeline = (item: any) => ({
      id: item.id,
      title: item.title,
      subtitle: item.statusLabel,
      href: item.href,
      source: item.source,
    });
    const updateCollection = timelineItems
      .filter((item: any) => item.kind === "update")
      .map(collectionFromTimeline);
    const evidenceCollection = timelineItems
      .filter((item: any) => item.kind === "evidence")
      .map(collectionFromTimeline);
    const agentSignals = projectAgentSignals({
      view,
      document,
      workItems,
      milestones,
      source,
      projectId,
    });
    const preparedActions = projectPreparedActions({
      signals: agentSignals,
      timelineItems,
      projectId,
    });
    const smartAction = attention[0] ?? workCollection[0] ?? null;
    return EmployeeProjectExperienceV1Schema.parse({
      schemaVersion: "employee-project-experience.v1",
      generatedAt: this.now().toISOString(),
      project: {
        id: view.project.id,
        name: view.project.name,
        description: view.project.description ?? "",
        status: view.project.status,
        ownerName: activeOwnerName(view.workspace),
        workstreams: (view.workspace?.workstreams ?? []).map((item: any) => ({
          id: item.id,
          name: item.name,
        })),
      },
      document,
      documentWorkspace: documentWorkspace(documentDetail),
      criteriaContract: criteriaContract(view, document, actor.userId),
      progress,
      progressReview: progressReview(view, progress, source),
      milestones,
      kpi,
      attention,
      collections: {
        work: workCollection,
        updates: updateCollection,
        evidence: evidenceCollection,
        documents:
          document === null
            ? []
            : [
                {
                  id: `document:${document.id}`,
                  title: document.title,
                  subtitle: `Version ${document.version}`,
                  href: document.href,
                  source: document.source,
                },
              ],
      },
      timeline: timelineItems,
      nextCursor: timeline.nextCursor ?? null,
      agentSignals,
      preparedActions,
      smartBrief:
        smartAction === null
          ? null
          : {
              title: "What needs attention?",
              body: smartAction.title,
              source: smartAction.source,
              why: smartAction.subtitle,
              consequence:
                "Opening the existing authorized destination does not confirm or change progress automatically.",
              action: {
                label: smartAction.title,
                href: smartAction.href ?? `/en/projects/${projectId}`,
              },
            },
    });
  }
}

function projectAgentSignals({
  view,
  document,
  workItems,
  milestones,
  source,
  projectId,
}: Readonly<{
  view: any;
  document: any;
  workItems: any[];
  milestones: any[];
  source: any;
  projectId: string;
}>) {
  const signals: any[] = [];
  if (activeOwnerName(view.workspace) === null) {
    signals.push({
      id: "project-signal:ownership-gap",
      kind: "ownership_gap",
      severity: "attention",
      title: "Project ownership needs attention",
      detail: "No active Primary Project Owner is recorded for this Project.",
      source: { ...source, kind: "human_decision", label: "Project responsibility record" },
      action: { label: "Review Project ownership", href: `/en/projects/${projectId}` },
    });
  }
  const contractSourceVersion = view.contractProposal?.sourceDocumentVersion ?? null;
  if (document !== null && view.contract === null && contractSourceVersion === null) {
    signals.push({
      id: "project-signal:source-change",
      kind: "source_change",
      severity: "attention",
      title: "Project source is not reflected in a Progress Contract",
      detail: `Project Document v${document.version} is current; no active contract or proposal is grounded in it.`,
      source: {
        ...document.source,
        label: `Project Document v${document.version}`,
      },
      action: { label: "Review source gap", href: `/en/projects/${projectId}#progress` },
    });
  } else if (
    document !== null &&
    contractSourceVersion !== null &&
    document.version !== contractSourceVersion
  ) {
    signals.push({
      id: "project-signal:source-change",
      kind: "source_change",
      severity: "attention",
      title: "Project document changed after the contract source",
      detail: `Project Document v${document.version} is current; the criteria proposal is grounded in v${contractSourceVersion}.`,
      source: {
        ...document.source,
        label: `Project Document v${document.version}`,
      },
      action: { label: "Review source change", href: `/en/projects/${projectId}` },
    });
  }
  const blocked = workItems.find((item) => item.status === "blocked");
  if (blocked) {
    signals.push({
      id: `project-signal:dependency:${blocked.id}`,
      kind: "dependency",
      severity: "attention",
      title: `Blocked work: ${blocked.title}`,
      detail: blocked.blocker || "A Project Task is blocked and needs an authorized next step.",
      source: { ...source, kind: "work_item", label: "Authorized Project Task" },
      action: { label: "Review blocked Task", href: `/en/tasks?item=${blocked.id}` },
    });
  }
  const evidenceGap = view.pulse?.nextRequiredEvidence?.[0];
  if (evidenceGap) {
    signals.push({
      id: `project-signal:evidence-gap:${evidenceGap.componentId}`,
      kind: "evidence_gap",
      severity: "watch",
      title: `Evidence needed for ${evidenceGap.componentName}`,
      detail: evidenceGap.label,
      source,
      action: { label: "Review missing evidence", href: `/en/projects/${projectId}#progress` },
    });
  }
  const milestoneRisk = milestones.find((item) => item.state === "awaiting_evidence");
  if (milestoneRisk) {
    signals.push({
      id: `project-signal:milestone-risk:${milestoneRisk.componentId}`,
      kind: "milestone_risk",
      severity: "watch",
      title: `Milestone is waiting for evidence: ${milestoneRisk.name}`,
      detail:
        "The approved contract cannot confirm this milestone until its required evidence is available.",
      source,
      action: { label: "Review milestone context", href: `/en/projects/${projectId}#progress` },
    });
  }
  return signals.slice(0, 5);
}

function projectPreparedActions({
  signals,
  timelineItems,
  projectId,
}: Readonly<{ signals: any[]; timelineItems: any[]; projectId: string }>) {
  const prepared: any[] = [];
  const firstByKind = (kind: string) => signals.find((signal) => signal.kind === kind);
  const intervention = firstByKind("ownership_gap") ?? firstByKind("dependency");
  if (intervention) {
    prepared.push({
      id: "project-preparation:intervention",
      kind: "intervention_item",
      title: "Prepare an intervention item",
      detail: intervention.detail,
      source: intervention.source,
      action: intervention.action,
      requiresConfirmation: true,
    });
  }
  const sourceChange = firstByKind("source_change");
  if (sourceChange) {
    prepared.push({
      id: "project-preparation:progress-proposal",
      kind: "progress_proposal",
      title: "Prepare a contract-based progress proposal",
      detail:
        "Review the new Project source against the active contract before an authorized owner considers any progress change.",
      source: sourceChange.source,
      action: sourceChange.action,
      requiresConfirmation: true,
    });
  }
  const milestoneContext = firstByKind("milestone_risk") ?? firstByKind("evidence_gap");
  if (milestoneContext) {
    prepared.push({
      id: "project-preparation:milestone-context",
      kind: "next_milestone_context",
      title: "Prepare the next milestone context",
      detail: milestoneContext.detail,
      source: milestoneContext.source,
      action: milestoneContext.action,
      requiresConfirmation: true,
    });
  }
  const latestChange = timelineItems[0];
  if (latestChange) {
    prepared.push({
      id: `project-preparation:update:${latestChange.id}`,
      kind: "update_draft",
      title: "Prepare a Project Update draft",
      detail: `Start from the latest confirmed change: ${latestChange.title}`,
      source: latestChange.source,
      action: { label: "Review update context", href: `/en/projects/${projectId}#timeline` },
      requiresConfirmation: true,
    });
  }
  return prepared.slice(0, 4);
}

function criteriaContract(view: any, document: any, actorId: string) {
  const actionOwner = isActiveProjectOwner(view.workspace, actorId)
    ? ("employee" as const)
    : ("project_owner" as const);
  const rawProposal = view.contractProposal ?? null;
  const sourceDocumentVersion = rawProposal?.sourceDocumentVersion ?? document?.version ?? null;
  const proposal =
    rawProposal === null
      ? null
      : {
          state: rawProposal.state,
          revision: rawProposal.revision,
          origin: rawProposal.origin,
          componentCount: rawProposal.componentCount,
          ambiguityCount: rawProposal.ambiguityCount,
          requestedAt: rawProposal.requestedAt,
        };
  if (sourceDocumentVersion === null) {
    return {
      sourceDocumentVersion: null,
      status: "source_required" as const,
      proposal: null,
      nextAction: "connect_document" as const,
      actionOwner,
    };
  }
  if (view.contract !== null) {
    return {
      sourceDocumentVersion,
      status: "active" as const,
      proposal,
      nextAction: "review_active_contract" as const,
      actionOwner,
    };
  }
  if (proposal === null || proposal.state === "rejected") {
    return {
      sourceDocumentVersion,
      status: "proposal_required" as const,
      proposal,
      nextAction: "request_proposal" as const,
      actionOwner,
    };
  }
  if (proposal.state === "pending") {
    return {
      sourceDocumentVersion,
      status: "proposal_pending" as const,
      proposal,
      nextAction: "wait_for_proposal" as const,
      actionOwner,
    };
  }
  if (proposal.state === "failed") {
    return {
      sourceDocumentVersion,
      status: "recovery_required" as const,
      proposal,
      nextAction: "recover_proposal" as const,
      actionOwner,
    };
  }
  return {
    sourceDocumentVersion,
    status: "review_required" as const,
    proposal,
    nextAction: "review_proposal" as const,
    actionOwner,
  };
}

function isActiveProjectOwner(workspace: any, actorId: string) {
  return (workspace?.people ?? []).some(
    (item: any) =>
      item.person?.id === actorId &&
      ["original", "acting", "permanent"].includes(item.responsibilityType) &&
      item.endsAt === null,
  );
}

function documentWorkspace(detail: any) {
  if (detail === null) return undefined;
  const versions = [...(detail.versions ?? [])].sort(
    (left: any, right: any) => right.version - left.version,
  );
  const sources = versions.flatMap((version: any) =>
    (version.sources ?? []).map((source: any) => {
      if (source.sourceType === "upload") {
        return {
          kind: "upload" as const,
          label: source.uploadedSource.filename,
          href: null,
        };
      }
      return {
        kind: source.sourceType,
        label: source.url.replace(/^https?:\/\//u, ""),
        href: source.url,
      };
    }),
  );
  return {
    currentVersion: detail.currentVersion,
    sourceAvailability: sources.length > 0 ? ("available" as const) : ("missing" as const),
    history: versions.map((version: any) => ({
      version: version.version,
      reason: version.reason,
      createdAt: version.createdAt,
      sourceCount: (version.sources ?? []).length,
    })),
    sources,
  };
}

function progressReview(view: any, progress: any, source: any) {
  const contract = view.contract
    ? {
        contractVersion: view.contract.contractVersion,
        calculationKind: view.contract.calculationKind,
        effectiveAt: view.contract.effectiveAt,
        components: (view.contract.components ?? []).map((component: any) => ({
          componentId: component.id,
          name: component.name,
          kind: component.kind,
          weight: component.weight ?? null,
          requiredEvidence: strings(component.requiredEvidence),
        })),
      }
    : null;
  const latestSnapshot =
    progress.state === "accepted"
      ? {
          percent: progress.percent,
          previousPercent: view.pulse?.previousOfficialProgress ?? null,
          reason: progress.explanation,
          observedAt: progress.source.observedAt ?? view.progress.updatedAt,
          source,
        }
      : null;
  return {
    contract,
    latestSnapshot,
    pendingChange: view.pendingChange ?? null,
    ambiguities: unique((view.pulse?.nextRequiredEvidence ?? []).map((item: any) => item.label)),
  };
}

function operationalProgress(view: any) {
  if (view.progress?.state === "accepted")
    return {
      state: "accepted" as const,
      percent: view.progress.percent,
      source: progressSource(view.progress.updatedAt),
      explanation: view.progress.reason,
    };
  if (view.progress?.state === "awaiting_contract") return { state: "awaiting_contract" as const };
  const missing = unique((view.pulse?.nextRequiredEvidence ?? []).map((item: any) => item.label));
  return {
    state: "awaiting_information" as const,
    missing: missing.length ? missing : ["Approved measurable progress information"],
  };
}

function milestoneJourney(view: any) {
  const states = view.pulse?.milestoneStates ?? [];
  const current = states.findIndex((item: any) =>
    ["in_progress", "awaiting_evidence"].includes(item.state),
  );
  return states
    .filter((item: any) => item.kind !== "operational_kpi")
    .map((item: any, index: number) => ({
      componentId: item.componentId,
      name: item.name,
      kind: item.kind,
      percent: item.percent,
      state:
        item.state === "complete"
          ? "complete"
          : index === current
            ? "current"
            : index === current + 1
              ? "next"
              : item.state === "awaiting_evidence"
                ? "awaiting_evidence"
                : "not_started",
    }));
}

function selectKpi(view: any, source: any) {
  if (view.progress?.state !== "accepted") return null;
  for (const component of view.contract?.components ?? []) {
    if (
      component.kind !== "operational_kpi" ||
      component.baseline == null ||
      component.target == null ||
      component.unit == null ||
      component.direction == null
    )
      continue;
    const state = view.pulse?.milestoneStates?.find(
      (item: any) => item.componentId === component.id,
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
      source: progressSource(state.observedAt ?? source.observedAt),
    };
  }
  return null;
}

function documentSummary(view: any, projectId: string, source: any) {
  if (view.document)
    return {
      id: view.document.id,
      title: view.document.title ?? "Project Document",
      version: view.document.version,
      source: { ...source, kind: "project_document" as const, label: "Approved Project Document" },
      href: `/en/projects/${projectId}`,
    };
  const request = view.contractDraftSourceRequest;
  if (!request) return null;
  return {
    id: request.documentVersionId,
    title: "Project Document",
    version: request.sourceVersion,
    source: { ...source, kind: "project_document" as const, label: "Approved Project Document" },
    href: `/en/projects/${projectId}`,
  };
}

function attentionItems(view: any, document: any, source: any, projectId: string) {
  const items = (view.pulse?.nextRequiredEvidence ?? []).map((gap: any) => ({
    id: `attention:${gap.componentId}`,
    title: gap.label,
    subtitle: `Required for ${gap.componentName}`,
    href: `/en/projects/${projectId}`,
    source,
  }));
  if (document === null)
    items.unshift({
      id: "attention:document",
      title: "Project document is missing",
      subtitle: "Add the main Project document before deriving criteria or a progress contract.",
      href: `/en/projects/${projectId}`,
      source,
    });
  return items;
}

function activeOwnerName(workspace: any) {
  return (
    workspace?.people?.find(
      (item: any) => item.responsibilityType === "original" && item.endsAt === null,
    )?.person.displayName ?? null
  );
}
function progressSource(observedAt: string) {
  return {
    kind: "progress_contract" as const,
    label: "Approved Project contract",
    observedAt,
    freshness: "fresh" as const,
  };
}
function isMeaningfulTimelineItem(item: any) {
  if (["update", "evidence"].includes(item.kind)) return item.reviewState === "employee_confirmed";
  if (item.kind === "project_fact") return item.reviewState === "automated_project_fact";
  if (item.kind === "decision") return item.reviewState === "human_decision";
  return (
    ["research", "experiment", "applied_learning"].includes(item.kind) &&
    ["employee_confirmed", "human_decision"].includes(item.reviewState)
  );
}
function timelineKind(value: string) {
  if (["update", "evidence", "decision"].includes(value)) return value;
  return "verified_change" as const;
}
function timelineStatusLabel(item: any) {
  if (item.kind === "update") return "Confirmed update";
  if (item.kind === "evidence") return "Confirmed evidence";
  if (item.kind === "decision") return "Human decision";
  if (["research", "experiment", "applied_learning"].includes(item.kind))
    return "Confirmed learning";
  return "Verified Project change";
}
function timelineSourceKind(item: any) {
  if (item.sourceProvenance === "github_automated") return "github" as const;
  if (item.kind === "update") return "update" as const;
  if (item.kind === "decision") return "human_decision" as const;
  return "evidence" as const;
}
function timelineSourceLabel(item: any) {
  if (item.sourceProvenance === "github_automated") return "Verified GitHub Project fact";
  if (item.kind === "update") return "Employee-confirmed update";
  if (item.kind === "evidence") return "Employee-confirmed evidence";
  if (item.kind === "decision") return "Authorized human decision";
  return "Confirmed Project learning";
}
function timelineContext(item: any) {
  const parts = [item.workstream?.name, item.workItem?.title].filter(Boolean);
  return parts.length === 0 ? undefined : parts.join(" · ");
}
function unique(values: string[]) {
  return [...new Set(values)];
}
function strings(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}
