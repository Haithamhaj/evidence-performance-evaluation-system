"use client";

import type { DailyWorkspaceSnapshot } from "@evaluation/contracts";
import type { Catalog, Locale } from "@evaluation/localization";
import { createElement, useState } from "react";

import type { UpdateComposerContext } from "../../../platform/updates-evidence-contracts";
import { DailyBrief } from "./daily-brief";
import { ConnectedContext } from "./connected-context";
import { CheckInCard, type CheckInDraft, type CheckInObligationView } from "./check-in-card";
import { PrivateInbox } from "./private-inbox";
import { ProjectPulse } from "./project-pulse";
import { ReviewQueue } from "./review-queue";
import { SmartReviewQueue } from "./smart-review-queue";
import { UpdateComposer } from "./update-composer";
import { WorkItemDrawer } from "./work-item-drawer";

type Properties = Readonly<{
  catalog: Catalog;
  checkIns?: readonly CheckInObligationView[];
  initialSelectedId: string | null;
  locale: Locale;
  response: DailyWorkspaceSnapshot;
  updateContext?: UpdateComposerContext;
}>;

export function MyWorkClient({
  catalog,
  checkIns = [],
  initialSelectedId,
  locale,
  response,
  updateContext,
}: Properties) {
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [updateItemId, setUpdateItemId] = useState("");
  const [updateOpen, setUpdateOpen] = useState(false);
  const [checkInDraft, setCheckInDraft] = useState<CheckInDraft | null>(null);
  const [contextReviewRevision, setContextReviewRevision] = useState(0);
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

  function openUpdate(itemId = "") {
    if (selectedId !== null) select(null);
    setUpdateItemId(itemId);
    setCheckInDraft(null);
    setUpdateOpen(true);
  }

  function openCheckIn(draft: CheckInDraft) {
    if (selectedId !== null) select(null);
    setUpdateItemId("");
    setCheckInDraft(draft);
    setUpdateOpen(true);
  }

  return (
    <section className="dailyWorkPage" aria-labelledby="my-work-heading">
      <header className="compactPageHeading">
        <div>
          <p className="eyebrow">{catalog["today.eyebrow"]}</p>
          <h1 id="my-work-heading">{catalog["myWork.title"]}</h1>
          <p>{catalog["myWork.subtitle"]}</p>
        </div>
        <div className="formActions">
          {updateContext === undefined || updateContext.projects.length === 0 ? null : (
            <button className="secondaryAction" onClick={() => openUpdate()} type="button">
              {catalog["updates.add"]}
            </button>
          )}
          <a className="primaryLink" href={`/${locale}/tasks?new=1`}>
            {catalog["tasks.add"]}
          </a>
        </div>
      </header>

      {createElement(ReviewQueue, {
        catalog,
        items: response.reviewQueue,
        onSelect: select,
      })}

      {createElement(SmartReviewQueue, { catalog, key: contextReviewRevision, locale })}

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

      {createElement(CheckInCard, {
        catalog,
        obligations: checkIns,
        onStart: openCheckIn,
      })}

      {createElement(ConnectedContext, {
        catalog,
        projects,
        onReviewPrepared: () => setContextReviewRevision((revision) => revision + 1),
      })}

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
            ...(updateContext !== undefined && selected.allowedActions.includes("add_update")
              ? { onAddUpdate: () => openUpdate(selected.id) }
              : {}),
            onClose: () => select(null),
          })}
      {updateContext === undefined
        ? null
        : createElement(UpdateComposer, {
            catalog,
            context: updateContext,
            initialCheckInDraft: checkInDraft,
            initialItemId: updateItemId,
            locale,
            onAccepted: () => undefined,
            onClose: () => setUpdateOpen(false),
            open: updateOpen,
          })}
    </section>
  );
}
