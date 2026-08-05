export function ProgressContractDraftPanel({
  catalog,
  enabled,
  locale,
  projectId,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  enabled: boolean;
  locale: import("@evaluation/localization").Locale;
  projectId: string;
}>) {
  if (!enabled) return null;
  return (
    <section className="progressContractReviewEntry" aria-labelledby="contract-review-heading">
      <div>
        <h2 id="contract-review-heading">{catalog["progressSetup.title"]}</h2>
        <p className="boundaryNote">{catalog["progressSetup.notPerformance"]}</p>
      </div>
      <a
        className="primaryAction"
        href={`/${locale}/projects/${projectId}/settings/progress-contract`}
      >
        {catalog["progressSetup.open"]}
      </a>
    </section>
  );
}
