import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";
import { createElement } from "react";

import { WorkspaceShell } from "../workspace-shell";
import { WorkspaceClient } from "./workspace-client";

type ProjectsPageProperties = {
  readonly params: Promise<{ readonly locale: string }>;
};

export default async function ProjectsPage({ params }: ProjectsPageProperties) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const catalog = await getCatalog(locale);
  const alternateLocale = locale === "ar" ? "en" : "ar";

  return createElement(
    WorkspaceShell,
    {
      catalog,
      locale,
      localeSwitchHref: `/${alternateLocale}/projects`,
    },
    createElement(WorkspaceClient, { catalog, locale, mode: "list" }),
  );
}
