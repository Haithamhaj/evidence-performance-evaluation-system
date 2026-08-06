import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";
import { createElement } from "react";
import { z } from "zod";

import { fetchProtectedUpstream } from "../../../../../platform/workspace-api";
import { WorkspaceShell } from "../../../workspace-shell";
import { ResearchWorkspace } from "./research-workspace";

const ProjectNameSchema = z.preprocess(
  (value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
    const project = (value as { project?: unknown }).project;
    if (typeof project !== "object" || project === null || Array.isArray(project)) return value;
    return { name: (project as { name?: unknown }).name };
  },
  z.object({ name: z.string().trim().min(1).max(240) }).strict(),
);

export default async function ProjectResearchPage({
  params,
}: Readonly<{ params: Promise<{ locale: string; projectId: string }> }>) {
  const { locale, projectId } = await params;
  if (!isLocale(locale) || !z.string().uuid().safeParse(projectId).success) notFound();
  const [catalog, project] = await Promise.all([
    getCatalog(locale),
    fetchProtectedUpstream({
      path: `/api/v1/projects/${projectId}/workspace`,
      schema: ProjectNameSchema,
    }),
  ]);
  const alternateLocale = locale === "ar" ? "en" : "ar";
  return createElement(
    WorkspaceShell,
    {
      catalog,
      locale,
      localeSwitchHref: `/${alternateLocale}/projects/${projectId}/research`,
    },
    createElement(ResearchWorkspace, { catalog, locale, project, projectId }),
  );
}
