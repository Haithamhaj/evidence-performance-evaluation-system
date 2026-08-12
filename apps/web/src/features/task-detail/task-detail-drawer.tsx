/* eslint-disable no-unused-vars */
"use client";

import type { Catalog } from "@evaluation/localization";
import { ProductIcon } from "@evaluation/ui";
import { useEffect, useState } from "react";

import type { WebWorkItem, WorkItemStatus } from "../../platform/work-items-api";
import styles from "../../product-ui/work/work-workspace.module.css";

export function TaskDetailDrawer({
  catalog,
  item,
  notice,
  onClose,
  onRetry,
  onTransition,
  state,
}: Readonly<{
  catalog: Catalog;
  item: WebWorkItem | null;
  notice: "stale" | "transition_error" | null;
  onClose(): void;
  onRetry(): void;
  onTransition(status: WorkItemStatus): Promise<void>;
  state: "loading" | "ready" | "forbidden" | "error" | "transitioning";
}>) {
  const [status, setStatus] = useState<WorkItemStatus>("ready");

  useEffect(() => {
    if (item !== null) setStatus(item.allowedTransitions[0] ?? item.status);
  }, [item?.allowedTransitions, item?.id, item?.status]);

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
