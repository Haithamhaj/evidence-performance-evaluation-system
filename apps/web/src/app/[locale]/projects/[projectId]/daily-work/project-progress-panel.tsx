import { formatDateTime } from "@evaluation/localization";
import { createElement } from "react";

import { ProgressContractDraftPanel } from "./progress-contract-draft-panel";

export type ProjectProgressView = Readonly<{
  project: Readonly<{
    id: string;
    name: string;
    description: string;
    status: "draft" | "active" | "paused" | "completed" | "archived";
  }>;
  contract: Readonly<{
    id: string;
    contractVersion: number;
    version: number;
    state: "active";
    calculationKind: "weighted" | "stage_gate";
    effectiveAt: string;
    components: readonly Readonly<{
      id: string;
      kind: "milestone" | "deliverable" | "kpi" | "acceptance";
      name: string;
      description: string;
      weight: number | null;
      baseline: number | null;
      target: number | null;
      unit: string | null;
      direction: "increase" | "decrease" | "maintain" | null;
      requiredEvidence: readonly string[];
    }>[];
  }> | null;
  progress:
    | Readonly<{ state: "awaiting_contract" | "awaiting_information" }>
    | Readonly<{
        state: "accepted";
        snapshotId: string;
        percent: number;
        reason: string;
        updatedAt: string;
      }>;
  pulse: Readonly<{
    officialProgress: number | null;
    previousOfficialProgress: number | null;
    sourceCoverage: "SUFFICIENT" | "INSUFFICIENT";
    milestoneStates: readonly Readonly<{
      componentId: string;
      name: string;
      kind: "milestone" | "deliverable" | "kpi" | "acceptance";
      percent: number | null;
      state: "complete" | "in_progress" | "not_started" | "awaiting_evidence";
    }>[];
    nextRequiredEvidence: readonly Readonly<{
      componentId: string;
      componentName: string;
      label: string;
    }>[];
    explanation: readonly Readonly<{
      kind: "increase" | "decrease" | "no_change";
      delta: number;
      text: string;
      snapshotId: string;
      observedAt: string;
    }>[];
  }>;
  contractDraftSourceRequest?: Readonly<{
    documentVersionId: string;
    sourceChecksum: string;
    sourceVersion: number;
  }> | null;
}>;

export function ProjectProgressPanel({
  catalog,
  locale,
  view,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  locale: import("@evaluation/localization").Locale;
  view: ProjectProgressView;
}>) {
  const accepted = view.progress.state === "accepted" ? view.progress : null;
  const latestExplanation = view.pulse.explanation[0];
  const nextMilestone = view.pulse.milestoneStates.find(({ state }) => state !== "complete");
  return (
    <section className="dailyWorkPage" aria-labelledby="project-progress-heading">
      <nav className="breadcrumbs" aria-label={catalog["workspace.backToProjects"]}>
        <a href={`/${locale}/projects/${view.project.id}`}>{catalog["workspace.backToProjects"]}</a>
      </nav>
      <header className="compactPageHeading">
        <div>
          <p className="eyebrow">{catalog["progress.title"]}</p>
          <h1 id="project-progress-heading">{view.project.name}</h1>
          <p>{view.project.description}</p>
        </div>
        <div className="formActions">
          <a className="secondaryLink" href={`/${locale}/projects/${view.project.id}/readiness`}>
            {catalog["readiness.title"]}
          </a>
          <span className={`statusBadge status-${view.project.status}`}>
            {catalog[`workspace.status.${view.project.status}`]}
          </span>
        </div>
      </header>

      {createElement(ProgressContractDraftPanel, {
        catalog,
        enabled: view.contractDraftSourceRequest != null,
        locale,
        projectId: view.project.id,
      })}

      <section className="projectPulseActions panel" aria-labelledby="project-pulse-heading">
        <h2 id="project-pulse-heading">{catalog["projectPulse.title"]}</h2>
        {view.pulse.sourceCoverage === "INSUFFICIENT" ? (
          <p className="setupAttention">
            <strong>{catalog["projectPulse.coverage.insufficient"]}</strong>{" "}
            {catalog["projectPulse.retainedOfficial"]}
          </p>
        ) : null}
        <dl className="projectPulseActionList">
          <div>
            <dt>{catalog["projectPulse.whatChanged"]}</dt>
            <dd>{latestExplanation?.text ?? catalog["projectPulse.noChange"]}</dd>
          </div>
          <div>
            <dt>{catalog["projectPulse.blocked"]}</dt>
            <dd>
              {view.project.status === "paused" || view.pulse.sourceCoverage === "INSUFFICIENT"
                ? catalog["projectPulse.waitingForSource"]
                : catalog["projectPulse.noBlocker"]}
            </dd>
          </div>
          <div>
            <dt>{catalog["projectPulse.evidenceNeeded"]}</dt>
            <dd>
              {view.pulse.nextRequiredEvidence.length === 0 ? (
                catalog["projectPulse.noEvidenceNeeded"]
              ) : (
                <ul>
                  {view.pulse.nextRequiredEvidence.map((evidence) => (
                    <li key={`${evidence.componentId}:${evidence.label}`}>
                      <strong>{evidence.componentName}:</strong> {evidence.label}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
          <div>
            <dt>{catalog["projectPulse.nextMilestone"]}</dt>
            <dd>{nextMilestone?.name ?? catalog["projectPulse.allComplete"]}</dd>
          </div>
        </dl>
      </section>

      <section className="progressSummary panel" aria-labelledby="official-progress-heading">
        <div>
          <h2 id="official-progress-heading">{catalog["progress.official"]}</h2>
          <p className="boundaryNote">{catalog["progress.notPerformance"]}</p>
        </div>
        {accepted === null ? (
          <p className="awaitingState">
            {view.progress.state === "awaiting_contract"
              ? catalog["progress.awaitingContract"]
              : catalog["progress.awaitingInformation"]}
          </p>
        ) : (
          <div className="officialProgress">
            <strong>{accepted.percent}%</strong>
            <progress
              aria-label={catalog["progress.official"]}
              max={100}
              value={accepted.percent}
            />
            <p>{accepted.reason}</p>
            <p>
              {catalog["progress.updated"]}:{" "}
              <time dateTime={accepted.updatedAt}>
                {formatDateTime(accepted.updatedAt, locale)}
              </time>
            </p>
          </div>
        )}
      </section>

      <section className="workGroup panel" aria-labelledby="components-heading">
        <h2 id="components-heading">{catalog["progress.milestones"]}</h2>
        {view.contract === null ? (
          <p>{catalog["progress.awaitingContract"]}</p>
        ) : (
          <ul className="progressComponentList">
            {view.contract.components.map((component) => (
              <li key={component.id}>
                <div className="rowMain">
                  <strong>{component.name}</strong>
                  <span>{component.description}</span>
                  {component.kind !== "kpi" ? null : (
                    <span>
                      {component.baseline} → {component.target} {component.unit}
                    </span>
                  )}
                </div>
                {component.weight === null ? null : <span>{component.weight}%</span>}
                <details>
                  <summary>{catalog["progress.requiredEvidence"]}</summary>
                  <ul>
                    {component.requiredEvidence.map((evidence) => (
                      <li key={evidence}>{evidence}</li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
