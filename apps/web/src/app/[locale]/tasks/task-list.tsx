export function TaskList({
  catalog,
  items,
  onSelect,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  items: readonly import("@evaluation/contracts").WorkItemDetail[];
  onSelect: (id: string) => void;
}>) {
  return (
    <section className="panel taskView">
      <ul className="workItemList">
        {items.length === 0 ? (
          <li className="emptyRow">{catalog["tasks.empty"]}</li>
        ) : (
          items.map((item) => (
            <li className="workItemRow" key={item.id}>
              <button
                className="rowButton"
                data-task-id={item.id}
                onClick={() => onSelect(item.id)}
                type="button"
              >
                <span className="rowMain">
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </span>
                <span className={`statusBadge status-${item.status}`}>
                  {catalog[`myWork.status.${item.status}`]}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
