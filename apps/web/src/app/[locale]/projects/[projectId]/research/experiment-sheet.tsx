import { createElement } from "react";

export type ResearchExperimentView =
  import("../../../../../platform/research-experiments-contracts").WebExperimentRecord;

export function ExperimentSheet({
  catalog,
  experiments,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  experiments: readonly ResearchExperimentView[];
}>) {
  if (experiments.length === 0) return null;
  return (
    <section aria-labelledby="research-experiments-title" className="researchExperimentSection">
      <header className="researchSectionHeading">
        <div>
          <p className="eyebrow">{catalog["research.experimentTrail"]}</p>
          <h2 id="research-experiments-title">{catalog["research.experiments"]}</h2>
        </div>
      </header>
      <div className="researchExperimentList">
        {experiments.map((experiment) => (
          <article className="panel researchExperiment" key={experiment.handle}>
            <header>
              <div>
                <p className="eyebrow">{catalog["research.hypothesis"]}</p>
                <h3 dir="auto">{experiment.title}</h3>
              </div>
              <span className="statusBadge">
                {catalog[`research.experimentState.${experiment.state}`]}
              </span>
            </header>
            <p dir="auto">{experiment.question}</p>
            <div className="researchExperimentMethod">
              {createElement(MethodFact, {
                label: catalog["research.baseline"],
                values: [experiment.baseline],
              })}
              {createElement(MethodFact, {
                label: catalog["research.measures"],
                values: experiment.measures,
              })}
              {createElement(MethodFact, {
                label: catalog["research.testCases"],
                values: experiment.testCases,
              })}
              {createElement(MethodFact, {
                label: catalog["research.controls"],
                values: experiment.controls,
              })}
              {createElement(MethodFact, {
                label: catalog["research.versionsConditions"],
                values: experiment.versions,
              })}
              {createElement(MethodFact, {
                label: catalog["research.reproducibility"],
                values: [experiment.reproducibility],
              })}
            </div>
            {experiment.result === null ? null : (
              <section className="researchRunResult">
                <h4>{catalog["research.result"]}</h4>
                <p dir="auto">{experiment.result}</p>
                {experiment.resultStatus === null ? null : (
                  <p className="statusBadge">
                    {catalog[`research.resultStatus.${experiment.resultStatus}`]}
                  </p>
                )}
              </section>
            )}
            {experiment.humanConclusion === null ? (
              <p className="boundaryNote">{catalog["research.resultNeedsDecision"]}</p>
            ) : (
              <section className="researchHumanConclusion">
                <h4>{catalog["research.humanConclusion"]}</h4>
                <p dir="auto">{experiment.humanConclusion}</p>
                {experiment.limitations.length === 0 ? null : (
                  <ul>
                    {experiment.limitations.map((limitation) => (
                      <li dir="auto" key={limitation}>
                        {limitation}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function MethodFact({ label, values }: Readonly<{ label: string; values: readonly string[] }>) {
  if (values.length === 0) return null;
  return (
    <section>
      <h4>{label}</h4>
      <ul>
        {values.map((value) => (
          <li dir="auto" key={value}>
            {value}
          </li>
        ))}
      </ul>
    </section>
  );
}
