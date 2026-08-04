export function TaskCalendar({
  catalog,
  items,
  onSelect,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  items: readonly import("@evaluation/contracts").WorkItemDetail[];
  onSelect: (id: string) => void;
}>) {
  const groups = new Map<string, import("@evaluation/contracts").WorkItemDetail[]>();
  for (const item of items) {
    const key = item.dueAt?.slice(0, 10) ?? catalog["tasks.noDueDate"];
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return (
    <div className="taskCalendar">
      {[...groups.entries()].map(([date, entries]) => (
        <section className="calendarDay panel" key={date}>
          <h2>{date}</h2>
          {entries.map((item) => (
            <button
              className="taskCard"
              data-task-id={item.id}
              key={item.id}
              onClick={() => onSelect(item.id)}
              type="button"
            >
              {item.title}
            </button>
          ))}
        </section>
      ))}
      {groups.size === 0 ? <p className="panel emptyRow">{catalog["tasks.empty"]}</p> : null}
    </div>
  );
}
