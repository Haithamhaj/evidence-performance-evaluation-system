import { getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";
import { z } from "zod";

import { fetchIdentifiedManagerView } from "../../../../platform/manager-evaluation-client";
// Babel's project ESLint parser removes JSX component usage before the base unused-import rule runs.
// eslint-disable-next-line no-unused-vars
import { WorkspaceShell } from "../../workspace-shell";

type Properties = Readonly<{ params: Promise<{ locale: string; cycleId: string }> }>;

export default async function ManagerFeedbackPage({ params }: Properties) {
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
        localeSwitchHref={`/${alternateLocale}/manager-feedback/${cycleId}`}
      >
        <article className="workspacePanel" data-testid="manager-feedback-arabic-gate">
          <p>{catalog["managerFeedback.technicalCheckpoint"]}</p>
          <h1>{catalog["managerFeedback.arabicUnavailableTitle"]}</h1>
          <p>{catalog["managerFeedback.arabicUnavailableBody"]}</p>
          <p>{catalog["feedback.identifiedNotice"]}</p>
        </article>
      </WorkspaceShell>
    );
  }
  const view = await fetchIdentifiedManagerView({ cycleId, locale });
  return (
    <WorkspaceShell
      catalog={catalog}
      locale={locale}
      localeSwitchHref={`/${alternateLocale}/manager-feedback/${cycleId}`}
    >
      <article
        className="workspacePanel evaluationJourney"
        data-testid="manager-feedback-identified-view"
      >
        <p>{catalog["managerFeedback.technicalCheckpoint"]}</p>
        <h1>{catalog["managerFeedback.title"]}</h1>
        <p>{catalog["feedback.identifiedNotice"]}</p>
        <section aria-labelledby="manager-feedback-completion">
          <h2 id="manager-feedback-completion">{catalog["managerFeedback.completion"]}</h2>
          <dl>
            <dt>{catalog["managerFeedback.submitted"]}</dt>
            <dd>{view.completion.submitted}</dd>
            <dt>{catalog["managerFeedback.pending"]}</dt>
            <dd>{view.completion.pending}</dd>
            <dt>{catalog["managerFeedback.approvedLeave"]}</dt>
            <dd>{view.completion.approvedLeave}</dd>
          </dl>
        </section>
        <section>
          <h2>{catalog["managerFeedback.originals"]}</h2>
          {view.responses.map((response) => (
            <article key={response.responseId}>
              <h3>{response.submitterDisplayName}</h3>
              <p>{response.submittedAt}</p>
              <ul>
                {response.responses.map((entry) => (
                  <li key={entry.criterionId}>
                    <span>
                      {catalog["managerFeedback.rating"]}: {entry.rating}
                    </span>
                    {entry.comment ? <p>{entry.comment}</p> : null}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>
        <p>{catalog["managerFeedback.aiBoundary"]}</p>
      </article>
    </WorkspaceShell>
  );
}
