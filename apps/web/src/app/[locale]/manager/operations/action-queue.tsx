import { formatDateTime } from "@evaluation/localization";

export type ManagerOperationItemView = Readonly<{
  id: string;
  projectId: string;
  projectName: string;
  label?: string | undefined;
  detailKey:
    | "approval_waiting"
    | "project_paused"
    | "progress_source_ambiguous"
    | "ownership_missing"
    | "commitment_upcoming";
  observedAt: string;
  dueAt?: string | undefined;
}>;

export function ActionQueue({
  catalog,
  items,
  locale,
  styles,
  titleKey,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  items: readonly ManagerOperationItemView[];
  locale: import("@evaluation/localization").Locale;
  styles: Readonly<Record<string, string | undefined>>;
  titleKey:
    | "managerOps.approvals"
    | "managerOps.blocked"
    | "managerOps.ambiguous"
    | "managerOps.ownership"
    | "managerOps.upcoming";
}>) {
  return (
    <section
      className={styles.queue!}
      id={titleKey === "managerOps.approvals" ? "manager-queue-approvals" : undefined}
    >
      <header className="queueHeader">
        <h2>{catalog[titleKey]}</h2>
        <span className="statusBadge">{items.length}</span>
      </header>
      {items.length === 0 ? (
        <p className="emptyHint">{catalog["managerOps.empty"]}</p>
      ) : (
        <div className={styles.queueList!}>
          {items.map((item) => {
            const action = actionFor(item, locale);
            return (
              <article className={styles.queueItem!} key={item.id}>
                <div className={styles.queueSummary!}>
                  <strong>{item.label ?? item.projectName}</strong>
                  {item.label === undefined ? null : <p>{item.projectName}</p>}
                  <p>{catalog[`managerOps.detail.${item.detailKey}`]}</p>
                  {item.dueAt === undefined ? null : (
                    <time dateTime={item.dueAt}>{formatDateTime(item.dueAt, locale)}</time>
                  )}
                  <span>{catalog["managerOps.reviewDetail"]}</span>
                </div>
                <details className={styles.detail!}>
                  <summary>{catalog["managerOps.reviewDetail"]}</summary>
                  <dl>
                    <div>
                      <dt>{catalog["managerOps.source"]}</dt>
                      <dd>{catalog[`managerOps.source.${item.detailKey}`]}</dd>
                    </div>
                    <div>
                      <dt>{catalog["managerOps.why"]}</dt>
                      <dd>{catalog[`managerOps.detail.${item.detailKey}`]}</dd>
                    </div>
                    <div>
                      <dt>{catalog["managerOps.freshness"]}</dt>
                      <dd>{formatDateTime(item.observedAt, locale)}</dd>
                    </div>
                    <div>
                      <dt>{catalog["managerOps.impact"]}</dt>
                      <dd>{catalog[`managerOps.impact.${item.detailKey}`]}</dd>
                    </div>
                  </dl>
                  <a className={styles.itemAction!} href={action.href}>
                    {catalog[`managerOps.action.${item.detailKey}`]}
                  </a>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function actionFor(item: ManagerOperationItemView, locale: "ar" | "en") {
  if (item.detailKey === "approval_waiting") {
    return { href: `/${locale}/projects/${item.projectId}/settings/progress-contract` };
  }
  if (item.detailKey === "commitment_upcoming") {
    return { href: `/${locale}/tasks?view=my&layout=list&item=${item.id}` };
  }
  return { href: `/${locale}/projects/${item.projectId}` };
}
