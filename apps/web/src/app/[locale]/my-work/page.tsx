import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound, redirect } from "next/navigation";
import { createElement } from "react";

import {
  fetchDailyWorkUpstream,
  WebCheckInObligationsSchema,
  WebDailyWorkspaceSnapshotSchema,
  WebUpdateComposerContextSchema,
} from "../../../platform/daily-work-api";
import { homeHrefForPrincipal } from "../../../product-ui/shell/shell-model";
import { WorkspaceShell } from "../workspace-shell";
import { MyWorkClient } from "./my-work-client";
import { intelligentTodayEnabledForRoles } from "../../../server/today/intelligent-today-flag";
import { sourceReviewEnabledForRoles } from "../../../server/source-review/source-review-flag";
import { loadShellContext } from "../../../server/shell/load-shell-context";

type Properties = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ item?: string }>;
}>;

export default async function MyWorkPage({ params, searchParams }: Properties) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [{ item }, catalog, shellContext] = await Promise.all([
    searchParams,
    getCatalog(locale),
    loadShellContext(),
  ]);
  const authorizedHome = homeHrefForPrincipal(locale, shellContext.principal);
  if (authorizedHome !== `/${locale}/my-work`) redirect(authorizedHome);
  const [response, updateContext, checkIns] = await Promise.all([
    fetchDailyWorkUpstream({
      route: { kind: "my_work" },
      schema: WebDailyWorkspaceSnapshotSchema,
    }),
    fetchDailyWorkUpstream({
      route: { kind: "update_context" },
      schema: WebUpdateComposerContextSchema,
    }),
    fetchDailyWorkUpstream({
      route: { kind: "check_ins" },
      schema: WebCheckInObligationsSchema,
    }),
  ]);
  const alternateLocale = locale === "ar" ? "en" : "ar";
  return createElement(
    WorkspaceShell,
    {
      catalog,
      locale,
      localeSwitchHref: `/${alternateLocale}/my-work${item ? `?item=${item}` : ""}`,
      principal: shellContext.principal,
    },
    createElement(MyWorkClient, {
      catalog,
      checkIns,
      intelligentToday: intelligentTodayEnabledForRoles(shellContext.principal.roles),
      initialSelectedId: item ?? null,
      locale,
      response,
      sourceReview: sourceReviewEnabledForRoles(shellContext.principal.roles),
      updateContext,
    }),
  );
}
