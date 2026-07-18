import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";
import { createElement } from "react";

import { WorkspaceShell } from "../../../../workspace-shell";
import { WorkspaceClient } from "../../../workspace-client";

type WorkstreamPageProperties = {
  readonly params: Promise<{
    readonly locale: string;
    readonly projectId: string;
    readonly workstreamId: string;
  }>;
};

export default async function WorkstreamPage({ params }: WorkstreamPageProperties) {
  const { locale, projectId, workstreamId } = await params;
  if (!isLocale(locale)) notFound();
  const catalog = await getCatalog(locale);
  const alternateLocale = locale === "ar" ? "en" : "ar";
  const resourcePath = `/projects/${projectId}/workstreams/${workstreamId}`;

  return createElement(
    WorkspaceShell,
    {
      catalog,
      locale,
      localeSwitchHref: `/${alternateLocale}${resourcePath}`,
    },
    createElement(WorkspaceClient, {
      catalog,
      locale,
      mode: "workstream",
      projectId,
      workstreamId,
    }),
  );
}
