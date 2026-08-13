/* eslint-disable no-unused-vars */
"use client";

import type { Catalog } from "@evaluation/localization";
import { useState } from "react";

import type {
  WebWorkItem,
  WorkItemContext,
  WorkItemDependencies,
  WorkItemStatus,
} from "../../platform/work-items-api";
import styles from "../../product-ui/work/work-workspace.module.css";

type Prompt = "activity" | "blocked" | "next";

export function TaskContextAssistant({
  catalog,
  context,
  dependencies,
  item,
  onConfirmTransition,
}: Readonly<{
  catalog: Catalog;
  context: WorkItemContext | null;
  dependencies: WorkItemDependencies | null;
  item: WebWorkItem;
  onConfirmTransition?(status: WorkItemStatus): Promise<void>;
}>) {
  const [answer, setAnswer] = useState<Prompt | null>(null);
  const [preparedStatus, setPreparedStatus] = useState<WorkItemStatus | null>(null);
  const [confirming, setConfirming] = useState(false);

  return (
    <section aria-label={catalog["work.assistant.title"]} className={styles.taskAssistant!}>
      <header>
        <div>
          <p>{catalog["work.assistant.label"]}</p>
          <h4>{catalog["work.assistant.title"]}</h4>
        </div>
        <small>{catalog["work.assistant.mode"]}</small>
      </header>
      <div className={styles.taskAssistantPrompts!}>
        <button onClick={() => setAnswer("next")} type="button">
          {catalog["work.assistant.askNext"]}
        </button>
        <button onClick={() => setAnswer("blocked")} type="button">
          {catalog["work.assistant.askBlocked"]}
        </button>
        <button onClick={() => setAnswer("activity")} type="button">
          {catalog["work.assistant.askActivity"]}
        </button>
        {onConfirmTransition === undefined || item.allowedTransitions.length === 0 ? null : (
          <button
            onClick={() => setPreparedStatus(item.allowedTransitions[0] ?? null)}
            type="button"
          >
            {catalog["work.assistant.prepareStatus"]}
          </button>
        )}
      </div>
      {answer === null ? (
        <p className={styles.taskAssistantEmpty!}>{catalog["work.assistant.empty"]}</p>
      ) : (
        <div aria-live="polite" className={styles.taskAssistantAnswer!} role="status">
          <strong>{catalog["work.assistant.answer"]}</strong>
          <p>{answerFor(answer, catalog, context, dependencies, item)}</p>
          <small>{catalog["work.assistant.guardrail"]}</small>
        </div>
      )}
      {preparedStatus === null ? null : (
        <section className={styles.taskAssistantAnswer!}>
          <h5>{catalog["work.assistant.preparedStatus"]}</h5>
          <p>
            {catalog[`myWork.status.${item.status}`]} → {catalog[`myWork.status.${preparedStatus}`]}
          </p>
          <small>{catalog["work.assistant.statusBoundary"]}</small>
          <button
            disabled={confirming}
            onClick={() => {
              if (onConfirmTransition === undefined) return;
              setConfirming(true);
              void onConfirmTransition(preparedStatus)
                .then(() => setPreparedStatus(null))
                .finally(() => setConfirming(false));
            }}
            type="button"
          >
            {catalog["work.assistant.confirmStatus"]}
          </button>
        </section>
      )}
    </section>
  );
}

function answerFor(
  prompt: Prompt,
  catalog: Catalog,
  context: WorkItemContext | null,
  dependencies: WorkItemDependencies | null,
  item: WebWorkItem,
) {
  if (prompt === "next") {
    return item.nextAction ?? catalog["work.assistant.noNextAction"];
  }
  if (prompt === "blocked") {
    const unfinished = dependencies?.dependsOn.filter(({ status }) => status !== "done") ?? [];
    if (unfinished.length > 0) {
      return `${catalog["work.assistant.blockedBy"]} ${unfinished.map(({ title }) => title).join(", ")}.`;
    }
    return item.blocker ?? catalog["work.assistant.notDependencyBlocked"];
  }

  const updates = context?.updates.length ?? 0;
  const evidence = context?.evidence.length ?? 0;
  const base = formatActivitySummary(catalog, updates, evidence);
  const hasSuggestedGitHub =
    context?.evidence.some(({ sourceProvenance }) => sourceProvenance === "github_automated") ??
    false;
  return hasSuggestedGitHub ? `${base} ${catalog["work.assistant.githubSuggested"]}` : base;
}

function formatActivitySummary(catalog: Catalog, updates: number, evidence: number) {
  if (updates === 0 && evidence === 0) return catalog["work.assistant.noActivity"];
  return catalog["work.assistant.activitySummary"]
    .replace("{updates}", String(updates))
    .replace("{evidence}", String(evidence));
}
