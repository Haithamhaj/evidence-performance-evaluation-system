"use client";

import type { MyWorkResponse } from "@evaluation/contracts";
import {
  defaultTimeZone,
  localeMetadata,
  type Catalog,
  type Locale,
} from "@evaluation/localization";
import { createElement, useState } from "react";

import { UpdateComposer } from "./update-composer";
import { WorkItemDrawer } from "./work-item-drawer";
import type { UpdateComposerContext } from "../../../platform/updates-evidence-contracts";

type Properties = Readonly<{
  catalog: Catalog;
  initialSelectedId: string | null;
  locale: Locale;
  projectNames?: Readonly<Record<string, string>>;
  response: MyWorkResponse;
  updateContext?: UpdateComposerContext;
}>;

export function MyWorkClient({
  catalog,
  initialSelectedId,
  locale,
  projectNames = {},
  response,
  updateContext,
}: Properties) {
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const allItems = response.groups.flatMap((group) => group.items);
  const selected = allItems.find((item) => item.id === selectedId) ?? null;
  const firstUpdatable = allItems.find((item) => item.allowedActions.includes("add_update"));
  const composedContext = updateContext ?? contextFromItems(allItems, projectNames);
  const [composerItemId, setComposerItemId] = useState(firstUpdatable?.id ?? "");
  const [composerOpen, setComposerOpen] = useState(false);

  function select(itemId: string | null) {
    setSelectedId(itemId);
    const url = new URL(window.location.href);
    if (itemId === null) url.searchParams.delete("item");
    else url.searchParams.set("item", itemId);
    window.history.replaceState(null, "", url);
  }

  return (
    <section className="dailyWorkPage" aria-labelledby="my-work-heading">
      <header className="compactPageHeading">
        <div>
          <h1 id="my-work-heading">{catalog["myWork.title"]}</h1>
          <p>{catalog["myWork.subtitle"]}</p>
        </div>
        <button
          className="primaryAction"
          disabled={composedContext.projects.length === 0}
          onClick={() => {
            setComposerItemId(firstUpdatable?.id ?? "");
            setComposerOpen(true);
          }}
          type="button"
        >
          {catalog["updates.add"]}
        </button>
      </header>
      <div className="workGroups">
        {response.groups.map((group, index) => {
          const content = (
            <ul className="workItemList">
              {group.items.length === 0 ? (
                <li className="emptyRow">{catalog["myWork.empty"]}</li>
              ) : (
                group.items.map((item) => (
                  <li className="workItemRow" key={item.id}>
                    <button
                      aria-label={`${catalog["actions.openDetails"]}: ${item.title}`}
                      className="rowButton"
                      onClick={() => select(item.id)}
                      type="button"
                    >
                      <span className="rowMain">
                        <strong>{item.title}</strong>
                        <span>{item.nextAction ?? item.description}</span>
                      </span>
                      <span className={`statusBadge status-${item.status}`}>
                        {catalog[`myWork.status.${item.status}`]}
                      </span>
                      {item.dueAt === null ? null : (
                        <time dateTime={item.dueAt}>
                          {new Intl.DateTimeFormat(localeMetadata[locale].dateLocale, {
                            day: "numeric",
                            month: "short",
                            timeZone: defaultTimeZone,
                          }).format(new Date(item.dueAt))}
                        </time>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          );
          return index < 3 ? (
            <section className="workGroup panel" key={group.key}>
              <h2>{catalog[`myWork.group.${group.key}`]}</h2>
              {content}
            </section>
          ) : (
            <details className="workGroup panel" key={group.key} open={!group.collapsedByDefault}>
              <summary>
                {catalog[`myWork.group.${group.key}`]} <span>{group.items.length}</span>
              </summary>
              {content}
            </details>
          );
        })}
      </div>
      {selected === null
        ? null
        : createElement(WorkItemDrawer, {
            catalog,
            item: selected,
            onClose: () => select(null),
            onAddUpdate: selected.allowedActions.includes("add_update")
              ? () => {
                  setComposerItemId(selected.id);
                  setComposerOpen(true);
                }
              : undefined,
          })}
      {createElement(UpdateComposer, {
        catalog,
        initialItemId: composerItemId,
        items: allItems.filter((item) => item.allowedActions.includes("add_update")),
        context: composedContext,
        locale,
        onAccepted: () => undefined,
        onClose: () => setComposerOpen(false),
        open: composerOpen,
        projectNames,
      })}
    </section>
  );
}

function contextFromItems(
  items: readonly MyWorkResponse["groups"][number]["items"][number][],
  projectNames: Readonly<Record<string, string>>,
): UpdateComposerContext {
  const projects = new Map<string, UpdateComposerContext["projects"][number]>();
  for (const item of items.filter((candidate) => candidate.allowedActions.includes("add_update"))) {
    const current = projects.get(item.projectId) ?? {
      id: item.projectId,
      name: projectNames[item.projectId] ?? item.projectId,
      workstreams: [],
      workItems: [],
    };
    projects.set(item.projectId, {
      ...current,
      workItems: [
        ...current.workItems,
        { id: item.id, title: item.title, workstreamId: item.workstreamId },
      ],
    });
  }
  return { projects: [...projects.values()] };
}
