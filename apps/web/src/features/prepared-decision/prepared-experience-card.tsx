/* eslint-disable no-unused-vars */
"use client";

import { ProductIcon } from "@evaluation/ui";
import { useState } from "react";

import type { WebPreparedExperienceItem } from "../../platform/experience-orchestration-contracts";
import styles from "../../product-ui/today/intelligent-today.module.css";

export function PreparedExperienceCard({
  catalog,
  item,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  item: WebPreparedExperienceItem;
}>) {
  const [title, setTitle] = useState(item.editableDraft.title);
  const [body, setBody] = useState(item.editableDraft.body);

  return (
    <section aria-labelledby={`prepared-${item.id}`} className={styles.zone!}>
      <h2 className={`${styles.zoneLabel!} ${styles.preparedLabel!}`} id={`prepared-${item.id}`}>
        {catalog["today.intelligent.prepared"]}
      </h2>
      <article className={`${styles.card!} ${styles.preparedCard!}`}>
        <span className={styles.icon!}>
          <ProductIcon name="document" size="large" />
        </span>
        <div className={styles.cardBody!}>
          <label className={styles.draftField!}>
            <span>{catalog["today.intelligent.draftTitle"]}</span>
            <input
              aria-label={catalog["today.intelligent.draftTitle"]}
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </label>
          <label className={styles.draftField!}>
            <span>{catalog["today.intelligent.draftBody"]}</span>
            <textarea
              aria-label={catalog["today.intelligent.draftBody"]}
              onChange={(event) => setBody(event.target.value)}
              value={body}
            />
          </label>
          <dl className={styles.explanation!}>
            <div>
              <dt>{catalog["today.intelligent.source"]}</dt>
              <dd>{sourceLabel(item.sourceReferences[0]!, catalog)}</dd>
            </div>
            <div>
              <dt>{catalog["today.intelligent.why"]}</dt>
              <dd>{item.why}</dd>
            </div>
            <div>
              <dt>{catalog["today.intelligent.freshness"]}</dt>
              <dd>
                <time dateTime={item.freshness.sourceObservedAt}>
                  {item.freshness.sourceObservedAt}
                </time>
              </dd>
            </div>
            <div>
              <dt>{catalog["today.intelligent.consequence"]}</dt>
              <dd>{item.consequence}</dd>
            </div>
          </dl>
          <p className={styles.assistance!}>{item.assistance.label}</p>
          {item.state === "stale" ? (
            <p className={styles.staleNote!} role="status">
              {catalog["today.intelligent.preparedStale"]}
            </p>
          ) : null}
        </div>
      </article>
    </section>
  );
}

function sourceLabel(
  sourceReference: string,
  catalog: import("@evaluation/localization").Catalog,
): string {
  if (sourceReference.startsWith("work-item:")) return catalog["today.intelligent.source.workItem"];
  if (sourceReference.startsWith("project-suggestion:")) {
    return catalog["today.intelligent.source.projectSuggestion"];
  }
  return catalog["today.intelligent.source.authorized"];
}
