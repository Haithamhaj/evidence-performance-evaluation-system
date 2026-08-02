"use client";

import type { Catalog } from "@evaluation/localization";
import { createElement, useEffect, useState } from "react";

import {
  type ConnectedWorkContext,
  type ConnectedWorkContextItem,
  listConnectedWorkContext,
} from "../../../platform/connected-work-context-api";
import { SourceReviewSheet } from "./source-review-sheet";

type Properties = Readonly<{
  catalog: Catalog;
  projects: readonly ProjectOption[];
  onReviewPrepared?: () => void;
}>;
export type ProjectOption = Readonly<{ id: string; name: string }>;

export function ConnectedContext({ catalog, onReviewPrepared, projects }: Properties) {
  const [context, setContext] = useState<ConnectedWorkContext | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<ConnectedWorkContextItem | null>(null);

  async function refresh() {
    setError(false);
    try {
      setContext(await listConnectedWorkContext());
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  if (selected !== null) {
    return (
      <>
        <ConnectedContextView
          catalog={catalog}
          context={context}
          error={error}
          onReview={setSelected}
          onRetry={refresh}
          projects={projects}
        />
        {createElement(SourceReviewSheet, {
          catalog,
          item: selected,
          projects,
          onClose: () => setSelected(null),
          onChanged: refresh,
          ...(onReviewPrepared === undefined ? {} : { onPrepared: onReviewPrepared }),
        })}
      </>
    );
  }

  return (
    <ConnectedContextView
      catalog={catalog}
      context={context}
      error={error}
      onReview={setSelected}
      onRetry={refresh}
      projects={projects}
    />
  );
}

export function ConnectedContextView({
  catalog,
  context,
  error = false,
  onReview,
  onRetry,
  projects = [],
}: Readonly<{
  catalog: Catalog;
  context: ConnectedWorkContext | null;
  error?: boolean;
  onReview?: (item: ConnectedWorkContextItem) => void;
  onRetry?: () => void;
  projects?: readonly ProjectOption[];
}>) {
  if (error) {
    return (
      <section className="connectedContext panel" aria-labelledby="connected-context-heading">
        <h2 id="connected-context-heading">{catalog["connectedContext.title"]}</h2>
        <p role="alert">{catalog["connectedContext.recovery"]}</p>
        <button className="secondaryAction" onClick={onRetry} type="button">
          {catalog["actions.retry"]}
        </button>
      </section>
    );
  }
  if (context === null) return null;
  return (
    <section className="connectedContext panel" aria-labelledby="connected-context-heading">
      <header className="connectedContextHeader">
        <div>
          <p className="eyebrow">{catalog["connectedContext.privateLabel"]}</p>
          <h2 id="connected-context-heading">{catalog["connectedContext.title"]}</h2>
          <p>{catalog["connectedContext.intro"]}</p>
        </div>
        {context.synthetic ? (
          <span className="syntheticLabel">{catalog["connectedContext.synthetic"]}</span>
        ) : null}
      </header>
      {context.connection.lastSuccessfulSyncAt === null ? null : (
        <p className="formHint">
          {catalog["connectedContext.lastSuccessfulSync"]}:{" "}
          <time dateTime={context.connection.lastSuccessfulSyncAt}>
            {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
              new Date(context.connection.lastSuccessfulSyncAt),
            )}
          </time>
        </p>
      )}
      <ul className="connectedContextList">
        {context.items.map((item) => (
          <li key={item.id}>
            <button className="connectedContextRow" onClick={() => onReview?.(item)} type="button">
              <span>
                <strong dir="auto">{item.title}</strong>
                <small>{catalog[`connectedContext.source.${item.provider}`]}</small>
                {item.summary === null ? null : <small dir="auto">{item.summary}</small>}
              </span>
              <span className="privateBadge">
                {item.excluded
                  ? catalog["connectedContext.excluded"]
                  : catalog["connectedContext.privateLabel"]}
              </span>
              {item.projectId === null ? null : (
                <small className="connectedContextProjectLabel">
                  {projects.find((project) => project.id === item.projectId)?.name ??
                    catalog["connectedContext.linkedProject"]}
                </small>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
