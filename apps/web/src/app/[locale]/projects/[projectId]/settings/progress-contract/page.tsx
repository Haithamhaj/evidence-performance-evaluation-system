import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";
import { createElement } from "react";
import { z } from "zod";

import { fetchDailyWorkUpstream } from "../../../../../../platform/daily-work-api";
import { PublicProgressContractDraftSchema } from "../../../../../../platform/progress-contract-drafts";
import { fetchProtectedUpstream } from "../../../../../../platform/workspace-api";
import { WorkspaceShell } from "../../../../workspace-shell";
import { ProgressContractSetupClient } from "./progress-contract-setup-client";

const Uuid = z.string().uuid();
const SetupContextSchema = z
  .object({
    project: z.object({ id: Uuid, name: z.string(), description: z.string() }).passthrough(),
    contractDraftSourceRequest: z
      .object({
        documentVersionId: Uuid,
        sourceChecksum: z.string().regex(/^[a-f0-9]{64}$/u),
        sourceVersion: z.number().int().positive(),
      })
      .strict()
      .nullable(),
  })
  .passthrough()
  .transform(({ project, contractDraftSourceRequest }) => ({
    project,
    contractDraftSourceRequest,
  }));

export default async function ProgressContractSetupPage({
  params,
}: Readonly<{ params: Promise<{ locale: string; projectId: string }> }>) {
  const { locale, projectId } = await params;
  if (!isLocale(locale)) notFound();
  const parsedProjectId = Uuid.parse(projectId);
  const [catalog, context, initialDraft] = await Promise.all([
    getCatalog(locale),
    fetchDailyWorkUpstream({
      route: { kind: "project", projectId: parsedProjectId },
      schema: SetupContextSchema,
    }),
    fetchProtectedUpstream({
      path: `/api/v1/projects/${parsedProjectId}/progress-contract-drafts`,
      schema: PublicProgressContractDraftSchema.nullable(),
    }),
  ]);
  const alternateLocale = locale === "ar" ? "en" : "ar";
  return createElement(
    WorkspaceShell,
    {
      catalog,
      locale,
      localeSwitchHref: `/${alternateLocale}/projects/${projectId}/settings/progress-contract`,
    },
    <main className="progressSetupPage">
      <nav className="breadcrumbs" aria-label={catalog["workspace.backToProjects"]}>
        <a href={`/${locale}/projects/${projectId}/daily-work`}>
          {catalog["workspace.openDailyWork"]}
        </a>
      </nav>
      <header className="compactPageHeading">
        <div>
          <p className="eyebrow">{context.project.name}</p>
          <h1>{catalog["progressSetup.title"]}</h1>
          <p>{catalog["progressSetup.subtitle"]}</p>
        </div>
      </header>
      {createElement(ProgressContractSetupClient, {
        catalog,
        initialDraft,
        locale,
        projectId,
        sourceRequest: context.contractDraftSourceRequest,
      })}
    </main>,
  );
}
