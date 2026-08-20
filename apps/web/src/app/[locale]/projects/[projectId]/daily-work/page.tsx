import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";
import { createElement } from "react";

import { fetchDailyWorkUpstream } from "../../../../../platform/daily-work-api";
import { WorkspaceShell } from "../../../workspace-shell";
import { ProjectProgressPanel } from "./project-progress-panel";
import { ProjectProgressViewSchema } from "./project-progress-view-schema";

export default async function ProjectDailyWorkPage({
  params,
}: Readonly<{
  params: Promise<{ locale: string; projectId: string }>;
}>) {
  const { locale, projectId } = await params;
  if (!isLocale(locale)) notFound();
  const [catalog, view] = await Promise.all([
    getCatalog(locale),
    fetchDailyWorkUpstream({
      route: { kind: "project", projectId },
      schema: ProjectProgressViewSchema,
    }),
  ]);
  const alternateLocale = locale === "ar" ? "en" : "ar";
  return createElement(
    WorkspaceShell,
    {
      catalog,
      locale,
      localeSwitchHref: `/${alternateLocale}/projects/${projectId}/daily-work`,
    },
    createElement(ProjectProgressPanel, {
      catalog,
      locale,
      view,
    }),
  );
}
