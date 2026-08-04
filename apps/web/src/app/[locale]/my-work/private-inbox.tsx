"use client";

import { useState } from "react";

import {
  WebPrivateInboxItemSchema,
  WebWorkItemSchema,
} from "../../../platform/task-workspace-contracts";

type InboxItem = import("@evaluation/contracts").PrivateInboxItem;

export function PrivateInbox({
  catalog,
  initialItems,
  projects,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  initialItems: readonly InboxItem[];
  projects: readonly { id: string; name: string }[];
}>) {
  const [items, setItems] = useState([...initialItems]);
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<InboxItem | null>(null);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function capture(event: import("react").FormEvent) {
    event.preventDefault();
    if (text.trim() === "") return;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch("/api/daily-work/private-inbox", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, projectId: null }),
      });
      if (!response.ok) throw new Error("capture failed");
      const item = WebPrivateInboxItemSchema.parse(await response.json());
      setItems((current) => [item, ...current]);
      setText("");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function promote(event: import("react").FormEvent) {
    event.preventDefault();
    if (selected === null || projectId === "" || title.trim() === "") return;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch(`/api/daily-work/private-inbox/${selected.id}/promote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          description: selected.text,
          projectId,
          workstreamId: null,
          assigneeId: selected.employeeId,
          dueAt: null,
          priority: "normal",
          requirements: [],
          acceptanceConditions: [],
          blocker: null,
          nextAction: null,
          expectedVersion: selected.version,
          reason: catalog["inbox.promotionReason"],
        }),
      });
      if (!response.ok) throw new Error("promotion failed");
      WebWorkItemSchema.parse(await response.json());
      setItems((current) => current.filter(({ id }) => id !== selected.id));
      setSelected(null);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  function review(item: InboxItem) {
    setSelected(item);
    setTitle(item.text.slice(0, 200));
    setProjectId(item.projectId ?? projects[0]?.id ?? "");
  }

  return (
    <section className="quickCapture panel" aria-labelledby="quick-capture-title">
      <div className="quickCaptureHeading">
        <div>
          <h2 id="quick-capture-title">{catalog["inbox.quickCapture"]}</h2>
          <p>{catalog["inbox.quickCaptureHint"]}</p>
        </div>
        <span className="countBadge">{items.length}</span>
      </div>
      <form className="quickCaptureForm" onSubmit={capture}>
        <label className="visuallyHidden" htmlFor="quick-capture-text">
          {catalog["inbox.quickCapture"]}
        </label>
        <input
          id="quick-capture-text"
          maxLength={4000}
          onChange={(event) => setText(event.target.value)}
          placeholder={catalog["inbox.placeholder"]}
          value={text}
        />
        <button className="primaryAction" disabled={busy || text.trim() === ""} type="submit">
          {catalog["inbox.capture"]}
        </button>
      </form>
      {error ? <p className="formError">{catalog["inbox.error"]}</p> : null}
      {items.length === 0 ? null : (
        <ul className="inboxList">
          {items.map((item) => (
            <li key={item.id}>
              <span>{item.text}</span>
              <button className="quietButton" onClick={() => review(item)} type="button">
                {catalog["inbox.turnIntoTask"]}
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected === null ? null : (
        <div className="drawerBackdrop">
          <aside
            aria-labelledby="inbox-review-title"
            aria-modal="true"
            className="workItemDrawer"
            role="dialog"
          >
            <header className="drawerHeader">
              <div>
                <p className="eyebrow">{catalog["inbox.reviewDraft"]}</p>
                <h2 id="inbox-review-title">{catalog["tasks.create"]}</h2>
              </div>
              <button className="quietButton" onClick={() => setSelected(null)} type="button">
                {catalog["actions.close"]}
              </button>
            </header>
            <form className="taskForm" onSubmit={promote}>
              <label>
                {catalog["tasks.title"]}
                <input
                  maxLength={200}
                  onChange={(event) => setTitle(event.target.value)}
                  value={title}
                />
              </label>
              <label>
                {catalog["tasks.projectRequired"]}
                <select
                  onChange={(event) => setProjectId(event.target.value)}
                  required
                  value={projectId}
                >
                  <option value="">{catalog["tasks.selectProject"]}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="boundaryNote">{catalog["inbox.confirmRequired"]}</p>
              <button
                className="primaryAction"
                disabled={busy || projectId === "" || title.trim() === ""}
                type="submit"
              >
                {catalog["tasks.create"]}
              </button>
            </form>
          </aside>
        </div>
      )}
    </section>
  );
}
