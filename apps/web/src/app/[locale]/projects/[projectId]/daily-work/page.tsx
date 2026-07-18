import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";
import { createElement } from "react";
import { z } from "zod";

import { fetchDailyWorkUpstream } from "../../../../../platform/daily-work-api";
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
    })
    .strict();

export default async function ProjectDailyWorkPage({
  params,
}: Readonly<{ params: Promise<{ locale: string; projectId: string }> }>) {
  const { locale, projectId } = await params;
  if (!isLocale(locale)) notFound();
  const [catalog, view] = await Promise.all([
    getCatalog(locale),
    fetchDailyWorkUpstream({
      route: { kind: "project", projectId },
      schema: ProjectProgressViewSchema,
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
    createElement(ProjectProgressPanel, { catalog, locale, view }),
  );
}
