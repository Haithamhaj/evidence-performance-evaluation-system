import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";
import { createElement } from "react";

import { WorkspaceShell } from "../../workspace-shell";
import { WorkspaceClient } from "../workspace-client";

type ProjectPageProperties = {
  readonly params: Promise<{ readonly locale: string; readonly projectId: string }>;
};

export default async function ProjectPage({ params }: ProjectPageProperties) {
  const { locale, projectId } = await params;
  if (!isLocale(locale)) notFound();
  const catalog = await getCatalog(locale);
  const alternateLocale = locale === "ar" ? "en" : "ar";

  return createElement(
    WorkspaceShell,
    {
      catalog,
      locale,
      localeSwitchHref: `/${alternateLocale}/projects/${projectId}`,
    },
    createElement(
      "div",
      { className: "workspaceSection" },
      createElement(
        "a",
        { className: "secondaryLink", href: `/${locale}/projects/${projectId}/research` },
        catalog["research.open"],
      ),
      createElement(WorkspaceClient, {
        catalog,
        locale,
        mode: "project",
        projectId,
      }),
    ),
  );
}
