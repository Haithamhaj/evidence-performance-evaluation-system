import { formatDateTime } from "@evaluation/localization";
import { createElement } from "react";

type Properties = Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  locale: import("@evaluation/localization").Locale;
  view: import("@evaluation/contracts").EvaluationFactView;
}>;

export function SourceFactsSection({ catalog, locale, view }: Properties) {
  const groups = [
    {
      key: "contributions",
      rows: view.projectFacts.map((fact) => ({
        id: fact.sourceId,
        title: fact.summary,
        detail: fact.result,
        occurredAt: fact.sourceOccurredAt,
        references: fact.sourceReferences,
      })),
    },
    {
      key: "evidence",
      rows: view.confirmedEvidence.map((fact) => ({
        id: fact.sourceId,
        title: fact.supportedClaim,
        detail: fact.contributionContext,
        occurredAt: fact.sourceOccurredAt,
        references: fact.sourceReferences,
      })),
    },
    {
      key: "responsibilities",
      rows: view.responsibilityWindows.map((fact) => ({
        id: fact.sourceId,
        title: catalog[`evaluationFacts.responsibility.${fact.responsibilityType}`],
        detail:
          fact.endedAt === null
            ? catalog["evaluationFacts.period.current"]
            : `${formatDateTime(fact.startedAt, locale)} — ${formatDateTime(fact.endedAt, locale)}`,
        occurredAt: fact.sourceOccurredAt,
        references: fact.sourceReferences,
      })),
    },
    {
      key: "criteria",
      rows: view.dynamicCriteriaVersions.map((fact) => ({
        id: fact.sourceId,
        title: fact.name,
        detail: `${catalog["evaluationFacts.effectiveFrom"]}: ${formatDateTime(fact.effectiveFrom, locale)}`,
        occurredAt: fact.sourceOccurredAt,
        references: fact.sourceReferences,
      })),
    },
    {
      key: "checkIns",
      rows: view.checkInFacts.map((fact) => ({
        id: fact.sourceId,
        title: fact.summary,
        detail: fact.status,
        occurredAt: fact.sourceOccurredAt,
        references: fact.sourceReferences,
      })),
    },
  ] as const;

  return (
    <section className="panel factSection" aria-labelledby="source-facts-heading">
      <h2 id="source-facts-heading">{catalog["evaluationFacts.sourceFacts"]}</h2>
      {groups.every(({ rows }) => rows.length === 0) ? (
        <p className="emptyHint">{catalog["evaluationFacts.emptyFacts"]}</p>
      ) : (
        <div className="factGroupList">
          {groups.map(({ key, rows }) =>
            rows.length === 0 ? null : (
              <section key={key} aria-labelledby={`fact-group-${key}`}>
                <h3 id={`fact-group-${key}`}>{catalog[`evaluationFacts.group.${key}`]}</h3>
                <div className="factList">
                  {rows.map((row) => (
                    <article className="compactSourceRow" key={row.id}>
                      <div>
                        <strong>{row.title}</strong>
                        {row.detail ? <p>{row.detail}</p> : null}
                        <time dateTime={row.occurredAt}>
                          {formatDateTime(row.occurredAt, locale)}
                        </time>
                      </div>
                      {createElement(SourceLinks, { catalog, references: row.references })}
                    </article>
                  ))}
                </div>
              </section>
            ),
          )}
        </div>
      )}
    </section>
  );
}

function SourceLinks({
  catalog,
  references,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  references: readonly import("@evaluation/contracts").EvaluationFactSourceReference[];
}>) {
  const links = references.filter(
    (reference): reference is typeof reference & { url: string } =>
      reference.url !== null && isSafeSourceUrl(reference.url),
  );
  if (links.length === 0) return <span>{catalog["evaluationFacts.sourceRecorded"]}</span>;
  return (
    <span className="sourceLinks">
      {links.map((reference) => (
        <a
          href={reference.url}
          key={`${reference.sourceType}:${reference.sourceId}:${reference.sourceVersion ?? "current"}`}
          rel="noreferrer"
        >
          {catalog["evaluationFacts.openSource"]}
        </a>
      ))}
    </span>
  );
}

function isSafeSourceUrl(value: string): boolean {
  const protocol = new URL(value).protocol;
  return protocol === "https:" || protocol === "http:";
}
