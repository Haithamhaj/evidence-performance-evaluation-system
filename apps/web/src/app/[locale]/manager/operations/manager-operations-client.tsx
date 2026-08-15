/* eslint-disable no-unused-vars */
import { createElement } from "react";

import type { WebManagerCoaching } from "../../../../platform/manager-coaching-contracts";
import { actionFor, ActionQueue, type ManagerOperationItemView } from "./action-queue";
import styles from "./manager-operations.module.css";

export type ManagerOperationsView = Readonly<{
  generatedAt: string;
  approvalsWaiting: readonly ManagerOperationItemView[];
  blockedProjects: readonly ManagerOperationItemView[];
  ambiguousProgressEvidence: readonly ManagerOperationItemView[];
  ownershipGaps: readonly ManagerOperationItemView[];
  upcomingCommitments: readonly ManagerOperationItemView[];
  readinessHref: "/manager/readiness";
  evaluationHref: "/manager/evaluations";
  continuityHref: "/continuity";
}>;

export function ManagerOperationsClient({
  catalog,
  coachingView,
  locale,
  view,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  coachingView?: WebManagerCoaching;
  locale: import("@evaluation/localization").Locale;
  view: ManagerOperationsView;
}>) {
  const queues = [
    ["managerOps.approvals", view.approvalsWaiting],
    ["managerOps.blocked", view.blockedProjects],
    ["managerOps.ambiguous", view.ambiguousProgressEvidence],
    ["managerOps.ownership", view.ownershipGaps],
    ["managerOps.upcoming", view.upcomingCommitments],
  ] as const;
  const actionCount = queues.reduce((total, [, items]) => total + items.length, 0);
  const suggestion = queues.flatMap(([, items]) => items)[0];
  const portfolio = [
    ...new Map(
      queues.flatMap(([, items]) => items).map((item) => [item.projectId, item.projectName]),
    ).entries(),
  ];
  return (
    <section
      className={styles.workspace!}
      aria-labelledby="manager-operations-heading"
      data-testid="manager-operations-home"
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <main className={styles.main!}>
        <header className={styles.hero!}>
          <div>
            <p className="eyebrow">{catalog["managerOps.eyebrow"]}</p>
            <h1 id="manager-operations-heading">{catalog["managerOps.title"]}</h1>
            <p>{catalog["managerOps.subtitle"]}</p>
          </div>
          <div className={styles.signals!} aria-label={catalog["managerOps.summary"]}>
            <strong>
              {catalog["managerOps.openActions"].replace("{count}", String(actionCount))}
            </strong>
            <span>
              {catalog["managerOps.projectsNeedAttention"].replace(
                "{count}",
                String(portfolio.length),
              )}
            </span>
            <time dateTime={view.generatedAt}>
              {catalog["managerOps.updated"]} {formatTime(view.generatedAt, locale)}
            </time>
          </div>
        </header>
        <nav className={styles.pathLinks!} aria-label={catalog["managerOps.separatePaths"]}>
          <a className="secondaryLink" href={`/${locale}${view.readinessHref}`}>
            {catalog["managerOps.readiness"]}
          </a>
          <a className="secondaryLink" href={`/${locale}${view.evaluationHref}`}>
            {catalog["managerOps.evaluation"]}
          </a>
          <a className="secondaryLink" href={`/${locale}${view.continuityHref}`}>
            {catalog["managerOps.continuity"]}
          </a>
        </nav>
        <section className={styles.portfolio!} aria-labelledby="manager-portfolio-title">
          <div>
            <p className="eyebrow">{catalog["managerOps.portfolioEyebrow"]}</p>
            <h2 id="manager-portfolio-title">{catalog["managerOps.portfolio"]}</h2>
          </div>
          {portfolio.length === 0 ? (
            <p>{catalog["managerOps.empty"]}</p>
          ) : (
            <ul>
              {portfolio.map(([projectId, projectName]) => (
                <li key={projectId}>
                  <a href={`/${locale}/projects/${projectId}`}>{projectName}</a>
                  <span>
                    {catalog["managerOps.interventions"].replace(
                      "{count}",
                      String(
                        queues
                          .flatMap(([, items]) => items)
                          .filter((item) => item.projectId === projectId).length,
                      ),
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={styles.coaching!} aria-labelledby="manager-coaching-title">
          <div>
            <p className="eyebrow">{catalog["managerOps.coachingEyebrow"]}</p>
            <h2 id="manager-coaching-title">{catalog["managerOps.coachingTitle"]}</h2>
            <p>{catalog["managerOps.coachingBoundary"]}</p>
          </div>
          {(coachingView?.sharedActions.length ?? 0) + (coachingView?.formalPlans.length ?? 0) ===
          0 ? (
            <p>{catalog["managerOps.coachingEmpty"]}</p>
          ) : (
            <ul>
              {coachingView?.sharedActions.map((action) => (
                <li key={action.id}>
                  <div>
                    <strong>{action.title}</strong>
                    <span>{action.employeeName}</span>
                  </div>
                  <details>
                    <summary>{catalog["managerOps.reviewSharedAction"]}</summary>
                    <p>{action.objective}</p>
                  </details>
                </li>
              ))}
              {coachingView?.formalPlans.map((plan) => (
                <li key={plan.id}>
                  <div>
                    <strong>{plan.developmentArea}</strong>
                    <span>{plan.employeeName}</span>
                  </div>
                  <details>
                    <summary>{catalog["managerOps.reviewFormalPlan"]}</summary>
                    <p>{plan.expectedBehavior}</p>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className={styles.queueGrid!}>
          {queues.map(([titleKey, items]) =>
            createElement(ActionQueue, { catalog, items, key: titleKey, locale, styles, titleKey }),
          )}
        </div>
        <p className={styles.boundary!}>{catalog["managerOps.boundary"]}</p>
      </main>
      <aside className={styles.brief!} aria-label={catalog["managerOps.brief"]}>
        {suggestion === undefined ? (
          <>
            <p className="eyebrow">{catalog["managerOps.brief"]}</p>
            <h2>{catalog["managerOps.briefTitle"]}</h2>
            <p>{catalog["managerOps.briefEmpty"]}</p>
          </>
        ) : (
          <>
            <p className="eyebrow">{catalog["managerOps.suggestionLabel"]}</p>
            <h2>
              {catalog["managerOps.suggestionTitle"].replace(
                "{item}",
                suggestion.label ?? suggestion.projectName,
              )}
            </h2>
            <p>{catalog[`managerOps.detail.${suggestion.detailKey}`]}</p>
            <time dateTime={suggestion.observedAt}>
              {catalog["managerOps.updated"]} {formatTime(suggestion.observedAt, locale)}
            </time>
            <a className={styles.primaryAction!} href={actionFor(suggestion, locale).href}>
              {catalog[`managerOps.action.${suggestion.detailKey}`]}
            </a>
            <small>{catalog["managerOps.suggestionBoundary"]}</small>
          </>
        )}
      </aside>
    </section>
  );
}

function formatTime(value: string, locale: "ar" | "en") {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
