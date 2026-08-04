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
  dueAt?: string | undefined;
}>;

export function ActionQueue({
  catalog,
  items,
  locale,
  titleKey,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  items: readonly ManagerOperationItemView[];
  locale: import("@evaluation/localization").Locale;
  titleKey:
    | "managerOps.approvals"
    | "managerOps.blocked"
    | "managerOps.ambiguous"
    | "managerOps.ownership"
    | "managerOps.upcoming";
}>) {
  return (
    <section className="panel managerActionQueue">
      <header className="queueHeader">
        <h2>{catalog[titleKey]}</h2>
        <span className="statusBadge">{items.length}</span>
      </header>
      {items.length === 0 ? (
        <p className="emptyHint">{catalog["managerOps.empty"]}</p>
      ) : (
        <div className="compactActionList">
          {items.map((item) => {
            const href =
              item.detailKey === "approval_waiting"
                ? `/${locale}/projects/${item.projectId}/settings/progress-contract`
                : `/${locale}/projects/${item.projectId}/daily-work`;
            return (
              <article className="compactActionRow managerActionRow" key={item.id}>
                <div>
                  <strong>{item.label ?? item.projectName}</strong>
                  {item.label === undefined ? null : <p>{item.projectName}</p>}
                  <p>{catalog[`managerOps.detail.${item.detailKey}`]}</p>
                  {item.dueAt === undefined ? null : (
                    <time dateTime={item.dueAt}>{formatDateTime(item.dueAt, locale)}</time>
                  )}
                </div>
                <a className="secondaryLink" href={href}>
                  {catalog["managerOps.open"]}
                </a>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
