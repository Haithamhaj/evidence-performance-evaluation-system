/* eslint-disable no-unused-vars */
import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";

import { AdminOperationsWorkspace } from "../../../../product-ui/admin/admin-operations-workspace";
import { WorkspaceShell } from "../../workspace-shell";

export default async function AdminOperationsPage({
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
      localeSwitchHref={`/${alternateLocale}/admin/operations`}
    >
      <AdminOperationsWorkspace catalog={catalog} locale={locale} />
    </WorkspaceShell>
  );
}
