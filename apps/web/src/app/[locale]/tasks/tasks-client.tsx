"use client";

import { createElement, useEffect, useState } from "react";

import { WebWorkItemSchema } from "../../../platform/task-workspace-contracts";
import { TaskBoard } from "./task-board";
import { TaskCalendar } from "./task-calendar";
import { TaskDetailPanel } from "./task-detail-panel";
import { TaskList } from "./task-list";

type Task = import("@evaluation/contracts").WorkItemDetail;
type Layout = "list" | "board" | "calendar";
type View = "my" | "team";

export function buildOfficialTaskCreateBody(input: {
  readonly employeeId: string;
  readonly projectId: string;
  readonly title: string;
}) {
  return {
    title: input.title,
    description: "",
    projectId: input.projectId,
    workstreamId: null,
    assigneeId: input.employeeId,
    dueAt: null,
    priority: "normal" as const,
    requirements: [],
    acceptanceConditions: [],
    blocker: null,
    nextAction: null,
  };
}

export function TasksClient({
  catalog,
  draftOwnerId,
  initialItems,
  initialLayout,
  initialSelectedId = null,
  initialView,
  locale,
  projects,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  draftOwnerId: string;
  initialItems: readonly Task[];
  initialLayout: Layout;
  initialSelectedId?: string | null;
  initialView: View;
  locale: import("@evaluation/localization").Locale;
  projects: readonly { id: string; name: string }[];
}>) {
  const [items, setItems] = useState([...initialItems]);
  const [layout, setLayout] = useState<Layout>(initialLayout);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const selected = items.find(({ id }) => id === selectedId) ?? null;
  const draftStorageKey = `daily-work.task-draft:${draftOwnerId}`;

  useEffect(() => {
    try {
      window.localStorage.removeItem("daily-work.task-draft");
      const stored = window.localStorage.getItem(draftStorageKey);
      if (stored !== null) {
        const parsed = JSON.parse(stored) as { title?: unknown; projectId?: unknown };
        if (typeof parsed.title === "string") setTitle(parsed.title);
        if (
          typeof parsed.projectId === "string" &&
          projects.some(({ id }) => id === parsed.projectId)
        ) {
          setProjectId(parsed.projectId);
        }
      }
    } catch {
      // Ignore a malformed local-only draft and keep the visible fields usable.
    }
    setDraftReady(true);
  }, [draftStorageKey, projects]);

  useEffect(() => {
    if (!draftReady) return;
    if (title === "") {
      window.localStorage.removeItem(draftStorageKey);
      return;
    }
    window.localStorage.setItem(draftStorageKey, JSON.stringify({ title, projectId }));
  }, [draftReady, draftStorageKey, projectId, title]);

  function changeLayout(next: Layout) {
    setLayout(next);
    const url = new URL(window.location.href);
    url.searchParams.set("layout", next);
    window.history.replaceState(null, "", url);
  }

  function select(id: string | null) {
    const previousId = selectedId;
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id === null) url.searchParams.delete("item");
    else url.searchParams.set("item", id);
    window.history.replaceState(null, "", url);
    if (id === null && previousId !== null) {
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>(`[data-task-id="${previousId}"]`)?.focus();
      });
    }
  }

  async function createTask(event: import("react").FormEvent) {
    event.preventDefault();
    if (projectId === "" || title.trim() === "") return;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch("/api/daily-work/work-items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          buildOfficialTaskCreateBody({
            employeeId: draftOwnerId,
            title,
            projectId,
          }),
        ),
      });
      if (!response.ok) throw new Error("task creation failed");
      const created = WebWorkItemSchema.parse(await response.json());
      setItems((current) => [created, ...current]);
      setTitle("");
      window.localStorage.removeItem(draftStorageKey);
      select(created.id);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="taskWorkspace" aria-labelledby="tasks-title">
      <header className="compactPageHeading">
        <div>
          <p className="eyebrow">{catalog["tasks.eyebrow"]}</p>
          <h1 id="tasks-title">{catalog["tasks.titlePage"]}</h1>
          <p>{catalog["tasks.subtitle"]}</p>
        </div>
      </header>

      <form className="taskCreateBar panel" onSubmit={createTask}>
        <label>
          <span>{catalog["tasks.title"]}</span>
          <input
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={catalog["tasks.titlePlaceholder"]}
            value={title}
          />
        </label>
        <label>
          <span>{catalog["tasks.projectRequired"]}</span>
          <select onChange={(event) => setProjectId(event.target.value)} value={projectId}>
            <option value="">{catalog["tasks.selectProject"]}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="primaryAction"
          disabled={busy || title.trim() === "" || projectId === ""}
          type="submit"
        >
          {catalog["tasks.create"]}
        </button>
        {projects.length === 0 ? (
          <p className="formHint">{catalog["tasks.projectMissing"]}</p>
        ) : null}
        {error ? <p className="formError">{catalog["tasks.error"]}</p> : null}
      </form>

      <nav className="taskToolbar" aria-label={catalog["tasks.scopes"]}>
        {(["my", "team"] as const).map((value) => (
          <a
            aria-current={initialView === value ? "page" : undefined}
            className={initialView === value ? "viewButton active" : "viewButton"}
            href={`/${locale}/tasks?view=${value}&layout=${layout}`}
            key={value}
          >
            {catalog[`tasks.scope.${value}`]}
          </a>
        ))}
      </nav>

      <div className="taskToolbar" role="toolbar" aria-label={catalog["tasks.views"]}>
        {(["list", "board", "calendar"] as const).map((value) => (
          <button
            aria-pressed={layout === value}
            className={layout === value ? "viewButton active" : "viewButton"}
            key={value}
            onClick={() => changeLayout(value)}
            type="button"
          >
            {catalog[`tasks.view.${value}`]}
          </button>
        ))}
      </div>

      {layout === "list"
        ? createElement(TaskList, { catalog, items, onSelect: select })
        : layout === "board"
          ? createElement(TaskBoard, { catalog, items, onSelect: select })
          : createElement(TaskCalendar, { catalog, items, onSelect: select })}

      {selected === null
        ? null
        : createElement(TaskDetailPanel, {
            catalog,
            item: selected,
            onClose: () => select(null),
            onUpdated: (updated: Task) => {
              setItems((current) =>
                current.map((item) => (item.id === updated.id ? updated : item)),
              );
            },
          })}
      <a className="quietLink" href={`/${locale}/my-work`}>
        {catalog["tasks.backToday"]}
      </a>
    </section>
  );
}
