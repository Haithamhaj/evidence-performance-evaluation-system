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
  loadWorkItemContext,
  loadWorkItemDependencies,
  replaceWorkItemDependencies,
  transitionWorkItem,
  updateWorkItem,
  type WorkItemContext,
  type WorkItemDependencies,
  type WebWorkItem,
  WorkItemGatewayError,
  type WorkItemStatus,
} from "../../platform/work-items-api";
import styles from "./work-workspace.module.css";

export type WorkWorkspaceGateway = Readonly<{
  create(input: { employeeId: string; projectId: string; title: string }): Promise<WebWorkItem>;
  load(id: string): Promise<WebWorkItem>;
  loadContext(input: { itemId: string; projectId: string }): Promise<WorkItemContext>;
  loadDependencies(id: string): Promise<WorkItemDependencies>;
  replaceDependencies(
    id: string,
    input: { dependsOnWorkItemIds: readonly string[]; expectedVersion: number; reason: string },
  ): Promise<WorkItemDependencies>;
  update(
    id: string,
    input: {
      title: string;
      priority: WebWorkItem["priority"];
      dueAt: string | null;
      expectedVersion: number;
      reason: string;
    },
  ): Promise<WebWorkItem>;
  transition(
    id: string,
    input: { status: WorkItemStatus; expectedVersion: number; reason: string },
  ): Promise<WebWorkItem>;
}>;

const defaultGateway: WorkWorkspaceGateway = {
  create: createWorkItem,
  load: loadWorkItem,
  loadContext: loadWorkItemContext,
  loadDependencies: loadWorkItemDependencies,
  replaceDependencies: replaceWorkItemDependencies,
  transition: transitionWorkItem,
  update: updateWorkItem,
};

