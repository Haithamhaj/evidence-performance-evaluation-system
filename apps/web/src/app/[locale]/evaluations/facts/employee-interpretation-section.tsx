import { formatDateTime } from "@evaluation/localization";

export function EmployeeInterpretationSection({
  catalog,
  locale,
  interpretations,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  locale: import("@evaluation/localization").Locale;
  interpretations: readonly import("@evaluation/contracts").EmployeeInterpretation[];
}>) {
  return (
    <section className="panel factSection" aria-labelledby="employee-interpretation-heading">
      <h2 id="employee-interpretation-heading">{catalog["evaluationFacts.interpretation"]}</h2>
      <p className="boundaryNote">{catalog["evaluationFacts.interpretationBoundary"]}</p>
      {interpretations.length === 0 ? (
        <p className="emptyHint">{catalog["evaluationFacts.emptyInterpretation"]}</p>
      ) : (
        <div className="factList">
          {interpretations.map((interpretation) => (
            <article className="compactSourceRow" key={interpretation.id}>
              <div>
                <strong>{interpretation.normalizedText}</strong>
                <p>{interpretation.originalText}</p>
                <time dateTime={interpretation.createdAt}>
                  {formatDateTime(interpretation.createdAt, locale)}
                </time>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
