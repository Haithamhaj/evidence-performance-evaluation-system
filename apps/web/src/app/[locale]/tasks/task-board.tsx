const columns = ["planned", "in_progress", "in_review", "done"] as const;

export function TaskBoard({
  catalog,
  items,
  onSelect,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  items: readonly import("@evaluation/contracts").WorkItemDetail[];
  onSelect: (id: string) => void;
}>) {
  return (
    <div className="taskBoard">
      {columns.map((status) => {
        const visible = items.filter((item) =>
          status === "planned"
            ? ["planned", "ready", "blocked"].includes(item.status)
            : item.status === status,
        );
        return (
          <section className="boardColumn panel" key={status}>
            <h2>{catalog[`myWork.status.${status}`]}</h2>
            {visible.map((item) => (
              <button
                className="taskCard"
                data-task-id={item.id}
                key={item.id}
                onClick={() => onSelect(item.id)}
                type="button"
              >
                <strong>{item.title}</strong>
                <span>{catalog[`myWork.status.${item.status}`]}</span>
              </button>
            ))}
          </section>
        );
      })}
    </div>
  );
}
