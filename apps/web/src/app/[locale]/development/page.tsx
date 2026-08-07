/* eslint-disable no-unused-vars */
import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";
import { WorkspaceShell } from "../workspace-shell";

export default async function DevelopmentPage({
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
      localeSwitchHref={`/${alternateLocale}/development`}
    >
      <article className="workspacePanel" data-testid="coaching-development-checkpoint">
        <p>{catalog["development.technicalCheckpoint"]}</p>
        <h1>{catalog["development.title"]}</h1>
        <p>{catalog["development.employeeControl"]}</p>
        <p>{catalog["development.managerBoundary"]}</p>
        <p>{catalog["development.manualRecovery"]}</p>
      </article>
    </WorkspaceShell>
  );
}
