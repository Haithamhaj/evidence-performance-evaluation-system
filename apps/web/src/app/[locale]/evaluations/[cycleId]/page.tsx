import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";
import { z } from "zod";

import { fetchEmployeeEvaluationJourney } from "../../../../platform/employee-evaluation-client";
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
  const self = journey.submissions.find(({ kind }) => kind === "SELF");
  const manager = journey.submissions.find(({ kind }) => kind === "MANAGER_INITIAL");
  return (
    <WorkspaceShell
      catalog={catalog}
      locale={locale}
      localeSwitchHref={`/${alternateLocale}/evaluations/${cycleId}`}
    >
      <article className="workspacePanel evaluationJourney" data-testid="evaluation-journey">
        <p>{catalog["evaluation.technicalCheckpoint"]}</p>
        <h1>{catalog["evaluation.title"]}</h1>
        <p>{catalog["evaluation.calibrationNotice"]}</p>

        <section aria-labelledby="evaluation-facts-title">
          <h2 id="evaluation-facts-title">{catalog["evaluation.factView"]}</h2>
          <p>{catalog["evaluation.factViewBeforeNarrative"]}</p>
          <dl>
            <dt>{catalog["evaluation.workFacts"]}</dt>
            <dd>{journey.factViewFirst.workFacts.length}</dd>
            <dt>{catalog["evaluation.researchFacts"]}</dt>
            <dd>{journey.factViewFirst.researchFacts.length}</dd>
            <dt>{catalog["evaluation.coverageNotes"]}</dt>
            <dd>{journey.factViewFirst.sourceCoverageNotes.length}</dd>
          </dl>
        </section>

        <section>
          <h2>{catalog["evaluation.employeeInterpretation"]}</h2>
          <h3>{catalog["evaluation.selfAssessment"]}</h3>
          <p>{self === undefined ? catalog["evaluation.pending"] : `${self.entries.length}`}</p>
          <h3>{catalog["evaluation.managerInitial"]}</h3>
          <p>
            {manager === undefined ? catalog["evaluation.pending"] : `${manager.entries.length}`}
          </p>
          <p>{catalog["evaluation.independencePreserved"]}</p>
        </section>

        <section>
          <h2>{catalog["evaluation.comparisonDiscussion"]}</h2>
          <p>
            {journey.comparison === null
              ? catalog["evaluation.pending"]
              : catalog["evaluation.recorded"]}
          </p>
          <p>{journey.discussion.length}</p>
        </section>

        <section>
          <h2>{catalog["evaluation.finalHumanDecision"]}</h2>
          <p>
            {journey.finalDecision?.humanManagerDecision === true
              ? catalog["evaluation.recorded"]
              : catalog["evaluation.pending"]}
          </p>
        </section>

        <section>
          <h2>{catalog["evaluation.acknowledgmentReservation"]}</h2>
          <p>{journey.acknowledgment?.kind ?? catalog["evaluation.pending"]}</p>
          {journey.acknowledgment?.reservation === null ||
          journey.acknowledgment === null ? null : (
            <p>{journey.acknowledgment.reservation}</p>
          )}
        </section>

        <section>
          <h2>{catalog["evaluation.immutableSnapshot"]}</h2>
          <p>
            {journey.immutableClosedSnapshot === null
              ? catalog["evaluation.pending"]
              : catalog["evaluation.closedImmutable"]}
          </p>
        </section>
      </article>
    </WorkspaceShell>
  );
}
