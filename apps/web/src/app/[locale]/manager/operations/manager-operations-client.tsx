import { createElement } from "react";

import { ActionQueue, type ManagerOperationItemView } from "./action-queue";

export type ManagerOperationsView = Readonly<{
  approvalsWaiting: readonly ManagerOperationItemView[];
  blockedProjects: readonly ManagerOperationItemView[];
  ambiguousProgressEvidence: readonly ManagerOperationItemView[];
  ownershipGaps: readonly ManagerOperationItemView[];
  upcomingCommitments: readonly ManagerOperationItemView[];
  readinessHref: "/manager/readiness";
  evaluationHref: "/manager/evaluations";
}>;

export function ManagerOperationsClient({
  catalog,
  locale,
  view,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
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
  return (
    <section className="dailyWorkPage" aria-labelledby="manager-operations-heading">
      <header className="compactPageHeading">
        <div>
          <p className="eyebrow">{catalog["managerOps.eyebrow"]}</p>
          <h1 id="manager-operations-heading">{catalog["managerOps.title"]}</h1>
          <p>{catalog["managerOps.subtitle"]}</p>
        </div>
      </header>
      <nav className="managerPathLinks" aria-label={catalog["managerOps.separatePaths"]}>
        <a className="secondaryLink" href={`/${locale}${view.readinessHref}`}>
          {catalog["managerOps.readiness"]}
        </a>
        <a className="secondaryLink" href={`/${locale}${view.evaluationHref}`}>
          {catalog["managerOps.evaluation"]}
        </a>
      </nav>
      <div className="managerQueueGrid">
        {queues.map(([titleKey, items]) =>
          createElement(ActionQueue, { catalog, items, key: titleKey, locale, titleKey }),
        )}
      </div>
      <p className="boundaryNote">{catalog["managerOps.boundary"]}</p>
    </section>
  );
}
