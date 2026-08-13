/* eslint-disable no-unused-vars */
"use client";

import type { Catalog } from "@evaluation/localization";
import { ProductIcon } from "@evaluation/ui";
import { useEffect, useState } from "react";

import type {
  WebWorkItem,
  WorkItemContext,
  WorkItemDependencies,
  WorkItemStatus,
} from "../../platform/work-items-api";
import styles from "../../product-ui/work/work-workspace.module.css";

export function TaskDetailDrawer({
  catalog,
  context,
  contextState,
  dependencies,
  dependencyCandidates,
  dependencyState,
  item,
  locale,
  notice,
  onClose,
  onRetry,
  onReplaceDependencies,
  onTransition,
  state,
}: Readonly<{
  catalog: Catalog;
  context: WorkItemContext | null;
  contextState: "loading" | "ready" | "error";
  dependencies: WorkItemDependencies | null;
  dependencyCandidates: readonly Pick<WebWorkItem, "id" | "status" | "title">[];
  dependencyState: "loading" | "ready" | "saving" | "error";
  item: WebWorkItem | null;
  locale: "ar" | "en";
  notice: "stale" | "transition_error" | null;
  onClose(): void;
  onRetry(): void;
  onReplaceDependencies(ids: readonly string[]): Promise<void>;
  onTransition(status: WorkItemStatus): Promise<void>;
  state: "loading" | "ready" | "forbidden" | "error" | "transitioning";
}>) {
  const [status, setStatus] = useState<WorkItemStatus>("ready");
  const [editingDependencies, setEditingDependencies] = useState(false);
  const [selectedDependencies, setSelectedDependencies] = useState<readonly string[]>([]);

  useEffect(() => {
    if (item !== null) setStatus(item.allowedTransitions[0] ?? item.status);
  }, [item?.allowedTransitions, item?.id, item?.status]);

  useEffect(() => {
    setSelectedDependencies(dependencies?.dependsOn.map(({ id }) => id) ?? []);
  }, [dependencies]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className={styles.backdrop!}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside
        aria-label={catalog["work.details"]}
        aria-modal="true"
        className={styles.drawer!}
        role="dialog"
      >
        <header className={styles.drawerHeader!}>
          <div>
            <p>{catalog["work.eyebrow"]}</p>
            <h2>{catalog["work.details"]}</h2>
          </div>
          <button autoFocus aria-label={catalog["actions.close"]} onClick={onClose} type="button">
            <ProductIcon name="close" />
          </button>
        </header>

        {state === "loading" ? <p aria-busy="true">{catalog["work.loadingDetails"]}</p> : null}
        {state === "forbidden" ? <p role="alert">{catalog["work.forbidden"]}</p> : null}
        {state === "error" ? (
          <div role="alert">
            <p>{catalog["work.loadError"]}</p>
            <button className={styles.secondaryAction!} onClick={onRetry} type="button">
              {catalog["actions.retry"]}
            </button>
          </div>
        ) : null}

        {item === null ? null : (
          <div className={styles.drawerBody!}>
            <span className={styles.status!}>{catalog[`myWork.status.${item.status}`]}</span>
            <h3>{item.title}</h3>
            {item.description === "" ? null : <p>{item.description}</p>}
            {item.nextAction === null ? null : (
              <section>
                <h4>{catalog["myWork.nextAction"]}</h4>
                <p>{item.nextAction}</p>
              </section>
            )}
            {item.blocker === null ? null : (
              <section>
                <h4>{catalog["myWork.blocker"]}</h4>
                <p>{item.blocker}</p>
              </section>
            )}
            {item.requirements.length === 0 ? null : (
              <section>
                <h4>{catalog["work.requirements"]}</h4>
                <ul>
                  {item.requirements.map((value) => (
                    <li key={value}>{value}</li>
                  ))}
                </ul>
              </section>
            )}
            {item.acceptanceConditions.length === 0 ? null : (
              <section>
                <h4>{catalog["work.acceptance"]}</h4>
                <ul>
                  {item.acceptanceConditions.map((value) => (
                    <li key={value}>{value}</li>
                  ))}
                </ul>
              </section>
            )}
            <section className={styles.taskDependencies!}>
              <div className={styles.taskContextHeading!}>
                <h4>{catalog["work.dependencies.title"]}</h4>
                {item.allowedActions.includes("edit") && dependencyCandidates.length > 0 ? (
                  <button
                    className={styles.linkButton!}
                    onClick={() => setEditingDependencies((value) => !value)}
                    type="button"
                  >
                    {editingDependencies
                      ? catalog["actions.cancel"]
                      : catalog["work.dependencies.edit"]}
                  </button>
                ) : null}
              </div>
              {dependencyState === "loading" ? (
                <p aria-busy="true">{catalog["work.dependencies.loading"]}</p>
              ) : dependencyState === "error" ? (
                <p role="status">{catalog["work.dependencies.error"]}</p>
              ) : dependencies === null ? null : (
                <>
                  <p
                    className={
                      dependencies.readiness === "blocked_by_dependency"
                        ? styles.dependencyBlocked!
                        : styles.dependencyReady!
                    }
                  >
                    {catalog[`work.dependencies.${dependencies.readiness}`]}
                  </p>
                  {dependencies.dependsOn.length === 0 ? (
                    <p>{catalog["work.dependencies.none"]}</p>
                  ) : (
                    <DependencyList
                      catalog={catalog}
                      items={dependencies.dependsOn}
                      title={catalog["work.dependencies.dependsOn"]}
                    />
                  )}
                  {dependencies.blocks.length > 0 ? (
                    <DependencyList
                      catalog={catalog}
                      items={dependencies.blocks}
                      title={catalog["work.dependencies.blocks"]}
                    />
                  ) : null}
                </>
              )}
              {editingDependencies ? (
                <form
                  className={styles.dependencyEditor!}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void onReplaceDependencies(selectedDependencies).then(() =>
                      setEditingDependencies(false),
                    );
                  }}
                >
                  <fieldset>
                    <legend>{catalog["work.dependencies.choose"]}</legend>
                    {dependencyCandidates.map((candidate) => (
                      <label key={candidate.id}>
                        <input
                          checked={selectedDependencies.includes(candidate.id)}
                          onChange={(event) =>
                            setSelectedDependencies((current) =>
                              event.target.checked
                                ? [...current, candidate.id]
                                : current.filter((id) => id !== candidate.id),
                            )
                          }
                          type="checkbox"
                        />
                        <span>{candidate.title}</span>
                      </label>
                    ))}
                  </fieldset>
                  <button
                    className={styles.primaryAction!}
                    disabled={dependencyState === "saving"}
                    type="submit"
                  >
                    {catalog["actions.save"]}
                  </button>
                </form>
              ) : null}
            </section>
            <section className={styles.taskContext!}>
              <div className={styles.taskContextHeading!}>
                <h4>{catalog["work.context.title"]}</h4>
                <a href={`/${locale}/projects/${item.projectId}`}>
                  {catalog["work.context.openProject"]}
                </a>
              </div>
              <p className={styles.contextNote!}>{catalog["work.context.note"]}</p>
              {contextState === "loading" ? (
                <p aria-busy="true">{catalog["work.context.loading"]}</p>
              ) : contextState === "error" ? (
                <p role="status">{catalog["work.context.error"]}</p>
              ) : context === null ||
                (context.updates.length === 0 && context.evidence.length === 0) ? (
                <p>{catalog["work.context.empty"]}</p>
              ) : (
                <div className={styles.contextGroups!}>
                  <ContextGroup
                    catalog={catalog}
                    entries={context.updates}
                    title={catalog["work.context.updates"]}
                  />
                  <ContextGroup
                    catalog={catalog}
                    entries={context.evidence}
                    title={catalog["work.context.evidence"]}
                  />
                </div>
              )}
            </section>
            {notice === "stale" ? (
              <p className={styles.alert!} role="alert">
                {catalog["work.stale"]}
              </p>
            ) : null}
            {notice === "transition_error" ? (
              <p className={styles.alert!} role="alert">
                {catalog["work.transitionError"]}
              </p>
            ) : null}
            {item.allowedActions.includes("transition") && item.allowedTransitions.length > 0 ? (
              <form
                className={styles.transition!}
                onSubmit={(event) => {
                  event.preventDefault();
                  void onTransition(status);
                }}
              >
                <label>
                  <span>{catalog["work.newStatus"]}</span>
                  <select
                    onChange={(event) => setStatus(event.target.value as WorkItemStatus)}
                    value={status}
                  >
                    {item.allowedTransitions.map((value) => (
                      <option key={value} value={value}>
                        {catalog[`myWork.status.${value}`]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className={styles.primaryAction!}
                  disabled={state === "transitioning"}
                  type="submit"
                >
                  {catalog["work.changeStatus"]}
                </button>
              </form>
            ) : null}
          </div>
        )}
      </aside>
    </div>
  );
}

function DependencyList({
  catalog,
  items,
  title,
}: Readonly<{
  catalog: Catalog;
  items: WorkItemDependencies["dependsOn"];
  title: string;
}>) {
  return (
    <div className={styles.dependencyList!}>
      <h5>{title}</h5>
      <ul>
        {items.map((entry) => (
          <li key={entry.id}>
            <span>{entry.title}</span>
            <small>{catalog[`myWork.status.${entry.status}`]}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContextGroup({
  catalog,
  entries,
  title,
}: Readonly<{
  catalog: Catalog;
  entries: WorkItemContext["evidence"];
  title: string;
}>) {
  if (entries.length === 0) return null;
  return (
    <section className={styles.contextGroup!}>
      <h5>
        {title} <span>{entries.length}</span>
      </h5>
      <ul>
        {entries.map((entry) => (
          <li key={entry.id}>
            <strong>{entry.title}</strong>
            <span>{entry.detail}</span>
            <small>
              {entry.sourceProvenance === "github_automated"
                ? catalog["work.context.githubSuggested"]
                : entry.reviewState === "employee_confirmed"
                  ? catalog["work.context.employeeConfirmed"]
                  : catalog["work.context.recorded"]}
            </small>
          </li>
        ))}
      </ul>
    </section>
  );
}
