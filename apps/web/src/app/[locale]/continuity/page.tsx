/* eslint-disable no-unused-vars */
import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";

import { WebContinuityExperienceSchema } from "../../../platform/continuity-contracts";
import { fetchProtectedUpstream } from "../../../platform/workspace-api";
import { ContinuityWorkspace } from "../../../product-ui/continuity/continuity-workspace";
import { continuityWorkspaceEnabled } from "../../../server/continuity/continuity-workspace-flag";
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
      {continuityWorkspaceEnabled() ? (
        <ContinuityWorkspace
          catalog={catalog}
          locale={locale}
          view={await fetchProtectedUpstream({
            path: "/api/v1/continuity/experience",
            schema: WebContinuityExperienceSchema,
          })}
        />
      ) : (
        <article className="workspacePanel" data-testid="continuity-technical-checkpoint">
          <p>{catalog["continuity.technicalCheckpoint"]}</p>
          <h1>{catalog["continuity.title"]}</h1>
          <p>{catalog["continuity.description"]}</p>
        </article>
      )}
    </WorkspaceShell>
  );
}
