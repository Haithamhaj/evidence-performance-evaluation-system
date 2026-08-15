/* eslint-disable no-unused-vars */
import { ProductIcon } from "@evaluation/ui";
import type { Catalog } from "@evaluation/localization";
import type { EmployeeInsightsV1 } from "@evaluation/contracts/insights";

import styles from "./insights-workspace.module.css";

type Properties = Readonly<{
  catalog: Catalog;
  insights: EmployeeInsightsV1;
  locale: "ar" | "en";
}>;

export function InsightsWorkspace({ catalog, insights, locale }: Properties) {
  return (
    <section className={styles.workspace!} dir={locale === "ar" ? "rtl" : "ltr"} lang={locale}>
      <header className={styles.header!}>
        <div>
          <p>{catalog["insights.eyebrow"]}</p>
          <h1>{catalog["insights.title"]}</h1>
          <span>{catalog["insights.description"]}</span>
        </div>
        <small>
          {catalog["insights.updated"]}: {formatDate(insights.generatedAt, locale)}
        </small>
      </header>

      <section aria-labelledby="project-insights-title" className={styles.section!}>
        <div className={styles.sectionHeading!}>
          <div>
            <h2 id="project-insights-title">{catalog["insights.projects"]}</h2>
            <p>{catalog["insights.projectsBoundary"]}</p>
          </div>
        </div>
        <div className={styles.projectGrid!}>
          {insights.projects.map((project) => (
            <article className={styles.project!} key={project.id}>
              <header>
                <div>
                  <ProductIcon name="folder" size="medium" />
                  <div>
                    <h3>{project.name}</h3>
                    <span data-health={project.sourceHealth}>
                      {catalog[`insights.sourceHealth.${project.sourceHealth}`]}
                    </span>
                  </div>
                </div>
                <a href={`/${locale}/projects/${project.id}`}>{catalog["insights.openProject"]}</a>
              </header>
              <div className={styles.progressSummary!}>
                <strong>{progressLabel(project.progress, catalog)}</strong>
                {project.progress.state === "accepted" ? (
                  <>
                    <span>{project.progress.percent}%</span>
                    <progress
                      aria-label={`${project.name} ${catalog["insights.confirmedProgress"]}: ${project.progress.percent}%`}
                      max={100}
                      value={project.progress.percent}
                    />
                  </>
                ) : null}
              </div>
              {project.kpi === null ? null : (
                <dl className={styles.kpi!}>
                  <div>
                    <dt>{project.kpi.name}</dt>
                    <dd>
                      {project.kpi.current} {project.kpi.unit}
                    </dd>
                  </div>
                  <div>
                    <dt>{catalog["insights.target"]}</dt>
                    <dd>
                      {project.kpi.target} {project.kpi.unit}
                    </dd>
                  </div>
                </dl>
              )}
              <table aria-label={catalog["insights.projectTable"]} className={styles.table!}>
                <thead>
                  <tr>
                    <th>{catalog["insights.milestone"]}</th>
                    <th>{catalog["insights.state"]}</th>
                    <th>{catalog["insights.progress"]}</th>
                  </tr>
                </thead>
                <tbody>
                  {project.milestones.map((milestone) => (
                    <tr key={milestone.id}>
                      <td>{milestone.name}</td>
                      <td>{catalog[`insights.milestoneState.${milestone.state}`]}</td>
                      <td>{milestone.percent === null ? "—" : `${milestone.percent}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="personal-insights-title" className={styles.section!}>
        <div className={styles.sectionHeading!}>
          <div>
            <h2 id="personal-insights-title">{catalog["insights.personal"]}</h2>
            <p>{catalog["insights.personalBoundary"]}</p>
          </div>
        </div>
        <div className={styles.personalGrid!}>
          <article>
            <h3>{catalog["insights.contributions"]}</h3>
            {insights.personal.confirmedContributions.length === 0 ? (
              <p>{catalog["insights.noContributions"]}</p>
            ) : (
              <ul>
                {insights.personal.confirmedContributions.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.project.name}</strong>
                      <span>{item.workItem?.name ?? catalog["insights.projectContribution"]}</span>
                    </div>
                    <small>
                      {catalog[`insights.source.${item.sourceKind}`]} ·{" "}
                      {formatDate(item.confirmedAt, locale)}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </article>
          <article>
            <h3>{catalog["insights.evaluations"]}</h3>
            <p className={styles.boundary!}>{catalog["insights.evaluationBoundary"]}</p>
            {insights.personal.finalizedEvaluations.length === 0 ? (
              <p>{catalog["insights.noEvaluations"]}</p>
            ) : (
              <ul>
                {insights.personal.finalizedEvaluations.map((item) => (
                  <li key={item.assignmentId}>
                    <div>
                      <strong>{catalog[`insights.cycle.${item.cycle.type}`]}</strong>
                      <span>
                        {formatDate(item.cycle.startsAt, locale)} –{" "}
                        {formatDate(item.cycle.endsAt, locale)}
                      </span>
                    </div>
                    <small>
                      {catalog["insights.finalized"]}: {formatDate(item.finalizedAt, locale)}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      </section>
    </section>
  );
}

function progressLabel(
  progress: EmployeeInsightsV1["projects"][number]["progress"],
  catalog: Catalog,
) {
  return catalog[`insights.progressState.${progress.state}`];
}

function formatDate(value: string, locale: "ar" | "en") {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Riyadh",
  }).format(new Date(value));
}
