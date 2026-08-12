/* eslint-disable no-unused-vars */
"use client";

import type { Catalog, Locale } from "@evaluation/localization";
import { ProductIcon } from "@evaluation/ui";
import { useEffect, useMemo, useState } from "react";

import { buildWorkListModel } from "../../features/work-list/work-list-model";
import { TaskDetailDrawer } from "../../features/task-detail/task-detail-drawer";
import {
  createWorkItem,
  loadWorkItem,
  transitionWorkItem,
  type WebWorkItem,
  WorkItemGatewayError,
  type WorkItemStatus,
} from "../../platform/work-items-api";
import styles from "./work-workspace.module.css";

export type WorkWorkspaceGateway = Readonly<{
  create(input: { employeeId: string; projectId: string; title: string }): Promise<WebWorkItem>;
  load(id: string): Promise<WebWorkItem>;
  transition(
    id: string,
    input: { status: WorkItemStatus; expectedVersion: number; reason: string },
  ): Promise<WebWorkItem>;
}>;

const defaultGateway: WorkWorkspaceGateway = {
  create: createWorkItem,
  load: loadWorkItem,
  transition: transitionWorkItem,
};

export function WorkWorkspace({
  catalog,
  currentUserId,
  gateway = defaultGateway,
  initialItems,
  initialSelectedId = null,
  initialView,
  locale,
  projects,
}: Readonly<{
  catalog: Catalog;
  currentUserId: string;
  gateway?: WorkWorkspaceGateway;
  initialItems: readonly WebWorkItem[];
  initialSelectedId?: string | null;
  initialView: "my" | "team";
  locale: Locale;
  projects: readonly { id: string; name: string }[];
}>) {
  const [items, setItems] = useState([...initialItems]);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [detail, setDetail] = useState<WebWorkItem | null>(null);
  const [detailState, setDetailState] = useState<
    "loading" | "ready" | "forbidden" | "error" | "transitioning"
  >("ready");
  const [notice, setNotice] = useState<"stale" | "transition_error" | null>(null);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const model = useMemo(
    () =>
      buildWorkListModel({ items, projects, unknownProjectLabel: catalog["work.unknownProject"] }),
    [catalog, items, projects],
  );

  async function load(id: string) {
    setDetailState("loading");
    setNotice(null);
    try {
      const loaded = await gateway.load(id);
      setDetail(loaded);
      setDetailState("ready");
    } catch (error) {
      setDetail(null);
      setDetailState(
        error instanceof WorkItemGatewayError && error.status === 403 ? "forbidden" : "error",
      );
    }
  }

  useEffect(() => {
    if (selectedId === null) {
      setDetail(null);
      return;
    }
    void load(selectedId);
  }, [selectedId]);

  useEffect(() => {
    function followUrl() {
      setSelectedId(new URL(window.location.href).searchParams.get("item"));
    }
    window.addEventListener("popstate", followUrl);
    return () => window.removeEventListener("popstate", followUrl);
  }, []);

  function select(id: string | null) {
    const previousId = selectedId;
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id === null) url.searchParams.delete("item");
    else url.searchParams.set("item", id);
    window.history.pushState(null, "", url);
    if (id === null && previousId !== null) {
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>(`[data-work-item-id="${previousId}"]`)?.focus();
      });
    }
  }

  async function create(event: import("react").FormEvent) {
    event.preventDefault();
    if (title.trim() === "" || projectId === "") return;
    setCreating(true);
    setCreateError(false);
    try {
      const created = await gateway.create({
        employeeId: currentUserId,
        projectId,
        title: title.trim(),
      });
      setItems((current) => [created, ...current.filter(({ id }) => id !== created.id)]);
      setTitle("");
      select(created.id);
    } catch {
      setCreateError(true);
    } finally {
      setCreating(false);
    }
  }

  async function transition(status: WorkItemStatus) {
    if (detail === null) return;
    setDetailState("transitioning");
    setNotice(null);
    try {
      const updated = await gateway.transition(detail.id, {
        status,
        expectedVersion: detail.version,
        reason: catalog["work.transitionReason"],
      });
      setDetail(updated);
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setDetailState("ready");
    } catch (error) {
      if (error instanceof WorkItemGatewayError && error.status === 403) {
        setDetail(null);
        setDetailState("forbidden");
        return;
      }
      if (error instanceof WorkItemGatewayError && error.status === 409) {
        try {
          const current = await gateway.load(detail.id);
          setDetail(current);
          setItems((items) => items.map((item) => (item.id === current.id ? current : item)));
          setNotice("stale");
          setDetailState("ready");
        } catch {
          setDetail(null);
          setDetailState("error");
        }
        return;
      }
      setNotice("transition_error");
      setDetailState("ready");
    }
  }

  return (
    <section
      aria-label={catalog["work.title"]}
      className={styles.workspace!}
      dir={locale === "ar" ? "rtl" : "ltr"}
      lang={locale}
    >
      <header className={styles.heading!}>
        <p>{catalog["work.eyebrow"]}</p>
        <h1>{catalog["work.title"]}</h1>
        <span>{catalog["work.subtitle"]}</span>
      </header>

      <form className={styles.createBar!} onSubmit={create}>
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
          className={styles.primaryAction!}
          disabled={creating || title.trim() === "" || projectId === ""}
          type="submit"
        >
          <ProductIcon name="plus" size="small" /> {catalog["tasks.create"]}
        </button>
        {createError ? (
          <p className={styles.alert!} role="alert">
            {catalog["tasks.error"]}
          </p>
        ) : null}
      </form>

      <nav aria-label={catalog["tasks.scopes"]} className={styles.toolbar!}>
        {(["my", "team"] as const).map((view) => (
          <a
            aria-current={initialView === view ? "page" : undefined}
            href={`/${locale}/tasks?view=${view}&layout=list`}
            key={view}
          >
            {catalog[`tasks.scope.${view}`]}
          </a>
        ))}
        <span aria-hidden="true" />
        <a aria-current="page" href={`/${locale}/tasks?view=${initialView}&layout=list`}>
          {catalog["tasks.view.list"]}
        </a>
        <a href={`/${locale}/tasks?view=${initialView}&layout=board`}>
          {catalog["tasks.view.board"]}
        </a>
        <a href={`/${locale}/tasks?view=${initialView}&layout=calendar`}>
          {catalog["tasks.view.calendar"]}
        </a>
      </nav>

      <section aria-labelledby="work-list-heading" className={styles.listSection!}>
        <h2 id="work-list-heading">
          {catalog["work.list"]}
          <span>{items.length}</span>
        </h2>
        {model.length === 0 ? (
          <p className={styles.empty!}>{catalog["tasks.empty"]}</p>
        ) : (
          <ul className={styles.list!}>
            {model.map(({ item, projectName }) => (
              <li key={item.id}>
                <button data-work-item-id={item.id} onClick={() => select(item.id)} type="button">
                  <ProductIcon name="briefcase" size="small" />
                  <span className={styles.taskCopy!}>
                    <strong>{item.title}</strong>
                    <span>{item.nextAction ?? item.description}</span>
                  </span>
                  <span className={styles.project!}>{projectName}</span>
                  <span className={styles.status!}>{catalog[`myWork.status.${item.status}`]}</span>
                  <ProductIcon name="chevron-down" size="small" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedId === null ? null : (
        <TaskDetailDrawer
          catalog={catalog}
          item={detail}
          notice={notice}
          onClose={() => select(null)}
          onRetry={() => void load(selectedId)}
          onTransition={transition}
          state={detailState}
        />
      )}
    </section>
  );
}
