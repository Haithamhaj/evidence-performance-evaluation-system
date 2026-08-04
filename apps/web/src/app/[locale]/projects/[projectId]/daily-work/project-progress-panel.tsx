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
  contractDraftSourceRequest?: Readonly<{
    documentVersionId: string;
    sourceChecksum: string;
    sourceVersion: number;
  }> | null;
}>;

export function ProjectProgressPanel({
  catalog,
  draftJourney,
  locale,
  view,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  draftJourney?: Readonly<{
    initialDraft:
      import("../../../../../platform/progress-contract-drafts").PublicProgressContractDraft | null;
    initialOpen: boolean;
    sourceRequest:
      import("./progress-contract-draft-panel").ProgressContractDraftSourceRequest | null;
  }>;
  locale: import("@evaluation/localization").Locale;
  view: ProjectProgressView;
}>) {
  const accepted = view.progress.state === "accepted" ? view.progress : null;
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
        <span className={`statusBadge status-${view.project.status}`}>
          {catalog[`workspace.status.${view.project.status}`]}
        </span>
      </header>

      {createElement(ProgressContractDraftPanel, {
        catalog,
        initialDraft: draftJourney?.initialDraft ?? null,
        initialOpen: draftJourney?.initialOpen ?? false,
        locale,
        projectId: view.project.id,
        sourceRequest: draftJourney?.sourceRequest ?? null,
      })}

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
