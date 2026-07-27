"use client";

import type { DailyWorkspaceSnapshot } from "@evaluation/contracts";
import type { Catalog, Locale } from "@evaluation/localization";
import { createElement, useState } from "react";

import type { UpdateComposerContext } from "../../../platform/updates-evidence-contracts";
import { DailyBrief } from "./daily-brief";
import { ConnectedContext } from "./connected-context";
import { PrivateInbox } from "./private-inbox";
import { ProjectPulse } from "./project-pulse";
import { ReviewQueue } from "./review-queue";
import { WorkItemDrawer } from "./work-item-drawer";

type Properties = Readonly<{
  catalog: Catalog;
  initialSelectedId: string | null;
  locale: Locale;
  response: DailyWorkspaceSnapshot;
  updateContext?: UpdateComposerContext;
}>;

export function MyWorkClient({
  catalog,
  initialSelectedId,
  locale,
  response,
  updateContext,
}: Properties) {
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const allItems = [
    ...response.needsMyAction,
    ...response.today,
    ...response.overdue,
    ...response.reviewQueue,
    ...response.upcoming,
  ];
  const selected = allItems.find((item) => item.id === selectedId) ?? null;
  const projects =
    updateContext?.projects.map(({ id, name }) => ({ id, name })) ??
    response.projectPulse.map(({ id, name }) => ({ id, name }));

  function select(itemId: string | null) {
    const previousId = selectedId;
    setSelectedId(itemId);
    const url = new URL(window.location.href);
    if (itemId === null) url.searchParams.delete("item");
    else url.searchParams.set("item", itemId);
    window.history.replaceState(null, "", url);
    if (itemId === null && previousId !== null) {
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>(`[data-task-id="${previousId}"]`)?.focus();
      });
    }
  }

  return (
    <section className="dailyWorkPage" aria-labelledby="my-work-heading">
      <header className="compactPageHeading">
        <div>
          <p className="eyebrow">{catalog["today.eyebrow"]}</p>
          <h1 id="my-work-heading">{catalog["myWork.title"]}</h1>
          <p>{catalog["myWork.subtitle"]}</p>
        </div>
        <a className="primaryLink" href={`/${locale}/tasks?new=1`}>
          {catalog["tasks.add"]}
        </a>
      </header>

      {createElement(ReviewQueue, {
        catalog,
        items: response.reviewQueue,
        onSelect: select,
      })}

      {createElement(DailyBrief, {
        catalog,
        locale,
        needsMyAction: response.needsMyAction,
        onSelect: select,
        overdue: response.overdue,
        today: response.today,
      })}

      {createElement(ProjectPulse, {
        catalog,
        items: response.projectPulse,
        locale,
      })}

      {createElement(ConnectedContext, { catalog, projects })}

      {createElement(PrivateInbox, {
        catalog,
        initialItems: response.inbox,
        projects,
      })}

      {response.upcoming.length === 0 ? null : (
        <details className="workGroup panel">
          <summary>
            {catalog["myWork.group.this_week"]} <span>{response.upcoming.length}</span>
          </summary>
          {createElement(DailyBrief, {
            catalog,
            locale,
            needsMyAction: response.upcoming,
            onSelect: select,
            overdue: [],
            today: [],
            single: true,
          })}
        </details>
      )}

      {selected === null
        ? null
        : createElement(WorkItemDrawer, {
            catalog,
            item: selected,
            onClose: () => select(null),
          })}
    </section>
  );
}
