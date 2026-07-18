import type {
  CriteriaWorkspace,
  DocumentDetail,
  Project,
  ProjectWorkspace,
  ReadinessParticipantDetail,
} from "@evaluation/contracts";
import type { Catalog, Locale } from "@evaluation/localization";
import { localeMetadata } from "@evaluation/localization";
import { BidiText } from "@evaluation/ui";
import { createElement } from "react";

export type ManagerReadinessView = {
  readonly audience: "manager";
  readonly state: "ready" | "needs_attention" | "missing_critical_information";
};

export type ProjectScreenView = {
  readonly workspace: ProjectWorkspace;
  readonly document: DocumentDetail | null;
  readonly readiness: ReadinessParticipantDetail | ManagerReadinessView | null;
  readonly criteria: CriteriaWorkspace;
};

type ProjectListViewProperties = {
  readonly catalog: Catalog;
  readonly locale: Locale;
  readonly projects: readonly Project[];
  readonly ownersById: Readonly<Record<string, string>>;
};

export function ProjectListView({
  catalog,
  locale,
  ownersById,
  projects,
}: ProjectListViewProperties) {
  return (
    <section className="workspaceSection" aria-labelledby="projects-heading">
      <div className="workspaceHeading">
        <div>
          <h1 id="projects-heading">{catalog["workspace.projects.title"]}</h1>
          <p>{catalog["workspace.projects.subtitle"]}</p>
        </div>
      </div>
      {projects.length === 0 ? (
        <p className="workspaceEmpty">{catalog["workspace.empty"]}</p>
      ) : (
        <ul className="cardGrid workspaceList">
          {projects.map((project) => {
            const ownerName =
              project.primaryOwnerId === null ? undefined : ownersById[project.primaryOwnerId];
            return (
              <li className="workspaceCard" key={project.id}>
                <div className="cardHeading">
                  <h2>{project.name}</h2>
                  {createElement(StatusBadge, { catalog, status: project.status })}
                </div>
                <p>{project.description || catalog["workspace.noDescription"]}</p>
                <dl className="compactDetails">
                  <dt>{catalog["workspace.currentOwner"]}</dt>
                  <dd>
                    {ownerName ?? (
                      <>
                        {project.primaryOwnerId === null
                          ? catalog["workspace.noOwner"]
                          : createTechnicalText(project.primaryOwnerId)}
                      </>
                    )}
                  </dd>
                  <dt>{catalog["workspace.version"]}</dt>
                  <dd>{formatNumber(locale, project.version)}</dd>
                  <dt className="visuallyHidden">{catalog["workspace.identifier"]}</dt>
                  <dd className="resourceId">{createTechnicalText(project.id)}</dd>
                </dl>
                <a className="primaryLink" href={`/${locale}/projects/${project.id}`}>
                  {catalog["workspace.openProject"]}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type ProjectDetailViewProperties = {
  readonly catalog: Catalog;
  readonly locale: Locale;
  readonly screen: ProjectScreenView;
};

export function ProjectDetailView({ catalog, locale, screen }: ProjectDetailViewProperties) {
  const { criteria, document, readiness, workspace } = screen;
  const { project } = workspace;
  const activeCriteria = criteria.activeSet?.items ?? criteria.proposal?.items ?? [];

  return (
    <>
      <nav className="breadcrumbs" aria-label={catalog["workspace.backToProjects"]}>
        <a href={`/${locale}/projects`}>{catalog["workspace.backToProjects"]}</a>
      </nav>
      <section className="workspaceHero">
        <div>
          <h1>{project.name}</h1>
          <p>{project.description || catalog["workspace.noDescription"]}</p>
        </div>
        {createElement(StatusBadge, { catalog, status: project.status })}
      </section>
      <nav className="anchorNavigation" aria-label={catalog["workspace.overview.title"]}>
        <a href="#people">{catalog["workspace.people.title"]}</a>
        <a href="#workstreams">{catalog["workspace.workstreams.title"]}</a>
        <a href="#document">{catalog["workspace.document.title"]}</a>
        <a href="#criteria">{catalog["workspace.criteria.title"]}</a>
      </nav>
      <div className="workspaceDetailGrid">
        <section className="panel" id="people">
          <h2>{catalog["workspace.people.title"]}</h2>
          {workspace.people.length === 0 ? (
            <p>{catalog["workspace.noPeople"]}</p>
          ) : (
            <ul className="plainList">
              {workspace.people.map((period) => (
                <li key={`${period.person.id}:${period.startsAt}`}>
                  <strong>{period.person.displayName}</strong>
                  <span>
                    {catalog[`workspace.responsibility.${period.responsibilityType}`]}
                    {" · "}
                    {catalog["workspace.effectiveFrom"]} {formatDate(locale, period.startsAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" id="workstreams">
          <h2>{catalog["workspace.workstreams.title"]}</h2>
          {workspace.workstreams.length === 0 ? (
            <p>{catalog["workspace.noWorkstreams"]}</p>
          ) : (
            <ul className="plainList">
              {workspace.workstreams.map((workstream) => (
                <li key={workstream.id}>
                  <div className="cardHeading">
                    <strong>{workstream.name}</strong>
                    {createElement(StatusBadge, { catalog, status: workstream.status })}
                  </div>
                  <a href={`/${locale}/projects/${project.id}/workstreams/${workstream.id}`}>
                    {catalog["workspace.openWorkstream"]}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" id="document">
          <h2>{catalog["workspace.document.title"]}</h2>
          {document === null ? (
            <p>{catalog["workspace.documentMissing"]}</p>
          ) : (
            <dl className="compactDetails">
              <dt>{catalog["workspace.documentVersion"]}</dt>
              <dd>{formatNumber(locale, document.currentVersion)}</dd>
              <dt>{catalog["workspace.identifier"]}</dt>
              <dd>{createTechnicalText(document.id)}</dd>
            </dl>
          )}
          <h3>{catalog["workspace.readiness.title"]}</h3>
          <p>{readinessLabel(catalog, readiness)}</p>
        </section>

        <section className="panel" id="criteria">
          <h2>{catalog["workspace.criteria.title"]}</h2>
          {activeCriteria.length === 0 ? (
            <p>{catalog["workspace.criteriaNone"]}</p>
          ) : (
            <>
              <p>
                {criteria.activeSet === null
                  ? catalog["workspace.criteriaProposal"]
                  : catalog["workspace.criteriaActive"]}
              </p>
              <ol className="criteriaList">
                {activeCriteria.map((criterion) => (
                  <li key={criterion.id}>
                    <strong>{criterion.name}</strong>
                    <p>{criterion.expectedBehaviorOrResult}</p>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function StatusBadge({
  catalog,
  status,
}: {
  readonly catalog: Catalog;
  readonly status: Project["status"];
}) {
  return (
    <span className={`statusBadge status-${status}`}>{catalog[`workspace.status.${status}`]}</span>
  );
}

function readinessLabel(catalog: Catalog, readiness: ProjectScreenView["readiness"]): string {
  if (readiness === null) return catalog["workspace.readiness.none"];
  if ("audience" in readiness) return catalog[`workspace.readiness.${readiness.state}`];
  return readiness.missingItems.length === 0
    ? catalog["workspace.readiness.ready"]
    : catalog["workspace.readiness.needs_attention"];
}

function formatDate(locale: Locale, value: string): string {
  return new Intl.DateTimeFormat(localeMetadata[locale].dateLocale, {
    dateStyle: "medium",
    timeZone: "Asia/Riyadh",
  }).format(new Date(value));
}

function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(localeMetadata[locale].dateLocale).format(value);
}

function createTechnicalText(value: string) {
  return createElement(BidiText, { kind: "code", children: value });
}
