import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";
import { createElement } from "react";

import {
  fetchDailyWorkUpstream,
  WebTaskWorkspaceResponseSchema,
  WebUpdateComposerContextSchema,
} from "../../../platform/daily-work-api";
import { WorkspaceShell } from "../workspace-shell";
import { TasksClient } from "./tasks-client";

type Properties = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ layout?: string; item?: string }>;
}>;

export default async function TasksPage({ params, searchParams }: Properties) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const layout = ["list", "board", "calendar"].includes(query.layout ?? "")
    ? (query.layout as "list" | "board" | "calendar")
    : "list";
  const [catalog, response, context] = await Promise.all([
    getCatalog(locale),
    fetchDailyWorkUpstream({
      route: { kind: "tasks", view: "my", layout },
      schema: WebTaskWorkspaceResponseSchema,
    }),
    fetchDailyWorkUpstream({
      route: { kind: "update_context" },
      schema: WebUpdateComposerContextSchema,
    }),
  ]);
  const alternateLocale = locale === "ar" ? "en" : "ar";
  return createElement(
    WorkspaceShell,
    {
      catalog,
      locale,
      localeSwitchHref: `/${alternateLocale}/tasks?layout=${layout}`,
    },
    createElement(TasksClient, {
      catalog,
      initialItems: response.items,
      initialLayout: layout,
      initialSelectedId: query.item ?? null,
      locale,
      projects: context.projects.map(({ id, name }) => ({ id, name })),
    }),
  );
}
