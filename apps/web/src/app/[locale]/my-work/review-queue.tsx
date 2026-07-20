export function ReviewQueue({
  catalog,
  items,
  onSelect,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  items: readonly import("@evaluation/contracts").WorkItemDetail[];
  onSelect: (id: string) => void;
}>) {
  return (
    <section className="compactQueue panel">
      <h2>{catalog["today.reviewQueue"]}</h2>
      {items.length === 0 ? (
        <p className="emptyRow">{catalog["today.reviewQueueEmpty"]}</p>
      ) : (
        <ul className="workItemList">
          {items.map((item) => (
            <li className="workItemRow" key={item.id}>
              <button className="rowButton" onClick={() => onSelect(item.id)} type="button">
                <span className="rowMain">
                  <strong>{item.title}</strong>
                </span>
                <span className={`statusBadge status-${item.status}`}>
                  {catalog[`myWork.status.${item.status}`]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
