import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";
import { createElement } from "react";
import { z } from "zod";

import { fetchEvaluationFactView } from "../../../../platform/evaluation-fact-view-api";
import { WorkspaceShell } from "../../workspace-shell";
import { EvaluationFactView } from "./evaluation-fact-view";

type Properties = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cycle?: string; employee?: string }>;
}>;

const QuerySchema = z.object({ cycle: z.string().uuid(), employee: z.string().uuid() }).strict();

export default async function EvaluationFactsPage({ params, searchParams }: Properties) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = QuerySchema.safeParse(await searchParams);
  if (!query.success) notFound();
  const [catalog, view] = await Promise.all([
    getCatalog(locale),
    fetchEvaluationFactView({
      cycleId: query.data.cycle,
      employeeId: query.data.employee,
      locale,
    }),
  ]);
  const alternateLocale = locale === "ar" ? "en" : "ar";
  const preserved = new URLSearchParams({
    cycle: query.data.cycle,
    employee: query.data.employee,
  });
  return createElement(
    WorkspaceShell,
    {
      catalog,
      locale,
      localeSwitchHref: `/${alternateLocale}/evaluations/facts?${preserved.toString()}`,
    },
    createElement(EvaluationFactView, { catalog, locale, view }),
  );
}
