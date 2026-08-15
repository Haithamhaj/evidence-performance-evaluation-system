import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";
import { createElement } from "react";

import { WorkspaceShell } from "../../workspace-shell";
import { ConnectionsWorkspace } from "./connections-workspace";

export default async function ConnectionsPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const catalog = await getCatalog(locale);
  const alternateLocale = locale === "ar" ? "en" : "ar";
  return createElement(
    WorkspaceShell,
    { catalog, locale, localeSwitchHref: `/${alternateLocale}/settings/connections` },
    createElement(ConnectionsWorkspace, {
      catalog,
      githubAvailable: Boolean(process.env.GITHUB_APP_ID?.trim()),
      locale,
    }),
  );
}
