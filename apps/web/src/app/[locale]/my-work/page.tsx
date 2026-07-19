import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";
import { createElement } from "react";

import {
  fetchDailyWorkUpstream,
  WebMyWorkResponseSchema,
  WebProjectPortfolioSchema,
  WebUpdateComposerContextSchema,
} from "../../../platform/daily-work-api";
import { WorkspaceShell } from "../workspace-shell";
import { MyWorkClient } from "./my-work-client";

type Properties = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ item?: string }>;
}>;

export default async function MyWorkPage({ params, searchParams }: Properties) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [{ item }, catalog, response, projects, updateContext] = await Promise.all([
    searchParams,
    getCatalog(locale),
    fetchDailyWorkUpstream({ route: { kind: "my_work" }, schema: WebMyWorkResponseSchema }),
    fetchDailyWorkUpstream({ route: { kind: "projects" }, schema: WebProjectPortfolioSchema }),
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
      localeSwitchHref: `/${alternateLocale}/my-work${item ? `?item=${item}` : ""}`,
    },
    createElement(MyWorkClient, {
      catalog,
      initialSelectedId: item ?? null,
      locale,
      projectNames: Object.fromEntries(projects.map((project) => [project.id, project.name])),
      response,
      updateContext,
    }),
  );
}
