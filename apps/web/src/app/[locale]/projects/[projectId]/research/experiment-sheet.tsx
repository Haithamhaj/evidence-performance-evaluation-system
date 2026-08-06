export type ResearchExperimentView = Readonly<{
  title: string;
  state: "DRAFT" | "READY" | "RUNNING" | "RESULT_RECORDED" | "CONCLUDED";
  methodSummary: string;
  result: string | null;
  resultStatus: "COMPLETED" | "FAILED" | "INVALID" | "STOPPED" | null;
  humanConclusion: string | null;
  evidenceLinked: boolean;
}>;

export function ExperimentSheet({
  catalog,
  experiments,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  experiments: readonly ResearchExperimentView[];
}>) {
  if (experiments.length === 0) return null;
  return (
    <details className="panel researchDetails">
      <summary>{catalog["research.experiments"]}</summary>
      <div className="researchExperimentList">
        {experiments.map((experiment) => (
          <article className="researchExperiment" key={experiment.title}>
            <header>
              <h3 dir="auto">{experiment.title}</h3>
              <span className="statusBadge">
                {catalog[`research.experimentState.${experiment.state}`]}
              </span>
            </header>
            <p dir="auto">{experiment.methodSummary}</p>
            {experiment.result === null ? null : (
              <p dir="auto">
                <strong>{catalog["research.result"]}: </strong>
                {experiment.result}
              </p>
            )}
            {experiment.resultStatus === null ? null : (
              <p>{catalog[`research.resultStatus.${experiment.resultStatus}`]}</p>
            )}
            {experiment.humanConclusion === null ? null : (
              <p dir="auto">
                <strong>{catalog["research.humanConclusion"]}: </strong>
                {experiment.humanConclusion}
              </p>
            )}
            {experiment.evidenceLinked ? <p>{catalog["research.evidenceLinked"]}</p> : null}
          </article>
        ))}
      </div>
    </details>
  );
}
