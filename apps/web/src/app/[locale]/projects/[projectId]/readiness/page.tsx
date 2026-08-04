import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";
import { createElement } from "react";

import {
  fetchDailyWorkUpstream,
  WebMonthlyReadinessSchema,
} from "../../../../../platform/daily-work-api";
import { WorkspaceShell } from "../../../workspace-shell";
import { ReadinessView } from "./readiness-view";

export default async function ProjectReadinessPage({
  params,
}: Readonly<{ params: Promise<{ locale: string; projectId: string }> }>) {
  const { locale, projectId } = await params;
  if (!isLocale(locale)) notFound();
  const [catalog, view] = await Promise.all([
    getCatalog(locale),
    fetchDailyWorkUpstream({
      route: { kind: "readiness", projectId },
      schema: WebMonthlyReadinessSchema,
    }),
  ]);
  const alternateLocale = locale === "ar" ? "en" : "ar";
  return createElement(
    WorkspaceShell,
    {
      catalog,
      locale,
      localeSwitchHref: `/${alternateLocale}/projects/${projectId}/readiness`,
    },
    createElement(ReadinessView, { catalog, locale, view }),
  );
}
