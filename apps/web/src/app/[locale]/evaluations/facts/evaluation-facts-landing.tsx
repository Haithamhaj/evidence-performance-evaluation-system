export function EvaluationFactsLanding({
  catalog,
  locale,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  locale: import("@evaluation/localization").Locale;
}>) {
  return (
    <section className="dailyWorkPage" aria-labelledby="evaluation-facts-heading">
      <header className="compactPageHeading">
        <div>
          <p className="eyebrow">{catalog["evaluationFacts.eyebrow"]}</p>
          <h1 id="evaluation-facts-heading">{catalog["evaluationFacts.noCycleTitle"]}</h1>
          <p>{catalog["evaluationFacts.noCycleBody"]}</p>
        </div>
      </header>
      <p className="boundaryNote">{catalog["evaluationFacts.boundary"]}</p>
      <a className="primaryLink" href={`/${locale}/insights`}>
        {catalog["evaluationFacts.openInsights"]}
      </a>
    </section>
  );
}
