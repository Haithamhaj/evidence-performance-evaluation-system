import { approvedEnglishRubric, getCatalog, isLocale } from "@evaluation/localization";
import { notFound } from "next/navigation";
import { z } from "zod";

import { fetchManagerFeedbackExperience } from "../../../../platform/manager-evaluation-client";
// Babel's project ESLint parser removes JSX component usage before the base unused-import rule runs.
// eslint-disable-next-line no-unused-vars
import { ManagerFeedbackWorkspace } from "./manager-feedback-workspace";
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
  const experience = await fetchManagerFeedbackExperience({ cycleId, locale });
  return (
    <WorkspaceShell
      catalog={catalog}
      locale={locale}
      localeSwitchHref={`/${alternateLocale}/manager-feedback/${cycleId}`}
    >
      <ManagerFeedbackWorkspace
        catalog={catalog}
        experience={experience}
        locale={locale}
        rubric={approvedEnglishRubric.managerCriteria}
      />
    </WorkspaceShell>
  );
}
