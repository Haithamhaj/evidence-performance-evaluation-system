/* eslint-disable no-unused-vars */
import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";

import { WorkspaceShell } from "../workspace-shell";

export default async function ContinuityPage({
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
      localeSwitchHref={`/${alternateLocale}/continuity`}
    >
      <article className="workspacePanel" data-testid="continuity-technical-checkpoint">
        <p>{catalog["continuity.technicalCheckpoint"]}</p>
        <h1>{catalog["continuity.title"]}</h1>
        <p>{catalog["continuity.description"]}</p>
        <ol>
          <li>{catalog["continuity.leave"]}</li>
          <li>{catalog["continuity.handover"]}</li>
          <li>{catalog["continuity.delegation"]}</li>
          <li>{catalog["continuity.return"]}</li>
          <li>{catalog["continuity.offboarding"]}</li>
        </ol>
        <p>{catalog["continuity.boundary"]}</p>
      </article>
    </WorkspaceShell>
  );
}
