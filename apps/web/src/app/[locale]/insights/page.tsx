import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";
import { createElement } from "react";

import {
  fetchDailyWorkUpstream,
  WebEmployeeInsightsSchema,
} from "../../../platform/daily-work-api";
import { InsightsWorkspace } from "../../../product-ui/insights/insights-workspace";
import { WorkspaceShell } from "../workspace-shell";
import { loadShellContext } from "../../../server/shell/load-shell-context";

export default async function InsightsPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [catalog, shellContext, insights] = await Promise.all([
    getCatalog(locale),
    loadShellContext(),
    fetchDailyWorkUpstream({ route: { kind: "insights" }, schema: WebEmployeeInsightsSchema }),
  ]);
  const alternateLocale = locale === "ar" ? "en" : "ar";
  return createElement(
    WorkspaceShell,
    {
      catalog,
      locale,
      localeSwitchHref: `/${alternateLocale}/insights`,
      principal: shellContext.principal,
    },
    createElement(InsightsWorkspace, { catalog, insights, locale }),
  );
}
