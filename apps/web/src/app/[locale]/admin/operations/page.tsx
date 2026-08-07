/* eslint-disable no-unused-vars */
import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";

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
      <article className="workspacePanel" data-testid="operations-admin-checkpoint">
        <p>{catalog["operations.technicalCheckpoint"]}</p>
        <h1>{catalog["operations.adminTitle"]}</h1>
        <p>{catalog["operations.adminDescription"]}</p>
        <ul>
          <li>{catalog["operations.healthState"]}</li>
          <li>{catalog["operations.safeNextAction"]}</li>
          <li>{catalog["operations.ownerDomainMutation"]}</li>
        </ul>
        <p>{catalog["operations.adminBoundary"]}</p>
      </article>
    </WorkspaceShell>
  );
}
