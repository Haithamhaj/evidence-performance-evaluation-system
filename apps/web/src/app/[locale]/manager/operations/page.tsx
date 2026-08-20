import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";
import { createElement } from "react";

import {
  fetchDailyWorkUpstream,
  WebManagerOperationsSchema,
} from "../../../../platform/daily-work-api";
import { WebManagerCoachingSchema } from "../../../../platform/manager-coaching-contracts";
import { fetchProtectedUpstream } from "../../../../platform/workspace-api";
import { WorkspaceShell } from "../../workspace-shell";
import { ManagerOperationsClient } from "./manager-operations-client";

export default async function ManagerOperationsPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [catalog, view, coachingView] = await Promise.all([
    getCatalog(locale),
    fetchDailyWorkUpstream({
      route: { kind: "manager_operations" },
      schema: WebManagerOperationsSchema,
    }),
    fetchProtectedUpstream({
      path: "/api/v1/coaching/manager-view",
      schema: WebManagerCoachingSchema,
    }),
  ]);
  const alternateLocale = locale === "ar" ? "en" : "ar";
  return createElement(
    WorkspaceShell,
    {
      catalog,
      locale,
      localeSwitchHref: `/${alternateLocale}/manager/operations`,
    },
    createElement(ManagerOperationsClient, { catalog, coachingView, locale, view }),
  );
}
