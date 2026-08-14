/* eslint-disable no-unused-vars */
import type { Catalog } from "@evaluation/localization";
import { ProductDisclosure, ProductIcon } from "@evaluation/ui";
import type { CSSProperties } from "react";

import { buildProjectExperienceModel } from "../../features/project-experience/project-experience-model";
import styles from "./project-workspace.module.css";

type Experience = import("@evaluation/contracts/employee-experience").EmployeeProjectExperienceV1;

export function ProjectWorkspace({
  catalog,
  experience,
  locale,
}: Readonly<{ catalog: Catalog; experience: Experience; locale: "ar" | "en" }>) {
  const model = buildProjectExperienceModel(experience);
  const copy = buildCopy(catalog);
  return (
    <section
      className={styles.workspace!}
      data-testid="project-workspace"
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <main className={styles.main!}>
        <nav className={styles.breadcrumbs!} aria-label={copy.breadcrumbs}>
          <a href={`/${locale}/my-work`}>{copy.home}</a>
          <span>/</span>
          <a href={`/${locale}/projects`}>{copy.projects}</a>
          <span>/</span>
          <span>{model.project.name}</span>
        </nav>
        <header className={styles.projectHeader!}>
          <span className={styles.projectIcon!}>
            <ProductIcon name="folder" size="large" />
          </span>
          <div>
            <h1>{model.project.name}</h1>
            <p>{model.project.description}</p>
            <small>
              {model.document
                ? `${copy.grounded} ${model.document.title} v${model.document.version}`
                : copy.documentMissing}
            </small>
          </div>
          {model.document ? (
            <a href={localizedHref(model.document.href, locale)}>{copy.openDocument}</a>
          ) : null}
        </header>

        <nav className={styles.workspaceNav!} aria-label={copy.workspaceNav}>
          <a aria-current="page" href="#overview">
            {copy.overview}
          </a>
          <a href="#plan">{copy.plan}</a>
          <a href={`/${locale}/tasks?view=my&layout=list&project=${model.project.id}`}>
            {copy.work}
          </a>
          <a href="#progress">{copy.progressNav}</a>
          <a href="#timeline">{copy.timelineNav}</a>
        </nav>

        <section id="overview" className={styles.overviewSummary!} aria-label={copy.atGlance}>
          <h2 className={styles.visuallyHidden!}>{copy.overview}</h2>
          <dl>
            <div>
              <dt>{copy.currentStage}</dt>
              <dd>{model.overview.current?.name ?? copy.notAvailable}</dd>
            </div>
            <div>
              <dt>{copy.nextStage}</dt>
              <dd>{model.overview.next?.name ?? copy.notAvailable}</dd>
            </div>
            <div>
              <dt>{copy.activeBlocker}</dt>
              <dd>
                {model.overview.blocker ? (
                  model.overview.blocker.href ? (
                    <a href={localizedHref(model.overview.blocker.href, locale)}>
                      {model.overview.blocker.title}
                    </a>
                  ) : (
                    model.overview.blocker.title
                  )
                ) : (
                  copy.noActiveBlocker
                )}
              </dd>
            </div>
            <div>
              <dt>{copy.latestChange}</dt>
              <dd>
                {model.overview.latestChange ? (
                  <a href={localizedHref(model.overview.latestChange.href, locale)}>
                    {model.overview.latestChange.title}
                  </a>
                ) : (
                  copy.notAvailable
                )}
              </dd>
            </div>
            <div>
              <dt>{copy.nextAction}</dt>
              <dd>
                {model.overview.nextAction ? (
                  <a href={localizedHref(model.overview.nextAction.href, locale)}>
                    {model.overview.nextAction.label}
                  </a>
                ) : (
                  copy.notAvailable
                )}
              </dd>
            </div>
          </dl>
        </section>
        <section id="progress" className={styles.progressPanel!} aria-label={copy.progress}>
          <div className={styles.progressBlock!}>
            <div
              className={styles.progressRing!}
              role="img"
              aria-label={copy.confirmedProgress.replace("{value}", model.progress.label)}
              style={
                model.progress.value === null
                  ? undefined
                  : ({ "--progress": `${model.progress.value}%` } as CSSProperties)
              }
            >
              <strong>{model.progress.label}</strong>
            </div>
            <div>
              <strong>{copy.progress}</strong>
              <small>{copy.contractBased}</small>
            </div>
          </div>
          <div className={styles.milestones!}>
            {model.milestones.slice(0, 3).map((milestone) => (
              <div
                data-state={milestone.state}
                className={styles.milestone!}
                key={milestone.componentId}
              >
                <span>
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
            {model.kpi ? (
              <>
                <span>{model.kpi.name}</span>
                <strong>{formatKpi(model.kpi)}</strong>
                <small>
                  {copy.target}: {model.kpi.target}
                  {model.kpi.unit}
                </small>
              </>
            ) : (
              <>
                <strong>{copy.noKpi}</strong>
                <small>{copy.noKpiDetail}</small>
              </>
            )}
          </div>
          <a
            className={styles.progressAction!}
            href={`/${locale}/projects/${model.project.id}/settings/progress-contract`}
          >
            {copy.reviewContract}
          </a>
        </section>

        <section id="plan" className={styles.plan!}>
          <header>
            <h2>{copy.plan}</h2>
            <p>{model.project.description}</p>
            {model.plan.ownerName ? (
              <p>
                {copy.owner}: <strong>{model.plan.ownerName}</strong>
              </p>
            ) : null}
            <p>
              {copy.planSource}: {model.plan.document?.title ?? copy.documentMissing}
            </p>
          </header>
          <div className={styles.planContent!}>
            <section>
              <h3>{copy.workstreams}</h3>
              {model.plan.workstreams.length === 0 ? (
                <p>{copy.noWorkstreams}</p>
              ) : (
                <ul className={styles.workstreamList!}>
                  {model.plan.workstreams.map((workstream) => (
                    <li key={workstream.id}>
                      <ProductIcon name="folder" size="small" />
                      <a
                        href={`/${locale}/projects/${model.project.id}/workstreams/${workstream.id}`}
                      >
                        {workstream.name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h3>{copy.milestonePlan}</h3>
              {model.plan.milestones.length === 0 ? (
                <p>{copy.notAvailable}</p>
              ) : (
                <ol className={styles.planMilestones!}>
                  {model.plan.milestones.map((milestone) => (
                    <li key={milestone.componentId} data-state={milestone.state}>
                      <span>{milestone.state === "complete" ? "✓" : ""}</span>
                      <strong>{milestone.name}</strong>
                      <small>{copy[milestone.state]}</small>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </section>

        <section className={styles.attention!}>
          <h2>{copy.attention}</h2>
          {model.attention.length === 0 ? (
            <p>{copy.noAttention}</p>
          ) : (
            <ul>
              {model.attention.map((item) => (
                <li key={item.id}>
                  <ProductIcon name="help" size="small" />
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.subtitle}</span>
                  </div>
                  {item.href ? <a href={localizedHref(item.href, locale)}>{copy.open}</a> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.collections!}>
          <h2>{copy.workEvidence}</h2>
          <div className={styles.tabs!}>
            {(["work", "updates", "evidence", "documents"] as const).map((key) => (
              <a href={`#${key}`} key={key}>
                {copy[key]} <span>{model.collections[key].length}</span>
              </a>
            ))}
          </div>
          <div className={styles.collectionGrid!}>
            {(["work", "updates", "evidence", "documents"] as const).map((key) => (
              <section id={key} key={key}>
                <h3>{copy[key]}</h3>
                {model.collections[key].length === 0 ? (
                  <p>{copy.empty}</p>
                ) : (
                  <ul>
                    {model.collections[key].slice(0, 3).map((item) => (
                      <li key={item.id}>
                        <ProductIcon
                          name={
                            key === "work" ? "check" : key === "documents" ? "document" : "sparkles"
                          }
                          size="small"
                        />
                        <div>
                          <strong>{item.title}</strong>
                          <span>{item.subtitle}</span>
                        </div>
                        {item.href ? (
                          <a href={localizedHref(item.href, locale)}>{copy.open}</a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </section>

        <section id="timeline" className={styles.timeline!}>
          <h2>{copy.timeline}</h2>
          {model.timeline.length === 0 ? (
            <p>{copy.empty}</p>
          ) : (
            <ol>
              {model.timeline.map((item) => (
                <li key={item.id}>
                  <time dateTime={item.occurredAt}>{formatDate(item.occurredAt, locale)}</time>
                  <span className={styles.timelineMarker!}>
                    <ProductIcon name="check" size="small" />
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <span>
                      {item.statusLabel} · {item.source.label}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
      <aside className={styles.assistant!} aria-label={copy.assistant}>
        <header>
          <ProductIcon name="sparkles" size="small" />
          <strong>{copy.assistant}</strong>
        </header>
        {model.smartBrief ? (
          <>
            <p className={styles.eyebrow!}>SMART BRIEF</p>
            <h2>{model.smartBrief.title}</h2>
            <p>{model.smartBrief.body}</p>
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
            <ProductDisclosure title={copy.howCalculated}>
              <p>{model.smartBrief.consequence}</p>
            </ProductDisclosure>
          </>
        ) : (
          <p>{copy.empty}</p>
        )}
      </aside>
    </section>
  );
}

function buildCopy(catalog: Catalog) {
  return {
    breadcrumbs: catalog["project.experience.breadcrumbs"],
    workspaceNav: catalog["project.experience.workspaceNav"],
    overview: catalog["project.experience.overview"],
    plan: catalog["project.experience.plan"],
    progressNav: catalog["project.experience.progressNav"],
    timelineNav: catalog["project.experience.timelineNav"],
    workstreams: catalog["project.experience.workstreams"],
    noWorkstreams: catalog["project.experience.noWorkstreams"],
    owner: catalog["project.experience.owner"],
    reviewContract: catalog["project.experience.reviewContract"],
    home: catalog["project.experience.home"],
    projects: catalog["project.experience.projects"],
    grounded: catalog["project.experience.grounded"],
    documentMissing: catalog["project.experience.documentMissing"],
    openDocument: catalog["project.experience.openDocument"],
    progress: catalog["project.experience.progress"],
    confirmedProgress: catalog["project.experience.confirmedProgress"],
    contractBased: catalog["project.experience.contractBased"],
    target: catalog["project.experience.target"],
    noKpi: catalog["project.experience.noKpi"],
    noKpiDetail: catalog["project.experience.noKpiDetail"],
    attention: catalog["project.experience.attention"],
    noAttention: catalog["project.experience.noAttention"],
    open: catalog["project.experience.open"],
    workEvidence: catalog["project.experience.workEvidence"],
    work: catalog["project.experience.work"],
    updates: catalog["project.experience.updates"],
    evidence: catalog["project.experience.evidence"],
    documents: catalog["project.experience.documents"],
    empty: catalog["project.experience.empty"],
    timeline: catalog["project.experience.timeline"],
    atGlance: catalog["project.experience.atGlance"],
    currentStage: catalog["project.experience.currentStage"],
    nextStage: catalog["project.experience.nextStage"],
    activeBlocker: catalog["project.experience.activeBlocker"],
    latestChange: catalog["project.experience.latestChange"],
    nextAction: catalog["project.experience.nextAction"],
    notAvailable: catalog["project.experience.notAvailable"],
    noActiveBlocker: catalog["project.experience.noActiveBlocker"],
    milestonePlan: catalog["project.experience.milestonePlan"],
    planSource: catalog["project.experience.planSource"],
    assistant: catalog["home.overview.assistant"],
    suggestedAction: catalog["home.overview.suggestedAction"],
    source: catalog["home.overview.source"],
    howCalculated: catalog["home.overview.howCalculated"],
    complete: catalog["home.overview.complete"],
    current: catalog["home.overview.current"],
    next: catalog["home.overview.next"],
    awaiting_evidence: catalog["home.overview.awaitingEvidence"],
    not_started: catalog["home.overview.notStarted"],
  } as const;
}
function localizedHref(href: string, locale: "ar" | "en") {
  return href.replace(/^\/(?:ar|en)(?=\/)/u, `/${locale}`);
}
function formatKpi(kpi: NonNullable<Experience["kpi"]>) {
  const unit = kpi.unit.trim();
  return ["flow", "flows", "source", "sources"].includes(unit.toLowerCase())
    ? `${kpi.current}/${kpi.target}`
    : `${kpi.current}${unit === "%" ? unit : ` ${unit}`}`;
}
function formatDate(value: string, locale: "ar" | "en") {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