export function WorkWorkspace({
  catalog,
  currentUserId,
  gateway = defaultGateway,
  initialCounts,
  initialFilters = { projectId: null, search: null, sort: "due_asc", status: null },
  initialItems,
  initialLayout,
  initialSelectedId = null,
  initialSnapshot,
  initialView,
  locale,
  projects,
}: Readonly<{
  catalog: Catalog;
  currentUserId: string;
  gateway?: WorkWorkspaceGateway;
  initialCounts?: Readonly<Record<WorkItemStatus | "all", number>>;
  initialFilters?: Readonly<{
    projectId: string | null;
    search: string | null;
    sort: "due_asc" | "updated_desc" | "priority_desc";
    status: WorkItemStatus | null;
  }>;
  initialItems: readonly WebWorkItem[];
  initialLayout: "board" | "list";
  initialSnapshot?: import("@evaluation/contracts").DailyWorkspaceSnapshot;
  initialSelectedId?: string | null;
  initialView: "my" | "team";
  locale: Locale;
  projects: readonly { id: string; name: string }[];
}>) {
  const [items, setItems] = useState([...initialItems]);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [detail, setDetail] = useState<WebWorkItem | null>(null);
  const [detailContext, setDetailContext] = useState<WorkItemContext | null>(null);
  const [dependencies, setDependencies] = useState<WorkItemDependencies | null>(null);
  const [contextState, setContextState] = useState<"loading" | "ready" | "error">("loading");
  const [dependencyState, setDependencyState] = useState<"loading" | "ready" | "saving" | "error">(
    "loading",
  );
  const [detailState, setDetailState] = useState<
    "loading" | "ready" | "forbidden" | "error" | "transitioning"
  >("ready");
  const [notice, setNotice] = useState<"stale" | "transition_error" | null>(null);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const [quickDraftReady, setQuickDraftReady] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [boardNotice, setBoardNotice] = useState<"stale" | "error" | null>(null);
  const [filters, setFilters] = useState(initialFilters);
  const detailRequestGeneration = useRef(0);
  const quickDraftKey = `command-brief.quick-task.v1:${currentUserId}`;
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
  const counts = useMemo(() => {
    if (initialCounts !== undefined) return initialCounts;
    return Object.fromEntries(
      ["all", "planned", "ready", "in_progress", "blocked", "in_review", "done", "cancelled"].map(
        (status) => [
          status,
          status === "all" ? items.length : items.filter((item) => item.status === status).length,
        ],
      ),
    ) as Record<WorkItemStatus | "all", number>;
  }, [initialCounts, items]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(quickDraftKey);
      if (stored !== null) {
        const parsed = JSON.parse(stored) as {
          projectId?: unknown;
          title?: unknown;
          version?: unknown;
        };
        if (parsed.version === 1 && typeof parsed.title === "string") setTitle(parsed.title);
        if (
          parsed.version === 1 &&
          typeof parsed.projectId === "string" &&
          projects.some((project) => project.id === parsed.projectId)
        ) {
          setProjectId(parsed.projectId);
        }
      }
    } catch {
      window.localStorage.removeItem(quickDraftKey);
    }
    setQuickDraftReady(true);
  }, [projects, quickDraftKey]);

  useEffect(() => {
    if (!quickDraftReady) return;
    if (title.trim() === "") {
      window.localStorage.removeItem(quickDraftKey);
      return;
    }
    window.localStorage.setItem(quickDraftKey, JSON.stringify({ projectId, title, version: 1 }));
  }, [projectId, quickDraftKey, quickDraftReady, title]);

  function updateFilterUrl(next: typeof filters) {
    setFilters(next);
    const url = new URL(window.location.href);
    for (const key of ["q", "project", "status", "sort", "cursor"]) url.searchParams.delete(key);
    if (next.search !== null && next.search.trim() !== "") url.searchParams.set("q", next.search);
    if (next.projectId !== null) url.searchParams.set("project", next.projectId);
    if (next.status !== null) url.searchParams.set("status", next.status);
    if (next.sort !== "due_asc") url.searchParams.set("sort", next.sort);
    window.history.replaceState(null, "", url);
  }

  function workspaceHref(view: "my" | "team", layout: "board" | "calendar" | "list") {
    const search = new URLSearchParams({ view, layout });
    if (filters.search !== null && filters.search.trim() !== "") search.set("q", filters.search);
    if (filters.projectId !== null) search.set("project", filters.projectId);
    if (filters.status !== null) search.set("status", filters.status);
    if (filters.sort !== "due_asc") search.set("sort", filters.sort);
    return `/${locale}/tasks?${search.toString()}`;
  }

  async function load(id: string, generation = ++detailRequestGeneration.current) {
    setDetailState("loading");
    setContextState("loading");
    setDependencyState("loading");
    setDetailContext(null);
    setDependencies(null);
    setNotice(null);
    try {
      const loaded = await gateway.load(id);
      if (detailRequestGeneration.current !== generation) return;
      setDetail(loaded);
      setDetailState("ready");
      const [contextResult, dependenciesResult] = await Promise.allSettled([
        gateway.loadContext({ itemId: loaded.id, projectId: loaded.projectId }),
        gateway.loadDependencies(loaded.id),
      ]);
      if (detailRequestGeneration.current !== generation) return;
      if (contextResult.status === "fulfilled") {
        setDetailContext(contextResult.value);
        setContextState("ready");
      } else setContextState("error");
      if (dependenciesResult.status === "fulfilled") {
        setDependencies(dependenciesResult.value);
        setDetail((current) =>
          current === null
            ? null
            : { ...current, allowedTransitions: dependenciesResult.value.allowedTransitions },
        );
        setDependencyState("ready");
      } else setDependencyState("error");
    } catch (error) {
      if (detailRequestGeneration.current !== generation) return;
      setDetail(null);
      setDetailContext(null);
      setDependencies(null);
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
      window.localStorage.removeItem(quickDraftKey);
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

  async function moveFromBoard(item: WebWorkItem, status: WorkItemStatus) {
    setBoardNotice(null);
    try {
      const updated = await gateway.transition(item.id, {
        status,
        expectedVersion: item.version,
        reason: catalog["work.transitionReason"],
      });
      setItems((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
    } catch (error) {
      if (error instanceof WorkItemGatewayError && error.status === 409) {
        try {
          const [current, currentDependencies] = await Promise.all([
            gateway.load(item.id),
            gateway.loadDependencies(item.id),
          ]);
          setItems((entries) =>
            entries.map((entry) =>
              entry.id === current.id
                ? { ...current, allowedTransitions: currentDependencies.allowedTransitions }
                : entry,
            ),
          );
          setBoardNotice("stale");
          return;
        } catch {
          setBoardNotice("error");
          return;
        }
      }
      setBoardNotice("error");
    }
  }

  async function update(
    editingItem: Pick<WebWorkItem, "dueAt" | "id" | "priority" | "title" | "version">,
    input: Pick<WebWorkItem, "dueAt" | "priority" | "title">,
  ): Promise<"saved" | "stale" | "forbidden" | "error"> {
    try {
      const updated = await gateway.update(editingItem.id, {
        ...input,
        expectedVersion: editingItem.version,
        reason: catalog["tasks.editReason"],
      });
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      if (detail?.id === updated.id) setDetail(updated);
      setEditingId(null);
      return "saved";
    } catch (error) {
      if (error instanceof WorkItemGatewayError && error.status === 403) return "forbidden";
      if (error instanceof WorkItemGatewayError && error.status === 409) {
        try {
          const current = await gateway.load(editingItem.id);
          setItems((items) => items.map((item) => (item.id === current.id ? current : item)));
          if (detail?.id === current.id) setDetail(current);
          return "stale";
        } catch {
          return "error";
        }
      }
      return "error";
    }
  }

  async function replaceDependencies(dependsOnWorkItemIds: readonly string[]) {
    if (detail === null) return;
    setDependencyState("saving");
    try {
      const result = await gateway.replaceDependencies(detail.id, {
        dependsOnWorkItemIds,
        expectedVersion: detail.version,
        reason: catalog["work.dependencies.reason"],
      });
      setDependencies(result);
      setDetail((current) =>
        current === null
          ? null
          : {
              ...current,
              allowedTransitions: result.allowedTransitions,
              version: result.version,
            },
      );
      setItems((current) =>
        current.map((item) =>
          item.id === result.workItemId ? { ...item, version: result.version } : item,
        ),
      );
      setDependencyState("ready");
    } catch (error) {
      if (error instanceof WorkItemGatewayError && error.status === 409) {
        await load(detail.id);
        return;
      }
      setDependencyState("error");
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
        <p className={styles.createNote!}>
          {title.trim() === "" ? catalog["tasks.quickTaskBoundary"] : catalog["tasks.draftSaved"]}
        </p>
      </form>

      <nav aria-label={catalog["tasks.scopes"]} className={styles.toolbar!}>
        {(["my", "team"] as const).map((view) => (
          <a
            aria-current={initialView === view ? "page" : undefined}
            href={workspaceHref(view, initialLayout)}
            key={view}
          >
            {catalog[`tasks.scope.${view}`]}
          </a>
        ))}
        <span aria-hidden="true" />
        <a
          aria-current={initialLayout === "list" ? "page" : undefined}
          href={workspaceHref(initialView, "list")}
        >
          {catalog["tasks.view.list"]}
        </a>
        <a
          aria-current={initialLayout === "board" ? "page" : undefined}
          href={workspaceHref(initialView, "board")}
        >
          {catalog["tasks.view.board"]}
        </a>
        <a href={workspaceHref(initialView, "calendar")}>{catalog["tasks.view.calendar"]}</a>
      </nav>

      <form action={`/${locale}/tasks`} className={styles.filters!} method="get" role="search">
        <input name="view" type="hidden" value={initialView} />
        <input name="layout" type="hidden" value={initialLayout} />
        <label className={styles.searchField!}>
          <span>{catalog["work.search"]}</span>
          <input
            aria-label={catalog["work.search"]}
            maxLength={200}
            name="q"
            onChange={(event) =>
              updateFilterUrl({ ...filters, search: event.target.value || null })
            }
            placeholder={catalog["work.searchPlaceholder"]}
            type="search"
            value={filters.search ?? ""}
          />
        </label>
        <label>
          <span>{catalog["work.filterProject"]}</span>
          <select
            name="project"
            onChange={(event) =>
              updateFilterUrl({ ...filters, projectId: event.target.value || null })
            }
            value={filters.projectId ?? ""}
          >
            <option value="">{catalog["work.filterAllProjects"]}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{catalog["work.filterStatus"]}</span>
          <select
            name="status"
            onChange={(event) =>
              updateFilterUrl({
                ...filters,
                status: (event.target.value || null) as WorkItemStatus | null,
              })
            }
            value={filters.status ?? ""}
          >
            <option value="">
              {catalog["work.filterAllStatuses"]} ({counts.all})
            </option>
            {(
              [
                "planned",
                "ready",
                "in_progress",
                "blocked",
                "in_review",
                "done",
                "cancelled",
              ] as const
            ).map((status) => (
              <option key={status} value={status}>
                {catalog[`myWork.status.${status}`]} ({counts[status]})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{catalog["work.sort"]}</span>
          <select
            name="sort"
            onChange={(event) =>
              updateFilterUrl({ ...filters, sort: event.target.value as typeof filters.sort })
            }
            value={filters.sort}
          >
            <option value="due_asc">{catalog["work.sort.due_asc"]}</option>
            <option value="updated_desc">{catalog["work.sort.updated_desc"]}</option>
            <option value="priority_desc">{catalog["work.sort.priority_desc"]}</option>
          </select>
        </label>
        <button className={styles.filterAction!} type="submit">
          {catalog["work.applyFilters"]}
        </button>
        <a
          className={styles.clearFilters!}
          href={`/${locale}/tasks?view=${initialView}&layout=${initialLayout}`}
        >
          {catalog["work.clearFilters"]}
        </a>
      </form>

      {boardNotice === null ? null : (
        <p className={styles.alert!} role="alert">
          {catalog[boardNotice === "stale" ? "work.board.stale" : "work.board.error"]}
        </p>
      )}

      {initialLayout === "board" ? (
        <WorkBoard
          catalog={catalog}
          items={items}
          onMove={moveFromBoard}
          onSelect={select}
          projects={projects}
        />
      ) : groups !== null ? (
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
                <WorkRows
                  catalog={catalog}
                  editingId={editingId}
                  items={group.items}
                  onCancelEdit={() => setEditingId(null)}
                  onEdit={setEditingId}
                  onSave={update}
                  onSelect={select}
                />
              </details>
            ) : (
              <WorkRows
                catalog={catalog}
                editingId={editingId}
                items={group.items}
                onCancelEdit={() => setEditingId(null)}
                onEdit={setEditingId}
                onSave={update}
                onSelect={select}
              />
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
            <WorkRows
              catalog={catalog}
              editingId={editingId}
              items={model}
              onCancelEdit={() => setEditingId(null)}
              onEdit={setEditingId}
              onSave={update}
              onSelect={select}
            />
          )}
        </section>
      )}

      {selectedId === null ? null : (
        <TaskDetailDrawer
          catalog={catalog}
          context={detailContext}
          contextState={contextState}
          dependencies={dependencies}
          dependencyCandidates={items.filter(
            (item) => item.projectId === detail?.projectId && item.id !== detail.id,
          )}
          dependencyState={dependencyState}
          item={detail}
          locale={locale}
          notice={notice}
          onClose={() => select(null)}
          onRetry={() => void load(selectedId)}
          onReplaceDependencies={replaceDependencies}
          onTransition={transition}
          state={detailState}
        />
      )}
    </section>
  );
}

const boardStatuses = [
  "planned",
  "ready",
  "in_progress",
  "blocked",
  "in_review",
  "done",
  "cancelled",
] as const;

function WorkBoard({
  catalog,
  items,
  onMove,
  onSelect,
  projects,
}: Readonly<{
  catalog: Catalog;
  items: readonly WebWorkItem[];
  onMove(item: WebWorkItem, status: WorkItemStatus): Promise<void>;
  onSelect(id: string): void;
  projects: readonly { id: string; name: string }[];
}>) {
  return (
    <section aria-label={catalog["work.board.title"]} className={styles.board!}>
      {boardStatuses.map((status) => {
        const statusItems = items.filter((item) => item.status === status);
        return (
          <section className={styles.boardColumn!} key={status}>
            <h2>
              {catalog[`myWork.status.${status}`]} <span>{statusItems.length}</span>
            </h2>
            {statusItems.length === 0 ? (
              <p className={styles.boardEmpty!}>{catalog["work.board.empty"]}</p>
            ) : (
              <ol>
                {statusItems.map((item) => (
                  <li className={styles.boardCard!} key={item.id}>
                    <button
                      className={styles.boardCardOpen!}
                      data-work-item-id={item.id}
                      onClick={() => onSelect(item.id)}
                      type="button"
                    >
                      <strong>{item.title}</strong>
                      <span>
                        {projects.find(({ id }) => id === item.projectId)?.name ??
                          catalog["work.unknownProject"]}
                      </span>
                      {item.nextAction === null ? null : <small>{item.nextAction}</small>}
                    </button>
                    {item.allowedTransitions.length === 0 ? null : (
                      <BoardMove catalog={catalog} item={item} onMove={onMove} />
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </section>
  );
}

function BoardMove({
  catalog,
  item,
  onMove,
}: Readonly<{
  catalog: Catalog;
  item: WebWorkItem;
  onMove(item: WebWorkItem, status: WorkItemStatus): Promise<void>;
}>) {
  const [status, setStatus] = useState(item.allowedTransitions[0] ?? item.status);
  const [moving, setMoving] = useState(false);
  useEffect(() => setStatus(item.allowedTransitions[0] ?? item.status), [item]);
  return (
    <form
      className={styles.boardMove!}
      onSubmit={(event) => {
        event.preventDefault();
        setMoving(true);
        void onMove(item, status).finally(() => setMoving(false));
      }}
    >
      <label>
        <span>{catalog["work.board.moveTo"]}</span>
        <select
          aria-label={`${catalog["work.board.move"]} ${item.title} ${catalog["work.board.to"]}`}
          onChange={(event) => setStatus(event.target.value as WorkItemStatus)}
          value={status}
        >
          {item.allowedTransitions.map((next) => (
            <option key={next} value={next}>
              {catalog[`myWork.status.${next}`]}
            </option>
          ))}
        </select>
      </label>
      <button
        aria-label={`${catalog["work.board.move"]} ${item.title}`}
        disabled={moving}
        type="submit"
      >
        {catalog["work.board.move"]}
      </button>
    </form>
  );
}

function WorkRows({
  catalog,
  editingId,
  items,
  onCancelEdit,
  onEdit,
  onSave,
  onSelect,
}: Readonly<{
  catalog: Catalog;
  editingId: string | null;
  items: readonly {
    item: Pick<
      WebWorkItem,
      | "description"
      | "dueAt"
      | "id"
      | "nextAction"
      | "priority"
      | "projectId"
      | "status"
      | "title"
      | "version"
    > & { allowedActions?: readonly string[] };
    projectName: string;
  }[];
  onCancelEdit(): void;
  onEdit(id: string): void;
  onSave(
    item: Pick<WebWorkItem, "dueAt" | "id" | "priority" | "title" | "version">,
    input: Pick<WebWorkItem, "dueAt" | "priority" | "title">,
  ): Promise<"saved" | "stale" | "forbidden" | "error">;
  onSelect(id: string): void;
}>) {
  function handleKeyDown(event: import("react").KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(
      event.currentTarget
        .closest("ul")
        ?.querySelectorAll<HTMLButtonElement>("[data-work-item-id]") ?? [],
    );
    const index = buttons.indexOf(event.currentTarget);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : event.key === "ArrowDown"
            ? Math.min(index + 1, buttons.length - 1)
            : Math.max(index - 1, 0);
    event.preventDefault();
    buttons[nextIndex]?.focus();
  }

  return (
    <ul className={styles.list!}>
      {items.map(({ item, projectName }) => (
        <li key={item.id}>
          <div className={styles.row!}>
            <button
              className={styles.rowOpen!}
              data-work-item-id={item.id}
              onClick={() => onSelect(item.id)}
              onKeyDown={handleKeyDown}
              type="button"
            >
              <ProductIcon name="briefcase" size="small" />
              <span className={styles.taskCopy!}>
                <strong>{item.title}</strong>
                <span>{item.nextAction ?? item.description}</span>
              </span>
              <span className={styles.project!}>{projectName}</span>
              <span className={styles.status!}>{catalog[`myWork.status.${item.status}`]}</span>
              <ProductIcon name="chevron-down" size="small" />
            </button>
            {item.allowedActions?.includes("edit") === true ? (
              <button
                aria-label={catalog["tasks.editTitle"]}
                className={styles.rowEdit!}
                onClick={() => onEdit(item.id)}
                type="button"
              >
                {catalog["tasks.editTitle"]}
              </button>
            ) : null}
          </div>
          {editingId === item.id ? (
            <InlineTaskEditor
              catalog={catalog}
              item={item}
              onCancel={onCancelEdit}
              onSave={onSave}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function InlineTaskEditor({
  catalog,
  item,
  onCancel,
  onSave,
}: Readonly<{
  catalog: Catalog;
  item: Pick<WebWorkItem, "dueAt" | "id" | "priority" | "title" | "version">;
  onCancel(): void;
  onSave(
    item: Pick<WebWorkItem, "dueAt" | "id" | "priority" | "title" | "version">,
    input: Pick<WebWorkItem, "dueAt" | "priority" | "title">,
  ): Promise<"saved" | "stale" | "forbidden" | "error">;
}>) {
  const [title, setTitle] = useState(item.title);
  const [priority, setPriority] = useState(item.priority);
  const [dueAt, setDueAt] = useState(toLocalDateTime(item.dueAt));
  const [state, setState] = useState<"ready" | "saving" | "stale" | "forbidden" | "error">("ready");

  return (
    <form
      aria-label={catalog["tasks.editTitle"]}
      className={styles.inlineEditor!}
      onSubmit={(event) => {
        event.preventDefault();
        setState("saving");
        void onSave(item, {
          title: title.trim(),
          priority,
          dueAt: dueAt === "" ? null : new Date(dueAt).toISOString(),
        }).then((result) => {
          if (result !== "saved") setState(result);
        });
      }}
    >
      <label>
        <span>{catalog["tasks.title"]}</span>
        <input
          autoFocus
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          value={title}
        />
      </label>
      <label>
        <span>{catalog["tasks.priority"]}</span>
        <select
          onChange={(event) => setPriority(event.target.value as WebWorkItem["priority"])}
          value={priority}
        >
          {(["low", "normal", "high", "urgent"] as const).map((value) => (
            <option key={value} value={value}>
              {catalog[`tasks.priority.${value}`]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{catalog["tasks.dueDateTime"]}</span>
        <input
          onChange={(event) => setDueAt(event.target.value)}
          type="datetime-local"
          value={dueAt}
        />
      </label>
      <div className={styles.inlineActions!}>
        <button
          className={styles.primaryAction!}
          disabled={state === "saving" || title.trim() === ""}
          type="submit"
        >
          {catalog["tasks.saveChanges"]}
        </button>
        <button className={styles.secondaryAction!} onClick={onCancel} type="button">
          {catalog["tasks.cancelEdit"]}
        </button>
      </div>
      {state === "stale" ? (
        <p className={styles.alert!} role="alert">
          {catalog["work.stale"]}
        </p>
      ) : null}
      {state === "forbidden" ? (
        <p className={styles.alert!} role="alert">
          {catalog["work.forbidden"]}
        </p>
      ) : null}
      {state === "error" ? (
        <p className={styles.alert!} role="alert">
          {catalog["tasks.editError"]}
        </p>
      ) : null}
    </form>
  );
}

function toLocalDateTime(value: string | null) {
  if (value === null) return "";
  const date = new Date(value);
  const part = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
}
