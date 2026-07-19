import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";
import { createElement } from "react";
import { z } from "zod";

import { fetchDailyWorkUpstream } from "../../../../../platform/daily-work-api";
import { PublicProgressContractDraftSchema } from "../../../../../platform/progress-contract-drafts";
import { fetchProtectedUpstream } from "../../../../../platform/workspace-api";
import { WorkspaceShell } from "../../../workspace-shell";
import { ProjectProgressPanel } from "./project-progress-panel";

const Uuid = z.string().uuid();
const ProgressSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("awaiting_contract") }).strict(),
  z.object({ state: z.literal("awaiting_information") }).strict(),
  z
    .object({
      state: z.literal("accepted"),
      snapshotId: Uuid,
      percent: z.number().min(0).max(100),
      reason: z.string(),
      updatedAt: z.iso.datetime({ offset: true }),
    })
    .strict(),
]);
const ProjectProgressViewSchema: z.ZodType<import("./project-progress-panel").ProjectProgressView> =
  z
    .object({
      project: z
        .object({
          id: Uuid,
          name: z.string(),
          description: z.string(),
          status: z.enum(["draft", "active", "paused", "completed", "archived"]),
        })
        .strict(),
      contract: z
        .object({
          id: Uuid,
          contractVersion: z.number().int().positive(),
          version: z.number().int().positive(),
          state: z.literal("active"),
          calculationKind: z.enum(["weighted", "stage_gate"]),
          effectiveAt: z.iso.datetime({ offset: true }),
          components: z.array(
            z
              .object({
                id: Uuid,
                kind: z.enum(["milestone", "deliverable", "kpi", "acceptance"]),
                name: z.string(),
                description: z.string(),
                weight: z.number().nullable(),
                baseline: z.number().nullable(),
                target: z.number().nullable(),
                unit: z.string().nullable(),
                direction: z.enum(["increase", "decrease", "maintain"]).nullable(),
                requiredEvidence: z.array(z.string()),
              })
              .strict(),
          ),
        })
        .strict()
        .nullable(),
      progress: ProgressSchema,
      contractDraftSourceRequest: z
        .object({
          documentVersionId: Uuid,
          sourceChecksum: z.string().regex(/^[a-f0-9]{64}$/u),
          sourceVersion: z.number().int().positive(),
        })
        .strict()
        .nullable(),
    })
    .strict();

export default async function ProjectDailyWorkPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ locale: string; projectId: string }>;
  searchParams?: Promise<{ draft?: string | string[] }>;
}>) {
  const { locale, projectId } = await params;
  if (!isLocale(locale)) notFound();
  const draftValue = (await searchParams)?.draft;
  const draftRequestId =
    typeof draftValue === "string" && Uuid.safeParse(draftValue).success ? draftValue : null;
  const [catalog, view, initialDraft] = await Promise.all([
    getCatalog(locale),
    fetchDailyWorkUpstream({
      route: { kind: "project", projectId },
      schema: ProjectProgressViewSchema,
    }),
    draftRequestId === null
      ? Promise.resolve(null)
      : fetchProtectedUpstream({
          path: `/api/v1/projects/${Uuid.parse(projectId)}/progress-contract-drafts/${draftRequestId}`,
          schema: PublicProgressContractDraftSchema,
        }),
  ]);
  const alternateLocale = locale === "ar" ? "en" : "ar";
  return createElement(
    WorkspaceShell,
    {
      catalog,
      locale,
      localeSwitchHref: `/${alternateLocale}/projects/${projectId}/daily-work`,
    },
    createElement(ProjectProgressPanel, {
      catalog,
      draftJourney: {
        initialDraft,
        initialOpen: initialDraft !== null,
        sourceRequest:
          view.contractDraftSourceRequest == null
            ? null
            : {
                documentVersionId: view.contractDraftSourceRequest.documentVersionId,
                sourceChecksum: view.contractDraftSourceRequest.sourceChecksum,
                sourceVersion: view.contractDraftSourceRequest.sourceVersion,
              },
      },
      locale,
      view,
    }),
  );
}
