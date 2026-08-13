/* eslint-disable no-unused-vars */
"use client";

import type { Catalog, Locale } from "@evaluation/localization";
import { ProductIcon } from "@evaluation/ui";
import { useEffect, useMemo, useRef, useState } from "react";

import { buildWorkGroupModel, buildWorkListModel } from "../../features/work-list/work-list-model";
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
  initialSnapshot,
  initialView,
  locale,
  projects,
}: Readonly<{
  catalog: Catalog;
  currentUserId: string;
  gateway?: WorkWorkspaceGateway;
  initialItems: readonly WebWorkItem[];
  initialSnapshot?: import("@evaluation/contracts").DailyWorkspaceSnapshot;
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
  const detailRequestGeneration = useRef(0);
  const model = useMemo(
    () =>
      buildWorkListModel({ items, projects, unknownProjectLabel: catalog["work.unknownProject"] }),
    [catalog, items, projects],
  );
  const groups = useMemo(
    () =>
      initialSnapshot === undefined
        ? null
        : buildWorkGroupModel({
            items,
            projects,
            snapshot: initialSnapshot,
            unknownProjectLabel: catalog["work.unknownProject"],
          }),
    [catalog, initialSnapshot, items, projects],
  );

  async function load(id: string, generation = ++detailRequestGeneration.current) {
    setDetailState("loading");
    setNotice(null);
    try {
      const loaded = await gateway.load(id);
      if (detailRequestGeneration.current !== generation) return;
      setDetail(loaded);
      setDetailState("ready");
    } catch (error) {
      if (detailRequestGeneration.current !== generation) return;
      setDetail(null);
      setDetailState(
        error instanceof WorkItemGatewayError && error.status === 403 ? "forbidden" : "error",
      );
    }
  }

  useEffect(() => {
    if (selectedId === null) {
      detailRequestGeneration.current += 1;
      setDetail(null);
      return;
    }
    const generation = ++detailRequestGeneration.current;
    void load(selectedId, generation);
  }, [selectedId]);

  useEffect(() => {
    function followUrl() {
      detailRequestGeneration.current += 1;
      setSelectedId(new URL(window.location.href).searchParams.get("item"));
    }
    window.addEventListener("popstate", followUrl);
    return () => window.removeEventListener("popstate", followUrl);
  }, []);

  function select(id: string | null) {
    const previousId = selectedId;
    detailRequestGeneration.current += 1;
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
    const generation = ++detailRequestGeneration.current;
    const transitioningItem = detail;
    setDetailState("transitioning");
    setNotice(null);
    try {
      const updated = await gateway.transition(transitioningItem.id, {
        status,
        expectedVersion: transitioningItem.version,
        reason: catalog["work.transitionReason"],
      });
      if (detailRequestGeneration.current !== generation) return;
      setDetail(updated);
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setDetailState("ready");
    } catch (error) {
      if (detailRequestGeneration.current !== generation) return;
      if (error instanceof WorkItemGatewayError && error.status === 403) {
        setDetail(null);
        setDetailState("forbidden");
        return;
      }
      if (error instanceof WorkItemGatewayError && error.status === 409) {
        try {
          const current = await gateway.load(transitioningItem.id);
          if (detailRequestGeneration.current !== generation) return;
          setDetail(current);
          setItems((items) => items.map((item) => (item.id === current.id ? current : item)));
          setNotice("stale");
          setDetailState("ready");
        } catch {
          if (detailRequestGeneration.current !== generation) return;
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

      <div className={styles.quickActions!}>
        <button
          className={styles.primaryAction!}
          onClick={() => document.getElementById("work-create-title")?.focus()}
          type="button"
        >
          <ProductIcon name="plus" size="small" /> {catalog["work.addTask"]}
        </button>
        <button
          className={styles.secondaryAction!}
          onClick={() =>
            document
              .querySelector<HTMLButtonElement>(
                `[aria-label="${catalog["shell.global.capture"].replaceAll('"', '\\"')}"]`,
              )
              ?.click()
          }
          type="button"
        >
          <ProductIcon name="sparkles" size="small" /> {catalog["work.shareAnything"]}
        </button>
      </div>

      <form className={styles.createBar!} onSubmit={create}>
        <label>
          <span>{catalog["tasks.title"]}</span>
          <input
            id="work-create-title"
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

      {groups !== null ? (
        groups.map((group) => (
          <section
            aria-labelledby={`work-${group.key}`}
            className={styles.listSection!}
            key={group.key}
          >
            <h2 id={`work-${group.key}`}>
              {catalog[`work.group.${group.key}`]}
              <span>{group.items.length}</span>
            </h2>
            {group.items.length === 0 ? (
              <p className={styles.empty!}>{catalog["tasks.empty"]}</p>
            ) : group.collapsed ? (
              <details className={styles.collapsedGroup!}>
                <summary>{catalog["work.showGroup"]}</summary>
                <WorkRows catalog={catalog} items={group.items} onSelect={select} />
              </details>
            ) : (
              <WorkRows catalog={catalog} items={group.items} onSelect={select} />
            )}
          </section>
        ))
      ) : (
        <section aria-labelledby="work-list-heading" className={styles.listSection!}>
          <h2 id="work-list-heading">
            {catalog["work.list"]}
            <span>{model.length}</span>
          </h2>
          {model.length === 0 ? (
            <p className={styles.empty!}>{catalog["tasks.empty"]}</p>
          ) : (
            <WorkRows catalog={catalog} items={model} onSelect={select} />
          )}
        </section>
      )}

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

function WorkRows({
  catalog,
  items,
  onSelect,
}: Readonly<{
  catalog: Catalog;
  items: readonly {
    item: Readonly<{
      description: string;
      id: string;
      nextAction: string | null;
      projectId: string;
      status: WebWorkItem["status"];
      title: string;
    }>;
    projectName: string;
  }[];
  onSelect(id: string): void;
}>) {
  return (
    <ul className={styles.list!}>
      {items.map(({ item, projectName }) => (
        <li key={item.id}>
          <button data-work-item-id={item.id} onClick={() => onSelect(item.id)} type="button">
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
  );
}
