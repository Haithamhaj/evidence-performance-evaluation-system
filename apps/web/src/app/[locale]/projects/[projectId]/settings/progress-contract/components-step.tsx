import { localeMetadata } from "@evaluation/localization";

type Content =
  import("../../../../../../platform/progress-contract-drafts").PublicProgressContractDraftContent;

export function ComponentsStep({
  catalog,
  content,
  locale,
  onBack,
  onContinue,
}: Readonly<{
  catalog: import("@evaluation/localization").Catalog;
  content: Content;
  locale: import("@evaluation/localization").Locale;
  onBack: () => void;
  onContinue: () => void;
}>) {
  return (
    <section className="progressSetupStep" dir={localeMetadata[locale].direction}>
      <p className="setupStepNumber">2 / 4</p>
      <h2>{catalog["progressSetup.step.components"]}</h2>
      <p>{catalog["progressSetup.componentsIntro"]}</p>
      <p className="aiDraftLabel">{catalog["progressContract.aiDraftLabel"]}</p>
      <ul className="compactSetupList">
        {content.components.map((component) => (
          <li key={component.position}>
            <div>
              <strong>{component.name}</strong>
              <span>{catalog[`progressContract.kind.${component.kind}`]}</span>
            </div>
            <p>{component.description}</p>
          </li>
        ))}
      </ul>
      {content.ambiguities.length === 0 ? null : (
        <div className="setupAttention">
          <strong>{catalog["progressContract.ambiguities"]}</strong>
          <ul>
            {content.ambiguities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="boundaryNote">{catalog["progressSetup.humanReviewRequired"]}</p>
      <div className="formActions">
        <button className="quietButton" onClick={onBack} type="button">
          {catalog["actions.back"]}
        </button>
        <button className="primaryAction" onClick={onContinue} type="button">
          {catalog["progressSetup.reviewRules"]}
        </button>
      </div>
    </section>
  );
}
