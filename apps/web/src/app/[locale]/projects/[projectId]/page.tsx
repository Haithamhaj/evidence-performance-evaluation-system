import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";
import { createElement } from "react";

import {
  fetchDailyWorkUpstream,
  WebEmployeeProjectExperienceSchema,
} from "../../../../platform/daily-work-api";
import { ProjectWorkspace } from "../../../../product-ui/project/project-workspace";
import { finalProjectEnabled } from "../../../../server/final-experience/final-experience-flags";
import { loadShellContext } from "../../../../server/shell/load-shell-context";
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
  if (finalProjectEnabled()) {
    const [experience, shellContext] = await Promise.all([
      fetchDailyWorkUpstream({
        reauthenticateTo: `/${locale}/projects/${projectId}`,
        route: { kind: "project_experience", projectId },
        schema: WebEmployeeProjectExperienceSchema,
      }),
      loadShellContext(),
    ]);
    return createElement(
      WorkspaceShell,
      {
        catalog,
        locale,
        localeSwitchHref: `/${alternateLocale}/projects/${projectId}`,
        principal: shellContext.principal,
      },
      createElement(ProjectWorkspace, { catalog, experience, locale }),
    );
  }

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
