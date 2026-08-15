import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";
import { z } from "zod";

import { fetchEmployeeEvaluationJourney } from "../../../../platform/employee-evaluation-client";
// Babel's project ESLint parser removes JSX component usage before the base unused-import rule runs.
// eslint-disable-next-line no-unused-vars
import { EvaluationWorkspace } from "./evaluation-workspace";
// Babel's project ESLint parser removes JSX component usage before the base unused-import rule runs.
// eslint-disable-next-line no-unused-vars
import { WorkspaceShell } from "../../workspace-shell";

type Properties = Readonly<{ params: Promise<{ locale: string; cycleId: string }> }>;

export default async function EmployeeEvaluationPage({ params }: Properties) {
  const parsed = z
    .object({ locale: z.enum(["ar", "en"]), cycleId: z.string().uuid() })
    .strict()
    .safeParse(await params);
  if (!parsed.success || !isLocale(parsed.data.locale)) notFound();
  const { locale, cycleId } = parsed.data;
  const catalog = await getCatalog(locale);
  const alternateLocale = locale === "ar" ? "en" : "ar";
  if (locale === "ar") {
    return (
      <WorkspaceShell
        catalog={catalog}
        locale={locale}
        localeSwitchHref={`/${alternateLocale}/evaluations/${cycleId}`}
      >
        <article className="workspacePanel" data-testid="evaluation-arabic-gate">
          <p>{catalog["evaluation.technicalCheckpoint"]}</p>
          <h1>{catalog["evaluation.arabicUnavailableTitle"]}</h1>
          <p>{catalog["evaluation.arabicUnavailableBody"]}</p>
        </article>
      </WorkspaceShell>
    );
  }
  const journey = await fetchEmployeeEvaluationJourney({ cycleId, locale });
  return (
    <WorkspaceShell
      catalog={catalog}
      locale={locale}
      localeSwitchHref={`/${alternateLocale}/evaluations/${cycleId}`}
    >
      <EvaluationWorkspace
        catalog={catalog}
        factView={journey.factView}
        journey={journey}
        locale={locale}
      />
    </WorkspaceShell>
  );
}
