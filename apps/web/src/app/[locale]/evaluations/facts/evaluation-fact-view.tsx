import { formatDateTime } from "@evaluation/localization";
import { createElement } from "react";

import { CoverageNotes } from "./coverage-notes";
import { EmployeeInterpretationSection } from "./employee-interpretation-section";
import { SourceFactsSection } from "./source-facts-section";

export function EvaluationFactView({
  catalog,
  locale,
  view,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  locale: import("@evaluation/localization").Locale;
  view: import("@evaluation/contracts").EvaluationFactView;
}>) {
  return (
    <section className="dailyWorkPage" aria-labelledby="evaluation-facts-heading">
      <header className="compactPageHeading">
        <div>
          <p className="eyebrow">{catalog["evaluationFacts.eyebrow"]}</p>
          <h1 id="evaluation-facts-heading">{catalog["evaluationFacts.title"]}</h1>
          <p>{catalog["evaluationFacts.subtitle"]}</p>
        </div>
        <span className="statusBadge">
          {formatDateTime(view.cycle.startsAt, locale)} —{" "}
          {formatDateTime(view.cycle.endsAt, locale)}
        </span>
      </header>
      <p className="boundaryNote">{catalog["evaluationFacts.boundary"]}</p>
      {createElement(SourceFactsSection, { catalog, locale, view })}
      {createElement(CoverageNotes, { catalog, notes: view.sourceCoverageNotes })}
      {createElement(EmployeeInterpretationSection, {
        catalog,
        interpretations: view.employeeInterpretations,
        locale,
      })}
    </section>
  );
}
