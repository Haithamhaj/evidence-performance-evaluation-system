import { defaultTimeZone, localeMetadata } from "@evaluation/localization";

type Item = import("@evaluation/contracts").WorkItemDetail;

export function DailyBrief({
  catalog,
  locale,
  needsMyAction,
  onSelect,
  overdue,
  single = false,
  today,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  locale: keyof typeof localeMetadata;
  needsMyAction: readonly Item[];
  onSelect: (id: string) => void;
  overdue: readonly Item[];
  single?: boolean;
  today: readonly Item[];
}>) {
  const sections = single
    ? [{ key: "needs_my_action" as const, items: needsMyAction }]
    : [
        { key: "needs_my_action" as const, items: needsMyAction },
        { key: "today" as const, items: today },
        { key: "overdue" as const, items: overdue },
      ];
  return (
    <div className={single ? "singleBrief" : "dailyBriefGrid"}>
      {sections.map((section) => (
        <section className="workGroup panel" key={section.key}>
          {single ? null : (
            <h2>
              {catalog[`myWork.group.${section.key}`]} <span>{section.items.length}</span>
            </h2>
          )}
          <ul className="workItemList">
            {section.items.length === 0 ? (
              <li className="emptyRow">{catalog["myWork.empty"]}</li>
            ) : (
              section.items.map((item) => (
                <li className="workItemRow" key={item.id}>
                  <button
                    className="rowButton"
                    data-task-id={item.id}
                    onClick={() => onSelect(item.id)}
                    type="button"
                  >
                    <span className="rowMain">
                      <strong>{item.title}</strong>
                      <span>{item.nextAction ?? item.description}</span>
                    </span>
                    <span className={`statusBadge status-${item.status}`}>
                      {catalog[`myWork.status.${item.status}`]}
                    </span>
                    {item.dueAt === null ? null : (
                      <time dateTime={item.dueAt}>
                        {new Intl.DateTimeFormat(localeMetadata[locale].dateLocale, {
                          day: "numeric",
                          month: "short",
                          timeZone: defaultTimeZone,
                        }).format(new Date(item.dueAt))}
                      </time>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
