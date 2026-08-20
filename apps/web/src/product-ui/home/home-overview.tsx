/* eslint-disable no-unused-vars */
import { ProductDisclosure, ProductIcon } from "@evaluation/ui";
import type { Catalog } from "@evaluation/localization";
import type { EmployeeHomeV1 } from "@evaluation/contracts";
import type { CSSProperties } from "react";

import { buildHomeOverviewModel } from "../../features/home-overview/home-overview-model";
import styles from "./home-overview.module.css";

type Properties = Readonly<{
  home: EmployeeHomeV1;
  catalog: Catalog;
  locale: "ar" | "en";
}>;

export function HomeOverview({ catalog, home, locale }: Properties) {
  const model = buildHomeOverviewModel(home);
  const copy = buildCopy(catalog);
  return (
    <section
      className={styles.home!}
      data-testid="home-overview"
      dir={locale === "ar" ? "rtl" : "ltr"}
      lang={locale}
    >
      <main className={styles.main!}>
        <header className={styles.hero!}>
          <p>
            {copy.today} / {formatDate(model.generatedAt, locale)}
          </p>
          <h1>{copy.greeting.replace("{name}", model.greetingName)}</h1>
          <span>{model.smartBrief?.body ?? copy.subtitle}</span>
          <ul className={styles.signals!} aria-label={copy.signals}>
            <li>
              <ProductIcon name="help" size="small" />
              {copy.decisions.replace("{count}", String(model.signals.decisions))}
            </li>
            <li>
              <ProductIcon name="calendar" size="small" />
              {copy.due.replace("{count}", String(model.signals.dueToday))}
            </li>
            <li>
              <ProductIcon name="check" size="small" />
              {copy.changes.replace("{count}", String(model.signals.verifiedChanges))}
            </li>
          </ul>
        </header>

        <section aria-labelledby="project-journey-title" className={styles.journey!}>
          <div className={styles.sectionHeading!}>
            <h2 id="project-journey-title">{copy.projectJourney}</h2>
            <p>
              <ProductIcon name="check" size="small" /> {copy.progressRule}
            </p>
          </div>
          <div className={styles.projectList!}>
            {model.projects.map((project) => (
              <article aria-label={project.name} className={styles.project!} key={project.id}>
                <div className={styles.projectIdentity!}>
                  <span className={styles.projectIcon!}>
                    <ProductIcon name="folder" size="large" />
                  </span>
                  <div>
                    <h3>{project.name}</h3>
                    <a href={`/${locale}/projects/${project.id}`}>{copy.openWorkspace}</a>
                  </div>
                </div>
                <ProgressRing
                  ariaLabel={copy.confirmedProgress.replace("{value}", project.progress.label)}
                  contractBasedLabel={copy.contractBased}
                  progress={project.progress}
                />
                <div className={styles.milestones!}>
                  {project.milestones.slice(0, 3).map((milestone) => (
                    <div
                      className={styles.milestone!}
                      data-state={milestone.state}
                      key={milestone.componentId}
                    >
                      <span className={styles.milestoneMarker!} aria-hidden="true">
                        {milestone.state === "complete" ? (
                          <ProductIcon name="check" size="small" />
                        ) : null}
                      </span>
                      <strong>{milestone.name}</strong>
                      <small>{copy[milestone.state]}</small>
                    </div>
                  ))}
                </div>
                <div className={styles.kpi!}>
                  {project.kpi === null ? (
                    <>
                      <strong>{copy.kpiUnavailable}</strong>
                      <span>{copy.kpiMissing}</span>
                    </>
                  ) : (
                    <>
                      <span>{project.kpi.name}</span>
                      <strong>{formatKpiValue(project.kpi)}</strong>
                      <small>
                        {copy.target}: {formatKpiTarget(project.kpi)}
                      </small>
                    </>
                  )}
                </div>
                <div className={styles.nextAction!}>
                  <span>{copy.nextAction}</span>
                  {project.nextAction === null ? (
                    <strong>{copy.noAction}</strong>
                  ) : (
                    <a href={localizedHref(project.nextAction.href, locale)}>
                      {project.nextAction.label}
                    </a>
                  )}
                  <small>
                    {copy.source}: {project.progressProvenance}
                  </small>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="now-title" className={styles.now!}>
          <h2 id="now-title">{copy.now}</h2>
          {model.now.length === 0 ? (
            <p className={styles.empty!}>{copy.noChanges}</p>
          ) : (
            <ol>
              {model.now.map((item) => (
                <li key={item.id}>
                  <time dateTime={item.occurredAt}>{formatTime(item.occurredAt, locale)}</time>
                  <span className={styles.nowIcon!}>
                    <ProductIcon
                      name={item.kind === "verified_change" ? "check" : "calendar"}
                      size="small"
                    />
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.projectName}</span>
                  </div>
                  <span>{item.statusLabel}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>

      <aside aria-label={copy.assistant} className={styles.assistant!}>
        <header>
          <ProductIcon name="sparkles" size="small" />
          <strong>{copy.assistant}</strong>
        </header>
        {model.smartBrief === null ? (
          <p>{copy.noBrief}</p>
        ) : (
          <>
            <section>
              <p className={styles.eyebrow!}>{copy.smartBrief}</p>
              <h2>{model.smartBrief.title}</h2>
              <p>{model.smartBrief.body}</p>
            </section>
            <section>
              <p className={styles.eyebrow!}>{copy.suggestedAction}</p>
              <p>{model.smartBrief.why}</p>
              <small>
                {copy.source}: {model.smartBrief.source.label}
              </small>
              <a
                className={styles.primaryAction!}
                href={localizedHref(model.smartBrief.action.href, locale)}
              >
                {model.smartBrief.action.label}
              </a>
            </section>
            <ProductDisclosure title={copy.howCalculated}>
              <p>{model.smartBrief.consequence}</p>
            </ProductDisclosure>
          </>
        )}
      </aside>
    </section>
  );
}

function ProgressRing({
  ariaLabel,
  contractBasedLabel,
  progress,
}: Readonly<{
  ariaLabel: string;
  contractBasedLabel: string;
  progress: ReturnType<typeof buildHomeOverviewModel>["projects"][number]["progress"];
}>) {
  const value = progress.kind === "accepted" ? progress.value : null;
  const style = value === null ? undefined : ({ "--progress": `${value}%` } as CSSProperties);
  return (
    <div className={styles.progressBlock!}>
      <div aria-label={ariaLabel} className={styles.progressRing!} role="img" style={style}>
        <span>{progress.label}</span>
      </div>
      <small>{progress.kind === "accepted" ? contractBasedLabel : progress.label}</small>
    </div>
  );
}

function localizedHref(href: string, locale: "ar" | "en") {
  return href.replace(/^\/(?:ar|en)(?=\/)/u, `/${locale}`);
}

function formatDate(value: string, locale: "ar" | "en") {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatTime(value: string, locale: "ar" | "en") {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatUnit(value: string) {
  const unit = value.trim();
  if (unit.length === 0) return "";
  if (["%", "°", "ms"].includes(unit)) return unit;
  return ` ${unit}`;
}

function formatKpiValue(kpi: NonNullable<EmployeeHomeV1["projects"][number]["kpi"]>) {
  const unit = kpi.unit.trim();
  if (["flow", "flows", "source", "sources"].includes(unit.toLowerCase())) {
    return `${kpi.current}/${kpi.target}`;
  }
  return `${kpi.current}${formatUnit(kpi.unit)}`;
}

function formatKpiTarget(kpi: NonNullable<EmployeeHomeV1["projects"][number]["kpi"]>) {
  const unit = kpi.unit.trim();
  if (["flow", "flows", "source", "sources"].includes(unit.toLowerCase()))
    return String(kpi.target);
  return `${kpi.target}${formatUnit(kpi.unit)}`;
}

function buildCopy(catalog: Catalog) {
  return {
    today: catalog["home.overview.today"],
    greeting: catalog["home.overview.greeting"],
    subtitle: catalog["home.overview.subtitle"],
    signals: catalog["home.overview.signals"],
    decisions: catalog["home.overview.decisions"],
    due: catalog["home.overview.due"],
    changes: catalog["home.overview.changes"],
    projectJourney: catalog["home.overview.projectJourney"],
    progressRule: catalog["home.overview.progressRule"],
    openWorkspace: catalog["home.overview.openWorkspace"],
    confirmedProgress: catalog["home.overview.confirmedProgress"],
    complete: catalog["home.overview.complete"],
    current: catalog["home.overview.current"],
    next: catalog["home.overview.next"],
    awaiting_evidence: catalog["home.overview.awaitingEvidence"],
    not_started: catalog["home.overview.notStarted"],
    target: catalog["home.overview.target"],
    kpiUnavailable: catalog["home.overview.kpiUnavailable"],
    kpiMissing: catalog["home.overview.kpiMissing"],
    nextAction: catalog["home.overview.nextAction"],
    noAction: catalog["home.overview.noAction"],
    source: catalog["home.overview.source"],
    now: catalog["home.overview.now"],
    noChanges: catalog["home.overview.noChanges"],
    assistant: catalog["home.overview.assistant"],
    smartBrief: catalog["home.overview.smartBrief"],
    noBrief: catalog["home.overview.noBrief"],
    suggestedAction: catalog["home.overview.suggestedAction"],
    contractBased: catalog["home.overview.contractBased"],
    howCalculated: catalog["home.overview.howCalculated"],
  } as const;
}
