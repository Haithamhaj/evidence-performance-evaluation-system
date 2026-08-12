import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";
import { createElement } from "react";

import {
  fetchDailyWorkUpstream,
  WebCheckInObligationsSchema,
  WebDailyWorkspaceSnapshotSchema,
  WebUpdateComposerContextSchema,
} from "../../../platform/daily-work-api";
import { WorkspaceShell } from "../workspace-shell";
import { MyWorkClient } from "./my-work-client";
import { intelligentTodayEnabled } from "../../../server/today/intelligent-today-flag";
import { sourceReviewEnabled } from "../../../server/source-review/source-review-flag";

type Properties = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ item?: string }>;
}>;

export default async function MyWorkPage({ params, searchParams }: Properties) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [{ item }, catalog, response, updateContext, checkIns] = await Promise.all([
    searchParams,
    getCatalog(locale),
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
    },
    createElement(MyWorkClient, {
      catalog,
      checkIns,
      intelligentToday: intelligentTodayEnabled(),
      initialSelectedId: item ?? null,
      locale,
      response,
      sourceReview: sourceReviewEnabled(),
      updateContext,
    }),
  );
}
