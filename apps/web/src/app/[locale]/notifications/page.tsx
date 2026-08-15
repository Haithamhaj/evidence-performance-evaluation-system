/* eslint-disable no-unused-vars */
import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";

import { NotificationInbox } from "../../../product-ui/notifications/notification-inbox";
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
      <NotificationInbox catalog={catalog} locale={locale} />
    </WorkspaceShell>
  );
}
