"use client";

import { useEffect, useState } from "react";

import { WebWorkItemSchema } from "../../../platform/task-workspace-contracts";

type Task = import("@evaluation/contracts").WorkItemDetail;

export function TaskDetailPanel({
  catalog,
  item,
  onClose,
  onUpdated,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  item: Task;
  onClose: () => void;
  onUpdated: (item: Task) => void;
}>) {
  const [title, setTitle] = useState(item.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const editable = item.allowedActions.includes("edit");

  useEffect(() => {
    setTitle(item.title);
  }, [item.id, item.title]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  async function save(event: import("react").FormEvent) {
    event.preventDefault();
    if (!editable || title.trim() === "" || title.trim() === item.title) return;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch(`/api/daily-work/work-items/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          expectedVersion: item.version,
          reason: catalog["tasks.editReason"],
        }),
      });
      if (!response.ok) throw new Error("task update failed");
      onUpdated(WebWorkItemSchema.parse(await response.json()));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="drawerBackdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside
        aria-labelledby="task-edit-title"
        aria-modal="true"
        className="workItemDrawer"
        role="dialog"
      >
        <header className="drawerHeader">
          <div>
            <span className={`statusBadge status-${item.status}`}>
              {catalog[`myWork.status.${item.status}`]}
            </span>
            <h2 id="task-edit-title">{catalog["tasks.editTitle"]}</h2>
          </div>
          <button className="quietButton" onClick={onClose} type="button">
            {catalog["actions.close"]}
          </button>
        </header>
        <form onSubmit={save}>
          <label>
            <span>{catalog["tasks.title"]}</span>
            <input
              autoFocus
              disabled={!editable}
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </label>
          <button
            className="primaryAction"
            disabled={busy || !editable || title.trim() === "" || title.trim() === item.title}
            type="submit"
          >
            {catalog["tasks.saveChanges"]}
          </button>
          {error ? <p className="formError">{catalog["tasks.editError"]}</p> : null}
        </form>
        {item.description === "" ? null : <p>{item.description}</p>}
        {item.nextAction === null ? null : (
          <section className="drawerSection">
            <h3>{catalog["myWork.nextAction"]}</h3>
            <p>{item.nextAction}</p>
          </section>
        )}
        {item.blocker === null ? null : (
          <section className="drawerSection blockerSection">
            <h3>{catalog["myWork.blocker"]}</h3>
            <p>{item.blocker}</p>
          </section>
        )}
      </aside>
    </div>
  );
}
