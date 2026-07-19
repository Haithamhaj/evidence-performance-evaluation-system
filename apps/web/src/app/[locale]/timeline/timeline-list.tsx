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
  projectId,
  refreshKey,
  workstreamId,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  locale: import("@evaluation/localization").Locale;
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
        <ol className="timelineList">
          {items.map((item) => (
            <li key={item.id}>
              <span className={`timelineKind timelineKind-${item.kind}`}>
                {catalog[`timeline.${item.kind}`]}
              </span>
              <div>
                <strong dir="auto">{item.title}</strong>
                <p dir="auto">{item.detail}</p>
              </div>
              <time dateTime={item.occurredAt}>
                {new Intl.DateTimeFormat(localeMetadata[locale].dateLocale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: defaultTimeZone,
                }).format(new Date(item.occurredAt))}
              </time>
            </li>
          ))}
        </ol>
      )}
      {nextCursor === null ? null : (
        <button className="quietButton" disabled={loading} onClick={loadMore} type="button">
          {catalog["timeline.loadMore"]}
        </button>
      )}
    </section>
  );
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
