import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";
import { createElement } from "react";
import { z } from "zod";

import { fetchEvaluationFactView } from "../../../../platform/evaluation-fact-view-api";
import { WorkspaceShell } from "../../workspace-shell";
import { EvaluationFactView } from "./evaluation-fact-view";
import { EvaluationFactsLanding } from "./evaluation-facts-landing";

type Properties = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cycle?: string; employee?: string }>;
}>;

const QuerySchema = z.object({ cycle: z.string().uuid(), employee: z.string().uuid() }).strict();

export default async function EvaluationFactsPage({ params, searchParams }: Properties) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = QuerySchema.safeParse(await searchParams);
  const catalog = await getCatalog(locale);
  const alternateLocale = locale === "ar" ? "en" : "ar";
  if (!query.success) {
    return createElement(
      WorkspaceShell,
      {
        catalog,
        locale,
        localeSwitchHref: `/${alternateLocale}/evaluations/facts`,
      },
      createElement(EvaluationFactsLanding, { catalog, locale }),
    );
  }
  const view = await fetchEvaluationFactView({
    cycleId: query.data.cycle,
    employeeId: query.data.employee,
    locale,
  });
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
