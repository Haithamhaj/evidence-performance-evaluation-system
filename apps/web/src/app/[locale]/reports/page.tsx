/* eslint-disable no-unused-vars */
import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";

import { ReportCenter } from "../../../product-ui/reports/report-center";
import { WorkspaceShell } from "../workspace-shell";

export default async function ReportsPage({
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
      localeSwitchHref={`/${alternateLocale}/reports`}
    >
      <ReportCenter catalog={catalog} locale={locale} />
    </WorkspaceShell>
  );
}
