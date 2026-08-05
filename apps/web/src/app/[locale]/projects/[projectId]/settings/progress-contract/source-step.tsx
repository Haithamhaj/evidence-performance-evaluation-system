import { localeMetadata } from "@evaluation/localization";

export function SourceStep({
  busy,
  catalog,
  locale,
  onContinue,
  sourceVersion,
}: Readonly<{
  busy: boolean;
  catalog: import("@evaluation/localization").Catalog;
  locale: import("@evaluation/localization").Locale;
  onContinue: () => void;
  sourceVersion: number;
}>) {
  return (
    <section className="progressSetupStep" dir={localeMetadata[locale].direction}>
      <p className="setupStepNumber">1 / 4</p>
      <h2>{catalog["progressSetup.step.source"]}</h2>
      <p>{catalog["progressSetup.sourceIntro"]}</p>
      <div className="compactSourceRow">
        <div>
          <strong>{catalog["progressContract.approvedProjectDocument"]}</strong>
          <span>
            {catalog["progressContract.sourceVersion"]} {sourceVersion}
          </span>
        </div>
        <span className="statusBadge status-active">{catalog["progressSetup.approved"]}</span>
      </div>
      <p className="boundaryNote">{catalog["progressSetup.notPerformance"]}</p>
      <div className="formActions">
        <button className="primaryAction" disabled={busy} onClick={onContinue} type="button">
          {busy ? catalog["progressContract.requesting"] : catalog["progressSetup.useSource"]}
        </button>
      </div>
    </section>
  );
}
