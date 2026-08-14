import { localeMetadata } from "@evaluation/localization";

type Content =
  import("../../../../../../platform/progress-contract-drafts").PublicProgressContractDraftContent;

export function RulesStep({
  busy,
  catalog,
  content,
  locale,
  onBack,
  onSave,
}: Readonly<{
  busy: boolean;
  catalog: import("@evaluation/localization").Catalog;
  content: Content;
  locale: import("@evaluation/localization").Locale;
  onBack: () => void;
  onSave: (event: import("react").FormEvent<HTMLFormElement>) => void;
}>) {
  const missing = missingRuleFields(content, catalog);
  return (
    <section className="progressSetupStep" dir={localeMetadata[locale].direction}>
      <p className="setupStepNumber">3 / 4</p>
      <h2>{catalog["progressSetup.step.rules"]}</h2>
      <p>{catalog["progressSetup.rulesIntro"]}</p>
      {missing.length === 0 ? null : (
        <div className="setupAttention" role="status">
          <strong>{catalog["progressSetup.missingFields"]}</strong>
          <ul>
            {missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      <form className="progressRulesForm" onSubmit={onSave}>
        {content.components.map((component) => (
          <fieldset className="compactRuleEditor" key={component.position}>
            <legend>{component.name}</legend>
            <label className="fullRow">
              <span>{catalog["progressContract.name"]}</span>
              <input
                defaultValue={component.name}
                dir="auto"
                name={`component.${component.position}.name`}
                required
              />
            </label>
            <label className="fullRow">
              <span>{catalog["progressContract.description"]}</span>
              <textarea
                defaultValue={component.description}
                dir="auto"
                name={`component.${component.position}.description`}
                required
                rows={2}
              />
            </label>
            <input
              name={`component.${component.position}.kind`}
              type="hidden"
              value={component.kind}
            />
            <label>
              <span>{catalog["progressContract.baseline"]}</span>
              <input
                defaultValue={component.baseline ?? ""}
                name={`component.${component.position}.baseline`}
                required={component.kind === "operational_kpi"}
                step="any"
                type="number"
              />
            </label>
            <label>
              <span>{catalog["progressContract.target"]}</span>
              <input
                defaultValue={component.target ?? ""}
                name={`component.${component.position}.target`}
                required={component.kind === "operational_kpi"}
                step="any"
                type="number"
              />
            </label>
            <label>
              <span>{catalog["progressContract.unit"]}</span>
              <input
                defaultValue={component.unit ?? ""}
                dir="auto"
                name={`component.${component.position}.unit`}
                required={component.kind === "operational_kpi"}
              />
            </label>
            <label>
              <span>{catalog["progressContract.direction"]}</span>
              <select
                defaultValue={component.direction ?? ""}
                name={`component.${component.position}.direction`}
                required={component.kind === "operational_kpi"}
              >
                <option value="">—</option>
                {(["increase", "decrease", "maintain"] as const).map((direction) => (
                  <option key={direction} value={direction}>
                    {catalog[`progressContract.direction.${direction}`]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{catalog["progressContract.weight"]}</span>
              <input
                defaultValue={component.weight ?? ""}
                max={100}
                min={0}
                name={`component.${component.position}.weight`}
                step="any"
                type="number"
              />
            </label>
            <label>
              <span>{catalog["progressContract.confirmationMode"]}</span>
              <select
                defaultValue={component.confirmationMode}
                name={`component.${component.position}.confirmationMode`}
              >
                {(["deterministic", "human_confirmed"] as const).map((mode) => (
                  <option key={mode} value={mode}>
                    {catalog[`progressContract.confirmation.${mode}`]}
                  </option>
                ))}
              </select>
            </label>
            <label className="fullRow">
              <span>{catalog["progressContract.acceptanceConditions"]}</span>
              <textarea
                defaultValue={component.acceptanceConditions.join("\n")}
                dir="auto"
                name={`component.${component.position}.acceptanceConditions`}
                required
                rows={2}
              />
            </label>
            <label className="fullRow">
              <span>{catalog["progressContract.requiredEvidence"]}</span>
              <textarea
                defaultValue={component.requiredEvidence.join("\n")}
                dir="auto"
                name={`component.${component.position}.requiredEvidence`}
                required
                rows={2}
              />
            </label>
          </fieldset>
        ))}
        <input name="ambiguities" type="hidden" value={content.ambiguities.join("\n")} />
        <input
          name="clarificationQuestions"
          type="hidden"
          value={content.clarificationQuestions.join("\n")}
        />
        <label>
          <span>{catalog["progressContract.reason"]}</span>
          <textarea dir="auto" maxLength={500} name="reason" required rows={2} />
        </label>
        <p className="boundaryNote">{catalog["progressSetup.notPerformance"]}</p>
        <div className="formActions">
          <button className="quietButton" onClick={onBack} type="button">
            {catalog["actions.back"]}
          </button>
          <button className="primaryAction" disabled={busy} type="submit">
            {busy ? catalog["progressContract.saving"] : catalog["progressSetup.saveAndReview"]}
          </button>
        </div>
      </form>
    </section>
  );
}

function missingRuleFields(
  content: Content,
  catalog: import("@evaluation/localization").Catalog,
): string[] {
  return [
    ...new Set(
      content.components.flatMap((component) => {
        if (component.kind !== "operational_kpi") return [];
        return [
          component.baseline === null ? catalog["progressContract.baseline"] : null,
          component.target === null ? catalog["progressContract.target"] : null,
          component.unit === null ? catalog["progressContract.unit"] : null,
          component.direction === null ? catalog["progressContract.direction"] : null,
        ].filter((item): item is string => item !== null);
      }),
    ),
  ];
}
