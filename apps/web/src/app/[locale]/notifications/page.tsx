/* eslint-disable no-unused-vars */
import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";

import { WorkspaceShell } from "../workspace-shell";

export default async function NotificationsPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const catalog = await getCatalog(locale);
  const alternateLocale = locale === "ar" ? "en" : "ar";
  return (
    <WorkspaceShell
      catalog={catalog}
      locale={locale}
      localeSwitchHref={`/${alternateLocale}/notifications`}
    >
      <article className="workspacePanel" data-testid="operations-notifications-checkpoint">
        <p>{catalog["operations.technicalCheckpoint"]}</p>
        <h1>{catalog["operations.notificationsTitle"]}</h1>
        <p>{catalog["operations.notificationsDescription"]}</p>
        <ol>
          <li>{catalog["operations.inAppAction"]}</li>
          <li>{catalog["operations.emailRecovery"]}</li>
          <li>{catalog["operations.deepLinkAuthorization"]}</li>
          <li>{catalog["operations.exportLifecycle"]}</li>
        </ol>
        <p>{catalog["operations.noScoringBoundary"]}</p>
      </article>
    </WorkspaceShell>
  );
}
