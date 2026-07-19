import { localeMetadata } from "@evaluation/localization";

export function UpdateResultCard({
  catalog,
  locale,
  result,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  locale: import("@evaluation/localization").Locale;
  result: import("../../../platform/updates-evidence-contracts").UpdateResultCard;
}>) {
  return (
    <section aria-live="polite" className="updateResultCard">
      <header>
        <p className="eyebrow">{catalog["updates.complete"]}</p>
        <h3>{result.summary}</h3>
        <p className="resultContext">
          {result.project.name}
          {result.workstream === null ? null : ` · ${result.workstream.name}`}
          {result.workItem === null ? null : ` · ${result.workItem.title}`}
        </p>
      </header>
      <dl className="resultDetails">
        <div>
          <dt>{catalog["updates.result"]}</dt>
          <dd dir="auto">{result.result}</dd>
        </div>
        <div>
          <dt>{catalog["updates.comparison"]}</dt>
          <dd dir="auto">{result.comparison.explanation}</dd>
        </div>
        <div>
          <dt>{catalog["updates.progressImpact"]}</dt>
          <dd>
            {progressLabel(catalog, result.progressImpact.state)}
            {result.progressImpact.state === "applied"
              ? ` · ${result.progressImpact.previousPercent}% → ${result.progressImpact.percent}%`
              : null}
          </dd>
        </div>
        <div>
          <dt>{catalog["updates.sourcesRecorded"]}</dt>
          <dd>{result.sourceReferences.length}</dd>
        </div>
        {result.blocker === null ? null : (
          <div>
            <dt>{catalog["updates.blocker"]}</dt>
            <dd dir="auto">{result.blocker}</dd>
          </div>
        )}
        <div>
          <dt>{catalog["updates.nextAction"]}</dt>
          <dd dir="auto">{result.nextAction}</dd>
        </div>
        {result.documentationNeeds.length === 0 ? null : (
          <div>
            <dt>{catalog["updates.documentationNeeds"]}</dt>
            <dd>
              <ul>
                {result.documentationNeeds.map((need) => (
                  <li dir="auto" key={need}>
                    {need}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        <div>
          <dt>{catalog["updates.confirmedAt"]}</dt>
          <dd>
            <time dateTime={result.confirmedAt}>
              {new Intl.DateTimeFormat(localeMetadata[locale].dateLocale, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(result.confirmedAt))}
            </time>
          </dd>
        </div>
      </dl>
    </section>
  );
}

function progressLabel(
  catalog: import("@evaluation/localization").Catalog,
  state: import("../../../platform/updates-evidence-contracts").UpdateResultCard["progressImpact"]["state"],
): string {
  return catalog[`updates.progressImpact.${state}`];
}
