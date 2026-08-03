"use client";

import { defaultTimeZone, localeMetadata } from "@evaluation/localization";
import { useEffect, useState } from "react";

import {
  TimelineResponseSchema,
  type TimelineItem,
} from "../../../platform/updates-evidence-contracts";

export function TimelineList({
  catalog,
  locale,
  onReviewGitHubSuggestion,
  projectId,
  refreshKey,
  workstreamId,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  locale: import("@evaluation/localization").Locale;
  onReviewGitHubSuggestion?: (item: TimelineItem, sourceEventId: string) => void;
  projectId: string;
  refreshKey: number;
  workstreamId: string | null;
}>) {
  const [items, setItems] = useState<readonly TimelineItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadPage(projectId, workstreamId, null)
      .then((response) => {
        if (!active) return;
        setItems(response.items);
        setNextCursor(response.nextCursor);
      })
      .catch(() => {
        if (!active) return;
        setItems([]);
        setNextCursor(null);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [projectId, refreshKey, workstreamId]);

  async function loadMore() {
    if (nextCursor === null) return;
    setLoading(true);
    try {
      const response = await loadPage(projectId, workstreamId, nextCursor);
      setItems((current) => [...current, ...response.items]);
      setNextCursor(response.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="timelinePanel" aria-labelledby="timeline-heading">
      <h3 id="timeline-heading">{catalog["timeline.title"]}</h3>
      {loading && items.length === 0 ? (
        <p aria-live="polite">{catalog["timeline.loading"]}</p>
      ) : items.length === 0 ? (
        <p>{catalog["timeline.empty"]}</p>
      ) : (
        <TimelineItems
          catalog={catalog}
          items={items}
          locale={locale}
          {...(onReviewGitHubSuggestion === undefined ? {} : { onReviewGitHubSuggestion })}
        />
      )}
      {nextCursor === null ? null : (
        <button className="quietButton" disabled={loading} onClick={loadMore} type="button">
          {catalog["timeline.loadMore"]}
        </button>
      )}
    </section>
  );
}

export function TimelineItems({
  catalog,
  items,
  locale,
  onReviewGitHubSuggestion,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  items: readonly TimelineItem[];
  locale: import("@evaluation/localization").Locale;
  onReviewGitHubSuggestion?: (item: TimelineItem, sourceEventId: string) => void;
}>) {
  return (
    <ol className="timelineList">
      {items.map((item) => {
        const githubSourceEventId = sourceReferenceId(item.sourceReferences, "github-source-event");
        return (
          <li key={item.id}>
            <div className="timelineLabels">
              <span className={`timelineKind timelineKind-${item.kind}`}>
                {catalog[`timeline.${item.kind}`]}
              </span>
              <span className="timelineSource">
                {catalog[`timeline.source.${item.sourceProvenance}`]}
              </span>
              <span className="timelineReviewState">
                {catalog[`timeline.state.${item.reviewState}`]}
              </span>
            </div>
            <div className="timelineBody">
              <strong dir="auto">{item.title}</strong>
              <p dir="auto">{item.detail}</p>
              <dl className="timelineContext">
                <div>
                  <dt>{catalog["timeline.project"]}</dt>
                  <dd dir="auto">{item.project.name}</dd>
                </div>
                {item.workstream === null ? null : (
                  <div>
                    <dt>{catalog["timeline.workstream"]}</dt>
                    <dd dir="auto">{item.workstream.name}</dd>
                  </div>
                )}
                {item.workItem === null ? null : (
                  <div>
                    <dt>{catalog["timeline.workItem"]}</dt>
                    <dd dir="auto">{item.workItem.title}</dd>
                  </div>
                )}
                {item.relatedKpiComponents.length === 0 ? null : (
                  <div>
                    <dt>{catalog["timeline.kpi"]}</dt>
                    <dd dir="auto">
                      {item.relatedKpiComponents.map((component) => component.name).join(" · ")}
                    </dd>
                  </div>
                )}
                {item.relatedCriteria.length === 0 ? null : (
                  <div>
                    <dt>{catalog["timeline.criterion"]}</dt>
                    <dd dir="auto">
                      {item.relatedCriteria.map((criterion) => criterion.name).join(" · ")}
                    </dd>
                  </div>
                )}
                {item.verificationState === null ? null : (
                  <div>
                    <dt>{catalog["timeline.verification"]}</dt>
                    <dd>{catalog[`evidence.verification.${item.verificationState}`]}</dd>
                  </div>
                )}
                {item.decisionOutcome === null ? null : (
                  <div>
                    <dt>{catalog["timeline.decisionOutcome"]}</dt>
                    <dd>{catalog[`timeline.decisionOutcome.${item.decisionOutcome}`]}</dd>
                  </div>
                )}
              </dl>
            </div>
            <time dateTime={item.occurredAt}>
              {new Intl.DateTimeFormat(localeMetadata[locale].dateLocale, {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: defaultTimeZone,
              }).format(new Date(item.occurredAt))}
            </time>
            {item.kind === "project_fact" &&
            githubSourceEventId !== null &&
            onReviewGitHubSuggestion ? (
              <button
                className="secondaryAction"
                onClick={() => onReviewGitHubSuggestion(item, githubSourceEventId)}
                type="button"
              >
                {catalog["timeline.reviewGitHubSuggestion"]}
              </button>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function sourceReferenceId(references: readonly string[], kind: string): string | null {
  const prefix = `${kind}:`;
  const reference = references.find((value) => value.startsWith(prefix));
  return reference?.slice(prefix.length) ?? null;
}

async function loadPage(projectId: string, workstreamId: string | null, cursor: string | null) {
  const query = new URLSearchParams({ projectId, limit: "10" });
  if (workstreamId !== null) query.set("workstreamId", workstreamId);
  if (cursor !== null) query.set("cursor", cursor);
  const response = await fetch(`/api/daily-work/timeline?${query.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("timeline");
  return TimelineResponseSchema.parse(await response.json());
}
