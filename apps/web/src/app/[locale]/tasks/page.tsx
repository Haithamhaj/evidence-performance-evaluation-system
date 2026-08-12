import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";
import { createElement } from "react";

import {
  fetchDailyWorkUpstream,
  WebCurrentUserSchema,
  WebTaskWorkspaceResponseSchema,
  WebUpdateComposerContextSchema,
} from "../../../platform/daily-work-api";
import { WorkspaceShell } from "../workspace-shell";
import { WorkWorkspace } from "../../../product-ui/work/work-workspace";
import { workWorkspaceEnabled } from "../../../server/work/work-workspace-flag";
import { TasksClient } from "./tasks-client";

type Properties = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ layout?: string; item?: string; view?: string }>;
}>;

export default async function TasksPage({ params, searchParams }: Properties) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const layout = ["list", "board", "calendar"].includes(query.layout ?? "")
    ? (query.layout as "list" | "board" | "calendar")
    : "list";
  const view = query.view === "team" ? "team" : "my";
  const reauthenticateTo = `/${locale}/tasks?view=${view}&layout=${layout}`;
  const [catalog, response, context, currentUser] = await Promise.all([
    getCatalog(locale),
    fetchDailyWorkUpstream({
      reauthenticateTo,
      route: { kind: "tasks", view, layout },
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
  ]);
  const alternateLocale = locale === "ar" ? "en" : "ar";
  const selectedQuery = query.item === undefined ? "" : `&item=${encodeURIComponent(query.item)}`;
  const useWorkWorkspace = workWorkspaceEnabled() && layout === "list";
  return createElement(
    WorkspaceShell,
    {
      catalog,
      locale,
      localeSwitchHref: `/${alternateLocale}/tasks?view=${view}&layout=${layout}${selectedQuery}`,
    },
    useWorkWorkspace
      ? createElement(WorkWorkspace, {
          catalog,
          currentUserId: currentUser.userId,
          initialItems: response.items,
          initialSelectedId: query.item ?? null,
          initialView: view,
          locale,
          projects: context.projects.map(({ id, name }) => ({ id, name })),
        })
      : createElement(TasksClient, {
          catalog,
          draftOwnerId: currentUser.userId,
          initialItems: response.items,
          initialLayout: layout,
          initialSelectedId: query.item ?? null,
          initialView: view,
          locale,
          projects: context.projects.map(({ id, name }) => ({ id, name })),
        }),
  );
}
