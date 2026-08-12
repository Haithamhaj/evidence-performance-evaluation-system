/* eslint-disable no-unused-vars */
"use client";

import { localeMetadata, type Catalog, type Locale } from "@evaluation/localization";
import { ProductIcon } from "@evaluation/ui";
import { useEffect, useMemo, useState } from "react";

import { PreparedExperienceCard } from "../../features/prepared-decision/prepared-experience-card";
import {
  ProjectDecisionCard,
  type DecisionGateway,
} from "../../features/prepared-decision/project-decision-card";
import { buildTodayModel } from "../../features/today/today-model";
import {
  confirmProjectSuggestion,
  correctProjectSuggestion,
  dismissProjectSuggestion,
  listContextReviewQueue,
  type ContextReviewQueue,
} from "../../platform/context-intelligence-api";
import { loadPreparedExperience } from "../../platform/experience-orchestration-api";
import type { WebPreparedExperienceComposition } from "../../platform/experience-orchestration-contracts";
import styles from "./intelligent-today.module.css";

export type IntelligentTodayGateway = DecisionGateway &
  Readonly<{
    loadDecisionQueue(): Promise<ContextReviewQueue>;
    loadPrepared(): Promise<WebPreparedExperienceComposition>;
  }>;

const defaultGateway: IntelligentTodayGateway = {
  confirm: confirmProjectSuggestion,
  correct: correctProjectSuggestion,
  dismiss: dismissProjectSuggestion,
  loadDecisionQueue: listContextReviewQueue,
  loadPrepared: loadPreparedExperience,
};

export function IntelligentToday({
  catalog,
  gateway = defaultGateway,
  locale,
  onTaskSelect,
  snapshot,
}: Readonly<{
  catalog: Catalog;
  gateway?: IntelligentTodayGateway;
  locale: Locale;
  onTaskSelect(id: string): void;
  snapshot: import("@evaluation/contracts").DailyWorkspaceSnapshot;
}>) {
  const [queue, setQueue] = useState<ContextReviewQueue | null>(null);
  const [prepared, setPrepared] = useState<WebPreparedExperienceComposition | null>(null);
  const [loadingError, setLoadingError] = useState(false);
  const [notice, setNotice] = useState("");
  const model = useMemo(() => buildTodayModel(snapshot), [snapshot]);

  async function load() {
    setLoadingError(false);
    const [decisionResult, preparedResult] = await Promise.allSettled([
      gateway.loadDecisionQueue(),
      gateway.loadPrepared(),
    ]);
    if (decisionResult.status === "fulfilled") setQueue(decisionResult.value);
    else setLoadingError(true);
    if (preparedResult.status === "fulfilled") setPrepared(preparedResult.value);
    else setLoadingError(true);
  }

  useEffect(() => {
    void load();
  }, [gateway]);

  const decision = queue?.items.find((item) => item.kind === "project_match") ?? null;
  const preparedItem = prepared?.items[0] ?? null;
  const direction = localeMetadata[locale].direction;

  return (
    <section
      aria-labelledby="intelligent-today-title"
      className={styles.today!}
      dir={direction}
      lang={locale}
    >
      <header className={styles.heading!}>
        <p>{catalog["today.intelligent.eyebrow"]}</p>
        <h1 id="intelligent-today-title">{catalog["today.intelligent.title"]}</h1>
        <span>{catalog["today.intelligent.subtitle"]}</span>
      </header>

      <p aria-live="polite" className={styles.notice!} role="status">
        {notice}
      </p>

      {queue === null && !loadingError ? (
        <p aria-busy="true" className={styles.loading!}>
          {catalog["today.intelligent.loading"]}
        </p>
      ) : null}

      {loadingError ? (
        <div className={styles.recovery!} role="alert">
          <p>{catalog["today.intelligent.loadError"]}</p>
          <button className={styles.secondaryButton!} onClick={() => void load()} type="button">
            {catalog["actions.retry"]}
          </button>
        </div>
      ) : null}

      {decision === null ? null : (
        <section aria-labelledby="today-needs-decision" className={styles.zone!}>
          <h2 className={`${styles.zoneLabel!} ${styles.decisionLabel!}`} id="today-needs-decision">
            {catalog["today.intelligent.needsDecision"]}
          </h2>
          <ProjectDecisionCard
            catalog={catalog}
            gateway={gateway}
            onDecided={async (kind) => {
              setNotice(
                kind === "dismissed"
                  ? catalog["today.intelligent.dismissed"]
                  : catalog["today.intelligent.decisionSaved"],
              );
              const refreshed = await gateway.loadDecisionQueue();
              setQueue(refreshed);
            }}
            onReload={async () => {
              const refreshed = await gateway.loadDecisionQueue();
              setQueue(refreshed);
            }}
            projects={queue?.projects ?? []}
            suggestion={decision}
          />
        </section>
      )}

      {preparedItem === null ? null : (
        <PreparedExperienceCard catalog={catalog} item={preparedItem} />
      )}

      {model.clear && decision === null && preparedItem === null && queue !== null ? (
        <section className={styles.clear!}>
          <ProductIcon name="check" size="large" />
          <div>
            <h2>{catalog["today.intelligent.clearTitle"]}</h2>
            <p>{catalog["today.intelligent.clearBody"]}</p>
          </div>
        </section>
      ) : null}

      {model.sections.map((section) => (
        <section
          aria-labelledby={`today-${section.key}`}
          className={styles.zone!}
          key={section.key}
        >
          <h2
            className={`${styles.zoneLabel!} ${styles[`${section.key}Label`]!}`}
            id={`today-${section.key}`}
          >
            {catalog[`myWork.group.${section.key}`]}
            <span>{section.items.length}</span>
          </h2>
          {section.items.length === 0 ? null : (
            <ul className={styles.taskList!}>
              {section.items.map(({ item, projectName }) => (
                <li key={item.id}>
                  <button
                    className={styles.taskRow!}
                    data-task-id={item.id}
                    onClick={() => onTaskSelect(item.id)}
                    type="button"
                  >
                    <span className={styles.checkbox!} aria-hidden="true" />
                    <span className={styles.taskCopy!}>
                      <strong>{item.title}</strong>
                      <span>{item.nextAction ?? item.description}</span>
                    </span>
                    <span className={styles.project!}>{projectName}</span>
                    <span className={styles.status!}>
                      {catalog[`myWork.status.${item.status}`]}
                    </span>
                    <ProductIcon name="chevron-down" size="small" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </section>
  );
}
