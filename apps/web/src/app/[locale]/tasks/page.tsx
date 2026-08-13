import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";
import { createElement } from "react";

import {
  fetchDailyWorkUpstream,
  WebCurrentUserSchema,
  WebDailyWorkspaceSnapshotSchema,
  WebTaskWorkspaceResponseSchema,
  WebUpdateComposerContextSchema,
} from "../../../platform/daily-work-api";
import { WorkspaceShell } from "../workspace-shell";
import { WorkWorkspace } from "../../../product-ui/work/work-workspace";
import { workWorkspaceEnabled } from "../../../server/work/work-workspace-flag";
import { buildTasksPageState } from "../../../server/work/tasks-page-state";
import { TasksClient } from "./tasks-client";

type Properties = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    layout?: string;
    item?: string;
    project?: string;
    q?: string;
    sort?: string;
    status?: string;
    view?: string;
  }>;
}>;

export default async function TasksPage({ params, searchParams }: Properties) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const {
    href: reauthenticateTo,
    layout,
    projectId,
    search,
    selectedId,
    sort,
    status,
    view,
  } = buildTasksPageState(locale, query);
  const [catalog, response, context, currentUser, snapshot] = await Promise.all([
    getCatalog(locale),
    fetchDailyWorkUpstream({
      reauthenticateTo,
      route: { kind: "tasks", view, layout, projectId, status, search, sort },
      schema: WebTaskWorkspaceResponseSchema,
    }),
    fetchDailyWorkUpstream({
      reauthenticateTo,
      route: { kind: "update_context" },
      schema: WebUpdateComposerContextSchema,
    }),
    fetchDailyWorkUpstream({
      reauthenticateTo,
      route: { kind: "me" },
      schema: WebCurrentUserSchema,
    }),
    fetchDailyWorkUpstream({
      reauthenticateTo,
      route: { kind: "my_work" },
      schema: WebDailyWorkspaceSnapshotSchema,
    }),
  ]);
  const alternateLocale = locale === "ar" ? "en" : "ar";
  const alternateHref = buildTasksPageState(alternateLocale, query).href;
  const useWorkWorkspace =
    workWorkspaceEnabled() && (layout === "list" || layout === "board" || layout === "calendar");
  const hasActiveFilters = projectId !== null || search !== null || status !== null;
  return createElement(
    WorkspaceShell,
    {
      catalog,
      locale,
      localeSwitchHref: alternateHref,
    },
    useWorkWorkspace
      ? createElement(WorkWorkspace, {
          catalog,
          currentUserId: currentUser.userId,
          initialItems: response.items,
          initialLayout: layout,
          initialNextCursor: response.nextCursor,
          initialCounts: response.counts,
          initialFilters: { projectId, search, sort, status },
          initialSelectedId: selectedId,
          ...(hasActiveFilters ? {} : { initialSnapshot: snapshot }),
          initialView: view,
          locale,
          projects: context.projects.map(({ id, name }) => ({ id, name })),
        })
      : createElement(TasksClient, {
          catalog,
          draftOwnerId: currentUser.userId,
          initialItems: response.items,
          initialLayout: layout,
          initialSelectedId: selectedId,
          initialView: view,
          locale,
          projects: context.projects.map(({ id, name }) => ({ id, name })),
        }),
  );
}
